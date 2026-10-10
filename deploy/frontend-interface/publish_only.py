"""Disabled owner PUBLISH channel; binds successful STAGE and immutable build provenance."""
import argparse,base64,hashlib,importlib.util,json,os,re,shutil,subprocess,sys
from pathlib import Path
EXECUTION_ENABLED=False
REPO='gaberalhrese-cloud/shop-soulmate-04'
# Independently reviewed STAGE companion commit; PUBLISH remains disabled.
STAGE_SHA='64baa64fa6f14c33803308117954e9aae0ebf0a2'
STAGE_WORKFLOW='.github/workflows/kfaah-owner-stage-only.yml'
OWNER=253139283
EXECUTION_STATE="NOT_INVOKED"
ROOT=Path(__file__).parent

def must(v,label='PUBLISH_REQUEST_REJECTED'):
 if not v:raise ValueError(label)
def load_dependencies(stage_tools,build_tools):
 for file,sha in {'stage_only.py':'5ecc37167122942a9f4a26491afaae16cc62e78eb6bb3df604ba661eeff3e773','remote_stage.py':'e91a690993f36b6f08336690d0f56e8db7410f6b808cb62fcb1c901f1dc45a35'}.items():must(hashlib.sha256((stage_tools/file).read_bytes()).hexdigest()==sha,'STAGE_TOOLS_CHANGED')
 spec=importlib.util.spec_from_file_location('stage_controller',stage_tools/'stage_only.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
 r,p=s.dependency_modules(build_tools);return s,r,p

def plan_request(e,sha,attempt,r,s):
 must(attempt=='1' and e.get('action')=='opened' and e.get('sender',{}).get('id')==OWNER)
 must(e.get('repository',{}).get('full_name')==REPO and e.get('repository',{}).get('owner',{}).get('id')==OWNER)
 i=e.get('issue',{});must(i.get('title')=='KFAAH_OWNER_PUBLISH_V1' and i.get('user',{}).get('id')==OWNER and i.get('author_association')=='OWNER' and 'pull_request' not in i)
 body=i.get('body');must(type(body) is str and len(body.encode())<=4096);q=json.loads(body,object_pairs_hook=r.unique)
 fields={'version','operation','workflow_sha','stage_workflow_sha','stage_run_id','stage_attempt','stage_artifact_id','stage_result_sha256','stage_backup_result_sha256','build_workflow_sha','source_sha','build_run_id','build_attempt','artifact_id','manifest_sha256','archive_sha256','expected_current','baseline_manifest_sha256','expected_receive_sha256','expected_promote_sha256','quiet_window_confirmed'}
 must(type(q) is dict and set(q)==fields and type(q['version']) is int and q['version']==1 and q['operation']=='PUBLISH')
 r.check(r.H40,sha);must(q['workflow_sha']==sha and q['stage_workflow_sha']==STAGE_SHA and q['stage_attempt']=='1')
 r.check(r.H40,q['source_sha']);must(q['build_workflow_sha']==s.TOOLS_SHA)
 for key in ('stage_run_id','stage_artifact_id','build_run_id','build_attempt','artifact_id'):r.check(r.POSITIVE,q[key])
 for key in ('stage_result_sha256','stage_backup_result_sha256','manifest_sha256','archive_sha256'):r.check(r.H64,q[key])
 must(q['expected_current']==s.CURRENT and q['baseline_manifest_sha256']==s.BASELINE_SHA and q['expected_receive_sha256']==s.RECEIVE_SHA and q['expected_promote_sha256']==s.PROMOTE_SHA and q['quiet_window_confirmed'] is True)
 return q

def verify_stage_run(q,get):
 run=get('actions/runs/'+q['stage_run_id']+'/attempts/'+q['stage_attempt'])
 must(all(run.get(k)==v for k,v in {'id':int(q['stage_run_id']),'run_attempt':1,'status':'completed','conclusion':'success','event':'issues','head_branch':'main','head_sha':STAGE_SHA,'path':STAGE_WORKFLOW}.items()),'STAGE_RUN_NOT_APPROVED_SUCCESS')
 must(run.get('repository',{}).get('full_name')==REPO and run.get('actor',{}).get('id')==OWNER,'STAGE_RUN_FOREIGN')
 artifact=get('actions/artifacts/'+q['stage_artifact_id'])
 must(artifact.get('id')==int(q['stage_artifact_id']) and artifact.get('expired') is False and artifact.get('name')=='kfaah-stage-only-evidence-'+q['stage_run_id']+'-'+q['stage_attempt'],'STAGE_ARTIFACT_REJECTED')
 must(artifact.get('workflow_run',{}).get('id')==int(q['stage_run_id']) and artifact.get('workflow_run',{}).get('head_sha')==STAGE_SHA,'STAGE_ARTIFACT_RUN_MISMATCH')

def evidence(q,directory,r):
 out={}
 for kind,file,key in [('stage','stage-result.jsonl','stage_result_sha256'),('backup','backup-result.jsonl','stage_backup_result_sha256')]:
  raw=r.read_regular(directory/file,262144);must(r.digest(raw)==q[key],'STAGE_EVIDENCE_SHA_MISMATCH')
  lines=raw.splitlines();must(len(lines)==1,'STAGE_EVIDENCE_RECORD_COUNT')
  out[kind]=json.loads(lines[0],object_pairs_hook=r.unique)
 stage=out['stage'];backup=out['backup']
 binding={key:q[key] for key in ('manifest_sha256', 'archive_sha256', 'source_sha', 'build_workflow_sha', 'build_run_id', 'build_attempt', 'artifact_id')}
 must(stage.get('candidateBinding')==binding,'STAGE_CANDIDATE_BINDING_MISMATCH')
 must(stage.get('phase')=='STAGE_ONLY' and stage.get('stagingMatchesReceiverModel') is True and stage.get('currentBaselineMatchedBeforeAfter') is True and stage.get('baselineStillVerified') is True and stage.get('helpersMatchedBeforeAfter') is True and stage.get('incomingRecovery') in ('ORIGINAL_INCOMING_PRESENT','ORIGINAL_INCOMING_ABSENCE_PRESENT','ORIGINAL_INCOMING_RESTORED'),'STAGE_EVIDENCE_NOT_READY')
 txn='/home/deploy/frontend-stage-backups/stage-'+q['stage_run_id']+'-'+q['stage_attempt']
 must(stage.get('backupPath')==txn+'/baseline' and backup.get('backupPath')==txn+'/baseline' and backup.get('manifestSha256')==q['baseline_manifest_sha256'] and stage.get('baselineContentSha256')==backup.get('contentSha256'),'STAGE_BASELINE_BINDING_MISMATCH')
 must(backup.get('phase')=='BACKUP_READY' and backup.get('baselineBytesVerified') is True and backup.get('stagingBeforePreserved') is True,'STAGE_BACKUP_NOT_READY')
 return out

def remote_payload(stage_tools,build_tools,audit_workflow,q,approved,run_id,s,js_graph=None,operation="publish"):
 code='import types,sys,json\nsys.dont_write_bytecode=True\n'
 for name,source in [('approved_audit',s.approved_audit_source(audit_workflow)),('approved_release',(build_tools/'release.py').read_text()),('approved_stage',(stage_tools/'remote_stage.py').read_text())]:
  code+='m=types.ModuleType('+repr(name)+');sys.modules['+repr(name)+']=m\nexec(compile('+repr(source)+','+repr(name)+',"exec"),m.__dict__)\n'
 code+='namespace={"__name__":"remote_publish"}\nexec(compile('+repr((ROOT/'remote_publish.py').read_text())+',"remote_publish","exec"),namespace)\n'
 code+='namespace["main"](json.loads('+repr(json.dumps(q))+'),json.loads('+repr(json.dumps(approved))+'),'+repr(run_id)+',json.loads('+repr(json.dumps(js_graph))+'),'+repr(operation)+')\n'
 return code.encode()

ALLOWED={'javascriptParser','javascriptSourcesParsed','computedImportCount','evidencePersisted','evidencePersistenceReason','phase','stageRunId','buildRunId','baselineEvidencePreserved','promoterInvoked','restaged','rebuilt','allWritersExcluded','forcedPointerRollbackAvailable','crashProofRollback','administratorAssistedRecoveryRequired','promoteExitCode','currentTarget','previousPointerObserved','httpsVerified','httpsFilesVerified','httpsOrigin','published','retainedBaselineFiles','reason','baselineEvidenceStillVerified','helpersMatchedAfter','differenceCount','differences','truncated'}
def safe_result(obj,r):
 out={k:v for k,v in obj.items() if k in ALLOWED}
 if 'currentTarget' in out:must(re.fullmatch(r'/var/www/kfaah-releases/[A-Za-z0-9_-]{1,100}',out['currentTarget']),'EVIDENCE_PATH_REJECTED')
 if 'differences' in out:
  rows=[]
  for item in out['differences'][:100]:
   path=item['path'];must(type(path) is str and 0<len(path.encode())<=4096 and not path.startswith('/') and '\\' not in path and not any(ord(ch)<32 or ord(ch)==127 for ch in path) and all(part not in ('','.','..') and len(part.encode())<=255 for part in path.split('/')),'EVIDENCE_PATH_REJECTED');row={'path':path}
   for key in ('expected','actual'):
    d=item.get(key)
    if d is not None:r.check(r.H64,d['sha256']);must(type(d['size']) is int and d['size']>=0);d={'sha256':d['sha256'],'size':d['size']}
    row[key]=d
   rows.append(row)
  out['differences']=rows
 return out

PARSER_HASHES={'parse_dependencies.cjs':'3ebbc25ed91264528995117917e467c746dfc1b19ef53af59d97b1819a22c070','vendor/acorn.cjs':'fdb08546776ec6228b03e8d02b40d4ab3255bae5f401adba7ff5dad927ac5c9c'}
BINDING_KEYS=('manifest_sha256','archive_sha256','source_sha','build_workflow_sha','build_run_id','build_attempt','artifact_id')
JS_LIMIT=256*1024*1024

def binding(q):return {key:q[key] for key in BINDING_KEYS}
def source_record(raw):return {'sha256':hashlib.sha256(raw).hexdigest(),'size':len(raw),'source':base64.b64encode(raw).decode('ascii')}
def parse_js_sources(sources,r):
 for name,sha in PARSER_HASHES.items():must(hashlib.sha256(r.read_regular(ROOT/name,2*1024*1024)).hexdigest()==sha,'ACORN_TOOL_BYTES_CHANGED')
 must(type(sources) is list and len(sources)<=10000,'ACORN_SOURCE_LIMIT')
 originals={};total=0
 for row in sources:
  must(type(row) is dict and set(row)=={'sha256','size','source'} and type(row['size']) is int and 0<=row['size']<=16*1024*1024 and type(row['source']) is str,'ACORN_SOURCE_REJECTED')
  r.check(r.H64,row['sha256']);raw=base64.b64decode(row['source'],validate=True)
  must(len(raw)==row['size'] and r.digest(raw)==row['sha256'] and row['sha256'] not in originals,'ACORN_SOURCE_IDENTITY_MISMATCH')
  originals[row['sha256']]=row['size'];total+=row['size']
 must(total<=JS_LIMIT,'ACORN_SOURCE_LIMIT');node=shutil.which('node');must(node is not None,'ACORN_NODE_UNAVAILABLE')
 result=subprocess.run([node,str(ROOT/'parse_dependencies.cjs')],input=json.dumps(sources).encode(),stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=60,check=False)
 must(result.returncode==0 and len(result.stdout)<=16*1024*1024,'ACORN_PARSE_NOT_CONFIRMED')
 graph=json.loads(result.stdout,object_pairs_hook=r.unique);must(type(graph) is dict and set(graph)==set(originals),'ACORN_OUTPUT_REJECTED')
 for sha,row in graph.items():
  must(type(row) is dict and set(row)=={'size','imports','computedImportCount','sourceType'} and type(row['size']) is int and row['size']==originals[sha] and row['sourceType'] in ('module','script'),'ACORN_OUTPUT_REJECTED')
  must(type(row['computedImportCount']) is int and 0<=row['computedImportCount']<=5000000 and type(row['imports']) is list and len(row['imports'])<=10000 and all(type(value) is str and len(value.encode())<=4096 for value in row['imports']),'ACORN_OUTPUT_REJECTED')
 return graph

def candidate_graph(files,r):
 # All candidate JS bytes are verified by r.verify before this pure AST parse.
 sources={r.digest(raw):source_record(raw) for path,raw in files.items() if path.lower().endswith('.js')}
 return parse_js_sources(list(sources.values()),r)

def preflight_inputs(raw,q,r,graph):
 must(len(raw)<=384*1024*1024 and len(raw.splitlines())==1,'ACORN_PREFLIGHT_RESPONSE_LIMIT')
 out=json.loads(raw,object_pairs_hook=r.unique)
 must(type(out) is dict and set(out)=={'phase','candidateBinding','promoterInvoked','ready','sources'} and out['phase']=='PUBLISH_DEPENDENCY_INPUTS' and out['candidateBinding']==binding(q) and out['promoterInvoked'] is False and type(out['ready']) is bool and type(out['sources']) is list and out['ready']==(not out['sources']),'ACORN_PREFLIGHT_RESPONSE_REJECTED')
 must(all(type(row) is dict and row.get('sha256') not in graph for row in out['sources']),'ACORN_PREFLIGHT_RESPONSE_REJECTED')
 return out

def complete_graph(q,approved,run_id,graph,s,r,stage_tools,build_tools,audit_workflow,command):
 for _ in range(16):
  code=remote_payload(stage_tools,build_tools,audit_workflow,q,approved,run_id,s,graph,'dependency-inputs')
  result=subprocess.run(command,input=code,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=1800,check=False)
  must(result.returncode==0,'ACORN_READ_ONLY_PREFLIGHT_NOT_CONFIRMED')
  out=preflight_inputs(result.stdout,q,r,graph)
  if out['ready']:return graph
  graph.update(parse_js_sources(out['sources'],r))
  must(len(graph)<=10000 and sum(row['size'] for row in graph.values())<=JS_LIMIT,'ACORN_SOURCE_LIMIT')
 raise ValueError('ACORN_DEPENDENCY_CLOSURE_NOT_COMPLETE')

def main():
 global EXECUTION_STATE
 EXECUTION_STATE="NOT_INVOKED"
 parser=argparse.ArgumentParser();parser.add_argument('action',choices=('plan','verify-run','verify-evidence','verify-dependencies','publish','show-evidence'))
 parser.add_argument('--stage-tools',type=Path,required=True);parser.add_argument('--build-tools',type=Path,required=True);parser.add_argument('--audit-workflow',type=Path,required=True);parser.add_argument('--stage-evidence',type=Path,default=Path('stage-evidence'));parser.add_argument('--bundle',type=Path,default=Path('sealed-bundle'))
 args=parser.parse_args()
 if args.action=='publish' and not EXECUTION_ENABLED:raise ValueError('PUBLISH_DISABLED_PENDING_REVIEW_AND_REAL_STAGE_SUCCESS')
 s,r,p=load_dependencies(args.stage_tools,args.build_tools)
 if args.action=='show-evidence':
  for file in Path('publish-evidence').glob('*.json'):
   print(json.dumps(safe_result(json.loads(r.read_regular(file,262144),object_pairs_hook=r.unique),r),sort_keys=True))
  return
 event=json.loads(r.read_regular(Path(os.environ['GITHUB_EVENT_PATH']),1048576),object_pairs_hook=r.unique);q=plan_request(event,os.environ['WORKFLOW_SHA'],os.environ['GITHUB_RUN_ATTEMPT'],r,s)
 if args.action=='plan':
  with open(os.environ['GITHUB_OUTPUT'],'a') as output:
   for key in ('stage_run_id','stage_artifact_id','build_run_id','artifact_id'):output.write(key+'='+q[key]+'\n')
  print('OWNER_PUBLISH_REQUEST_VALIDATED; PUBLISH_EXECUTION_DISABLED');return
 get=lambda suffix:s.api_get(os.environ['GH_TOKEN'],p,suffix)
 verify_stage_run(q,get);build_head=p.verify_run(q,get);s.publishers_quiet(get,os.environ['GITHUB_RUN_ID'],os.environ['WORKFLOW_SHA'])
 if args.action=='verify-run':print('STAGE_AND_BUILD_RUN_PROVENANCE_VERIFIED');return
 approved=evidence(q,args.stage_evidence,r)
 if args.action=='verify-evidence':print('IMMUTABLE_SUCCESSFUL_STAGE_EVIDENCE_VERIFIED');return
 manifest,files=r.verify(args.bundle,q['manifest_sha256'],q['archive_sha256']);p.compare_origin(manifest,q,build_head)
 graph=candidate_graph(files,r)
 if args.action=='verify-dependencies':
  print('IMMUTABLE_BUNDLE_JS_PARSED_BY_PINNED_ACORN; NO_APPLICATION_CODE_EXECUTED');return
 host=os.environ.get('HETZNER_HOST','');must(os.environ.get('HETZNER_USER')=='deploy' and re.fullmatch(r'(?:[A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9])',host))
 key=Path(os.environ['PUBLISH_KEY_DIR']);must(key.is_absolute())
 command=['/usr/bin/ssh','-F','/dev/null','-i',str(key/'key'),'-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+str(key/'known_hosts'),'-o','ConnectTimeout=15','deploy@'+host,'/usr/bin/env -i PATH=/usr/bin:/bin PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 -I -B -']
 EXECUTION_STATE='DEPENDENCY_PREFLIGHT'
 graph=complete_graph(q,approved,os.environ['GITHUB_RUN_ID'],graph,s,r,args.stage_tools,args.build_tools,args.audit_workflow,command)
 code=remote_payload(args.stage_tools,args.build_tools,args.audit_workflow,q,approved,os.environ['GITHUB_RUN_ID'],s,graph)
 EXECUTION_STATE='UNKNOWN'
 result=subprocess.run(command,input=code,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=3600,check=False)
 must(len(result.stdout)<=262144,'PUBLISH_EVIDENCE_LIMIT');rows=result.stdout.splitlines();must(len(rows)==1,'PUBLISH_RESULT_NOT_CONFIRMED')
 safe=safe_result(json.loads(rows[0],object_pairs_hook=r.unique),r)
 must(safe.get('phase')=='PUBLISH' and type(safe.get('promoterInvoked')) is bool and type(safe.get('published')) is bool,'PUBLISH_RESULT_NOT_CONFIRMED')
 EXECUTION_STATE='REPORTED'
 directory=Path('publish-evidence');directory.mkdir(exist_ok=True);(directory/'publish-result.json').write_bytes(r.canonical(safe))
 if result.returncode:raise SystemExit('PUBLISH_OR_VERIFICATION_FAILED; NO_FORCED_ROLLBACK_AVAILABLE')
def failure_message():
 if not EXECUTION_ENABLED:return 'PUBLISH_EXECUTION_DISABLED'
 if EXECUTION_STATE=='DEPENDENCY_PREFLIGHT':return 'PUBLISH_DEPENDENCY_PREFLIGHT_NOT_CONFIRMED; PROMOTER_NOT_INVOKED'
 if EXECUTION_STATE=='UNKNOWN':return 'PUBLISH_REMOTE_EXECUTION_STATE_UNKNOWN; ADMINISTRATOR_REVIEW_REQUIRED'
 if EXECUTION_STATE=='REPORTED':return 'PUBLISH_REPORTED_RESULT_OR_LOCAL_EVIDENCE_NOT_CONFIRMED; INSPECT_REPORTED_STATE'
 return 'PUBLISH_PRECHECK_NOT_CONFIRMED; REMOTE_NOT_INVOKED'
if __name__=='__main__':
 try:main()
 except (OSError,ValueError,subprocess.SubprocessError):raise SystemExit(failure_message()) from None
