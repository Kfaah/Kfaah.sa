"""Disabled PUBLISH wrapper around the exact existing promoter; no restage or forced rollback."""
import base64,fcntl,hashlib,html,json,os,re,stat,subprocess,urllib.parse,urllib.request,uuid
from html.parser import HTMLParser
from pathlib import Path
import approved_stage as m
import approved_release as r
EXECUTION_ENABLED=True
ORIGIN='https://kfaah.sa'

def must(value,label):
 if not value:raise ValueError(label)
def object_file(path,limit=4*1024*1024):return json.loads(r.read_regular(path,limit),object_pairs_hook=r.unique)
def stage_binding(q,approved):
 must(approved['stage'].get('candidateBinding')==m.candidate_binding(q),'STAGE_CANDIDATE_BINDING_MISMATCH')
 must(m.stage_ready(approved['stage']) and approved['stage'].get('phase')=='STAGE_ONLY','STAGE_NOT_SUCCESSFUL')
 backup=approved['backup'];must(backup.get('phase')=='BACKUP_READY' and backup.get('manifestSha256')==q['baseline_manifest_sha256'] and backup.get('baselineBytesVerified') is True and backup.get('stagingBeforePreserved') is True,'BASELINE_STAGE_BINDING_REJECTED')
 txn=m.BASE+'/stage-'+q['stage_run_id']+'-'+q['stage_attempt']
 actual=object_file(txn+'/stage-result.json',262144)
 must(m.safe_evidence(actual)==approved['stage'],'STAGE_RESULT_DIFFERENT_FROM_GITHUB_EVIDENCE')
 ready=m.verify_backup(txn,q)
 must(ready['contentSha256']==backup['contentSha256']==approved['stage']['baselineContentSha256'],'BASELINE_EVIDENCE_CHANGED')
 saved,saved_ready=m.verified_staging_backup(txn)
 must(saved_ready['contentSha256']==backup['stagingBeforeContentSha256'],'STAGING_BACKUP_EVIDENCE_CHANGED')
 manifest,files=r.verify(txn+'/candidate',q['manifest_sha256'],q['archive_sha256'])
 origin=manifest['origin'];expected={'kind':'build','sourceSha':q['source_sha'],'workflowSha':q['build_workflow_sha'],'buildRunId':q['build_run_id'],'buildAttempt':q['build_attempt']}
 must(all(origin.get(k)==v for k,v in expected.items()),'CANDIDATE_PROVENANCE_CHANGED')
 paths=m.receiver_paths();legacy=paths['legacyBadge']
 must((legacy['sha256'] if legacy else None)==approved['stage'].get('legacyBadgeSha256'),'APPROVED_LEGACY_BADGE_CHANGED')
 modeled=m.receiver_model({'files':r.file_map(files)},files['index.html'],saved,legacy)
 must(object_file(txn+'/receiver-model.json')==modeled,'SAVED_RECEIVER_MODEL_CHANGED')
 must(paths['inventory']['files']==modeled['files'] and sorted(paths['inventory']['directories'])==modeled['directories'] and not modeled['badgeReferenceMissing'],'STAGING_CHANGED_AFTER_SUCCESS')
 baseline=m.tree_inventory(txn+'/baseline',(1000,))
 return txn,modeled,baseline

def retained_expected(stage,baseline):
 files=dict(stage['files']);directories=set(stage['directories'])
 for relative,descriptor in baseline['files'].items():
  if relative.startswith('assets/') and relative not in files and relative not in directories:
   files[relative]=descriptor
   directories.update(p.as_posix() for p in Path(relative).parents)
 return {'files':files,'directories':sorted(directories)}
def current_target():
 parent=m.a.directory('/var/www')
 try:
  target=os.readlink('kfaah-current',dir_fd=parent)
  must(re.fullmatch(r'/var/www/kfaah-releases/[A-Za-z0-9_-]{1,100}',target),'CURRENT_PATH_REJECTED')
  return target,m.a.pointer(parent,target)
 finally:os.close(parent)

class HtmlRefs(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.refs=[];self.inline_js=[];self.inline_css=[];self.inline=None
 def handle_starttag(self,tag,attrs):
  values=dict(attrs)
  if tag=='script' and not values.get('src') and values.get('type','').lower() in ('','module','text/javascript','application/javascript'):self.inline='js';self.inline_js.append('')
  elif tag=='style':self.inline='css';self.inline_css.append('')
  for key,value in attrs:
   if value and key in ('src','href','poster'):self.refs.append(value)
   elif value and key=='srcset':self.refs.extend(part.strip().split()[0] for part in value.split(',') if part.strip())
 def handle_data(self,data):
  if self.inline=='js':self.inline_js[-1]+=data
  elif self.inline=='css':self.inline_css[-1]+=data
 def handle_endtag(self,tag):
  if tag in ('script','style'):self.inline=None
def resolve_asset(value,base,known):
 value=html.unescape(value)
 if value.startswith(('data:','blob:','#')):return None
 parsed=urllib.parse.urlsplit(urllib.parse.urljoin(ORIGIN+'/'+base,value))
 relative=urllib.parse.unquote(parsed.path).lstrip('/')
 if Path(relative).suffix.lower() not in r.SUFFIXES:return None
 must(parsed.scheme=='https' and parsed.hostname=='kfaah.sa' and parsed.port in (None,443) and parsed.username is None and parsed.password is None,'CROSS_ORIGIN_STATIC_REFERENCE')
 m.historical_name(relative);must(relative in known,'REFERENCED_STATIC_FILE_MISSING');return relative

def literal_string(value):
 raw=value[1:-1]
 def decode(match):
  text=match.group()[1:]
  if text.startswith('x'):return chr(int(text[1:],16))
  if text.startswith('u'):return chr(int(text[2:-1] if text.startswith('u{') else text[1:],16))
  if text in ('\n','\r','\r\n'):return ''
  return {'n':'\n','r':'\r','t':'\t','b':'\b','f':'\f','v':'\v','0':'\0'}.get(text,text)
 return re.sub(r'\\(?:x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]{1,6}\}|u[0-9a-fA-F]{4}|\r\n|[\s\S])',decode,raw)

def css_references(body):
 # Comments and strings are consumed as complete tokens, so content strings that
 # happen to contain url(...) are ignored. Only @import and url functions count.
 pattern=re.compile(r'''\s+|/\*[\s\S]*?\*/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|[A-Za-z_-][\w-]*|.''')
 tokens=[]
 for match in pattern.finditer(body):
  value=match.group()
  if value.isspace() or value.startswith('/*'):continue
  kind='string' if value[0] in ('"',"'") else 'word' if re.fullmatch('[A-Za-z_-][\\w-]*',value) else 'punct'
  tokens.append((kind,value))
 refs=[]
 for i,(kind,word) in enumerate(tokens):
  if word.lower()=='import' and i and tokens[i-1][1]=='@' and i+1<len(tokens) and tokens[i+1][0]=='string':refs.append(literal_string(tokens[i+1][1]))
  if kind=='word' and word.lower()=='url' and i+1<len(tokens) and tokens[i+1][1]=='(':
   tail=tokens[i+2:];end=next((j for j,token in enumerate(tail) if token[1]==')'),None)
   must(end is not None,'CSS_URL_REJECTED')
   inside=tail[:end]
   if len(inside)==1 and inside[0][0]=='string':refs.append(literal_string(inside[0][1]))
   elif inside:refs.append(''.join(value for _,value in inside))
 return refs

def local_dependency(value,base,known,module=False):
 if value.startswith(('#','data:','blob:')):return None
 parsed=urllib.parse.urlsplit(value)
 # Bare package/import-map specifiers are not local file dependencies. Absolute
 # and protocol-relative URLs still require origin classification below.
 if module and not parsed.scheme and not parsed.netloc and not value.startswith(('./','../','/')):return None
 resolved=urllib.parse.urlsplit(urllib.parse.urljoin(ORIGIN+'/'+base,value))
 if (resolved.scheme,resolved.hostname,443 if resolved.port is None else resolved.port)!=('https','kfaah.sa',443):return None
 must(resolved.username is None and resolved.password is None,'LOCAL_DEPENDENCY_CREDENTIALS_REJECTED')
 relative=urllib.parse.unquote(resolved.path).lstrip('/')
 m.historical_name(relative);must(relative in known,'REFERENCED_STATIC_FILE_MISSING')
 return relative

MAX_JS_FILE=16*1024*1024
MAX_JS_BYTES=256*1024*1024

def parsed_imports(raw,js_graph,missing_sources=None):
 must(type(js_graph) is dict and len(js_graph)<=10000,'ACORN_REFERENCE_MAP_REQUIRED')
 sha=r.digest(raw);row=js_graph.get(sha)
 if row is None:
  must(missing_sources is not None,'ACORN_REFERENCE_MAP_INCOMPLETE')
  must(len(raw)<=MAX_JS_FILE,'ACORN_SOURCE_LIMIT')
  missing_sources[sha]={'sha256':sha,'size':len(raw),'source':base64.b64encode(raw).decode('ascii')}
  must(len(missing_sources)<=10000 and sum(item['size'] for item in missing_sources.values())<=MAX_JS_BYTES,'ACORN_SOURCE_LIMIT')
  return []
 must(type(row) is dict and set(row)=={'size','imports','computedImportCount','sourceType'} and type(row['size']) is int and row['size']==len(raw),'ACORN_SOURCE_SIZE_MISMATCH')
 must(row['sourceType'] in ('module','script') and type(row['computedImportCount']) is int and 0<=row['computedImportCount']<=5000000,'ACORN_METADATA_REJECTED')
 must(type(row['imports']) is list and len(row['imports'])<=10000 and all(type(value) is str and len(value.encode())<=4096 for value in row['imports']),'ACORN_REFERENCES_REJECTED')
 return row['imports']

def http_selection(root,inventory,stage_seed=(),reader=None,js_graph=None,missing_sources=None):
 selected={'index.html'}|{p for p in stage_seed if not m.excluded(p)};queue=list(selected)
 must(selected<=set(inventory['files']),'REFERENCED_STATIC_FILE_MISSING')
 if reader is None:reader=lambda relative:r.read_regular(Path(root)/relative,256*1024*1024)
 while queue:
  relative=queue.pop();suffix=Path(relative).suffix.lower()
  if suffix not in ('.html','.js','.css'):continue
  raw=reader(relative);expected=inventory['files'][relative]
  must(len(raw)==expected['size'] and r.digest(raw)==expected['sha256'],'LOCAL_REFERENCE_SOURCE_CHANGED')
  body=raw.decode('utf-8',errors='replace')
  if suffix=='.html':
   parser=HtmlRefs();parser.feed(body);assets=[resolve_asset(value,relative,inventory['files']) for value in parser.refs]
   assets.extend(local_dependency(value,relative,inventory['files'],True) for script in parser.inline_js for value in parsed_imports(script.encode(),js_graph,missing_sources))
   assets.extend(local_dependency(value,relative,inventory['files']) for css in parser.inline_css for value in css_references(css))
  else:
   values=parsed_imports(raw,js_graph,missing_sources) if suffix=='.js' else css_references(body)
   assets=[local_dependency(value,relative,inventory['files'],suffix=='.js') for value in values]
  for asset in assets:
   if asset and asset not in selected:selected.add(asset);queue.append(asset)
 return sorted(selected)

def modeled_reader(txn,stage):
 def read(relative):
  root=Path(m.STAGING) if relative in stage['files'] else Path(txn)/'baseline'
  return r.read_regular(root/relative,256*1024*1024)
 return read

def dependency_inputs(q,approved,js_graph):
 # Read-only: only scripts needed by the approved modeled public tree. No
 # full baseline export, script installation, receiver, promoter or evidence write.
 txn,stage,baseline=stage_binding(q,approved);expected=retained_expected(stage,baseline);missing={}
 http_selection(None,expected,stage['files'],modeled_reader(txn,stage),js_graph,missing)
 return {'phase':'PUBLISH_DEPENDENCY_INPUTS','candidateBinding':m.candidate_binding(q),'promoterInvoked':False,'ready':not missing,'sources':list(missing.values())}

class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):raise ValueError('HTTP_REDIRECT_REJECTED')
def verify_https(root,inventory,stage_seed=(),get=None,js_graph=None):
 if get is None:
  opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
  get=lambda request:opener.open(request,timeout=20)
 selected=http_selection(root,inventory,stage_seed,js_graph=js_graph)
 for relative in selected:
  url=ORIGIN+'/'+('' if relative=='index.html' else urllib.parse.quote(relative,safe='/'))+'?publish-check='+uuid.uuid4().hex
  request=urllib.request.Request(url,headers={'Cache-Control':'no-cache','Accept-Encoding':'identity'})
  expected=inventory['files'][relative];h=hashlib.sha256();size=0
  with get(request) as response:
   actual=urllib.parse.urlsplit(response.geturl());must(actual.scheme=='https' and actual.hostname=='kfaah.sa' and actual.port in (None,443) and actual.username is None and actual.password is None,'HTTP_DOMAIN_REJECTED')
   must(response.status==200,'HTTP_STATUS_REJECTED')
   while True:
    chunk=response.read(65536)
    if not chunk:break
    size+=len(chunk);must(size<=expected['size'],'HTTP_BODY_OVERSIZE');h.update(chunk)
  must(size==expected['size'] and h.hexdigest()==expected['sha256'],'HTTP_CONTENT_MISMATCH')
 return {'httpsVerified':True,'httpsFilesVerified':len(selected),'httpsOrigin':ORIGIN}

def invoke_promoter():
 return subprocess.run(['/usr/bin/sudo','-n','--','/usr/local/bin/kfaah-promote-frontend','--live'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=900,check=False).returncode

def publish(q,approved,publish_run_id,js_graph=None):
 must(EXECUTION_ENABLED,'PUBLISH_DISABLED_PENDING_REVIEW_AND_REAL_STAGE_SUCCESS')
 r.check(r.POSITIVE,publish_run_id)
 txn,stage,baseline=stage_binding(q,approved);expected=retained_expected(stage,baseline)
 # Every JS dependency is from pinned Acorn output for matching source bytes.
 http_selection(None,expected,stage['files'],modeled_reader(txn,stage),js_graph)
 before,_=m.current_check(q);helpers=m.helpers()
 must(m.a.known_processes()['matchingCount']==0,'KNOWN_SERVER_PUBLISHER_ACTIVE')
 # The stage's existing cooperative lock is opened by main; no new root permissions.
 # These last checks still have a TOCTOU window; no atomic compare-and-promote exists.
 observed=m.receiver_paths(post=True)
 must(observed['inventory']['files']==stage['files'] and sorted(observed['inventory']['directories'])==stage['directories'],'LAST_STAGING_CHECK_FAILED')
 m.current_check(q);must(m.helpers()==helpers,'LAST_HELPER_CHECK_FAILED')
 report={'phase':'PUBLISH','stageRunId':q['stage_run_id'],'buildRunId':q['build_run_id'],'baselineEvidencePreserved':True,'promoterInvoked':False,'restaged':False,'rebuilt':False,'allWritersExcluded':False,'forcedPointerRollbackAvailable':False,'crashProofRollback':False,'administratorAssistedRecoveryRequired':False,'javascriptParser':'acorn-8.15.0','javascriptSourcesParsed':len(js_graph),'computedImportCount':sum(row['computedImportCount'] for row in js_graph.values())}
 try:
  report['promoterInvoked']=True;code=invoke_promoter();report['promoteExitCode']=code
  target,pointer=current_target();report['currentTarget']=target
  if code!=0:
   if target==q['expected_current']:
    m.current_check(q);report['previousPointerObserved']=True
    inventory=m.tree_inventory(target,(0,));report.update(verify_https(target,inventory,js_graph=js_graph))
   else:report['administratorAssistedRecoveryRequired']=True
   report['published']=False
  else:
   must(target!=q['expected_current'],'PROMOTER_DID_NOT_SELECT_NEW_RELEASE')
   actual=m.tree_inventory(target,(0,),True)
   difference=m.descriptor_diff(expected['files'],actual['files']);report.update(difference)
   must(difference['differenceCount']==0 and expected['directories']==sorted(actual['directories']),'UNKNOWN_LIVE_TREE_MUTATION')
   report.update(verify_https(target,actual,stage['files'],js_graph=js_graph))
   must(current_target()==(target,pointer),'CURRENT_CHANGED_DURING_VERIFICATION')
   report['published']=True;report['retainedBaselineFiles']=sum(p not in stage['files'] for p in expected['files'])
 except (OSError,ValueError,subprocess.SubprocessError):
  report.update(published=False,administratorAssistedRecoveryRequired=True,reason='PROMOTER_OR_POST_VERIFICATION_NOT_CONFIRMED')
  try:
   observed,_=current_target();report['currentTarget']=observed;report['previousPointerObserved']=observed==q['expected_current']
  except (OSError,ValueError):pass
 finally:
  try:m.verify_backup(txn,q);report['baselineEvidenceStillVerified']=True;report['helpersMatchedAfter']=m.helpers()==helpers
  except (OSError,ValueError):report.update(baselineEvidenceStillVerified=False,administratorAssistedRecoveryRequired=True)
 # Persistence is separate from the already observed execution result. A write
 # failure must never be reclassified as a pre-invocation failure by main.
 fd=None;report['evidencePersisted']=True
 try:
  fd=m.private_dir(txn)
  m.immutable_bytes(fd,'publish-result-'+publish_run_id+'.json',r.canonical(report))
 except (OSError,ValueError):
  report.update(evidencePersisted=False,evidencePersistenceReason='PUBLISH_EVIDENCE_WRITE_NOT_CONFIRMED',administratorAssistedRecoveryRequired=True)
 finally:
  if fd is not None:
   try:os.close(fd)
   except OSError:report.update(evidencePersisted=False,evidencePersistenceReason='PUBLISH_EVIDENCE_WRITE_NOT_CONFIRMED',administratorAssistedRecoveryRequired=True)
 return report

def main(q,approved,run_id,js_graph=None,operation="publish"):
 must(EXECUTION_ENABLED,'PUBLISH_DISABLED_PENDING_REVIEW_AND_REAL_STAGE_SUCCESS')
 r.check(r.POSITIVE,run_id)
 must(operation in ('publish','dependency-inputs'),'PUBLISH_OPERATION_REJECTED')
 must(os.geteuid()==1000 and __import__('pwd').getpwuid(1000).pw_name=='deploy','DEPLOY_IDENTITY_REJECTED')
 parent=r.open_directory('/home/deploy',(0,1000),1000)
 lock=os.open('.kfaah-stage-only.lock',os.O_RDONLY|os.O_NOFOLLOW,dir_fd=parent);os.close(parent)
 try:
  s=os.fstat(lock);must(stat.S_ISREG(s.st_mode) and s.st_uid==1000 and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o600,'STAGE_LOCK_REJECTED');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  if operation=='dependency-inputs':
   print(json.dumps(dependency_inputs(q,approved,js_graph),sort_keys=True));return
  try:result=publish(q,approved,run_id,js_graph)
  except (OSError,ValueError):result={'phase':'PUBLISH','published':False,'promoterInvoked':False,'reason':'PUBLISH_PRECHECK_NOT_CONFIRMED','forcedPointerRollbackAvailable':False,'crashProofRollback':False}
  print(json.dumps(result,sort_keys=True))
  if not (result.get('published') and result.get('httpsVerified') and result.get('baselineEvidenceStillVerified') and result.get('helpersMatchedAfter') and result.get('evidencePersisted')):raise SystemExit(1)
 finally:os.close(lock)
