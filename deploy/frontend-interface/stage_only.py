"""Owner STAGE_ONLY runner, reusing pinned PREPARE and readonly-preflight modules."""
import argparse, hashlib, importlib.util, json, os, re, subprocess, sys, types, urllib.request
from pathlib import Path
from channel_policy import approval
EXECUTION_ENABLED=False  # Keep live execution blocked until independent approval.
TOOLS_SHA=approval()['build_tools_commit']
AUDIT_SHA=approval()['audit_tools_commit']
CURRENT=approval()['expected_current']
BASELINE_SHA=approval()['baseline_manifest_sha256']
RECEIVE_SHA='5494cae6b5ae590f1528da9a3f48da5e0f0e978e013b0d9d161d4c99ff09c6c4'
PROMOTE_SHA='f10c0ea1e3c60a32b297515d63e338b06d7ecf8a7a18fd9efd7c6b9c729f8fbd'
TITLE='KFAAH_OWNER_STAGE_ONLY_V1'
REPO='Kfaah/Kfaah.sa'
HASHES={'release.py': 'a3689500b2a1b6be213f2c7a70274033168e1a53ff00a095ec24ad3274694a16', 'provenance.py': 'f8c0f20e7b1a5342fd7f770d5287e636520557732926ec363e67d3c8fc1c381b'}

def must(v):
 if not v:raise ValueError('STAGE_REQUEST_OR_DEPENDENCY_REJECTED')
def dependency_modules(tools):
 for name,sha in HASHES.items():must(hashlib.sha256((tools/name).read_bytes()).hexdigest()==sha)
 spec=importlib.util.spec_from_file_location('provenance',tools/'provenance.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
 return p.r,p

def request_from_event(event,workflow_sha,attempt,r):
 must(attempt=='1' and event.get('action')=='opened' and event.get('sender',{}).get('id')==341028123)
 must(event.get('repository',{}).get('full_name')==REPO and event.get('repository',{}).get('owner',{}).get('id')==341028123)
 i=event.get('issue',{});must(i.get('title')==TITLE and i.get('user',{}).get('id')==341028123 and i.get('author_association')=='OWNER' and 'pull_request' not in i)
 body=i.get('body');must(type(body) is str and len(body.encode())<=4096)
 q=json.loads(body,object_pairs_hook=r.unique)
 fields={'version','operation','workflow_sha','build_workflow_sha','source_sha','build_run_id','build_attempt','artifact_id','manifest_sha256','archive_sha256','expected_current','baseline_manifest_sha256','expected_receive_sha256','expected_promote_sha256','quiet_window_confirmed'}
 must(type(q) is dict and set(q)==fields and type(q['version']) is int and q['version']==1 and q['operation']=='STAGE_ONLY')
 r.check(r.H40,TOOLS_SHA);r.check(r.H40,AUDIT_SHA);r.check(r.H64,BASELINE_SHA)
 must(type(CURRENT) is str and re.fullmatch(r'/var/www/kfaah-releases/[A-Za-z0-9-]+',CURRENT))
 r.check(r.H40,workflow_sha);must(q['workflow_sha']==workflow_sha and q['build_workflow_sha']==TOOLS_SHA)
 r.check(r.H40,q['source_sha'])
 for k in ('build_run_id','build_attempt','artifact_id'):r.check(r.POSITIVE,q[k])
 for k in ('manifest_sha256','archive_sha256'):r.check(r.H64,q[k])
 must(q['expected_current']==CURRENT and q['baseline_manifest_sha256']==BASELINE_SHA and q['expected_receive_sha256']==RECEIVE_SHA and q['expected_promote_sha256']==PROMOTE_SHA and q['quiet_window_confirmed'] is True)
 return q

LEGACY_REPO='gaberalhrese-cloud/shop-soulmate-04'

def api_get(token,p,suffix,repository=REPO):
 must(repository in (REPO,LEGACY_REPO))
 req=urllib.request.Request('https://api.github.com/repos/'+repository+'/'+suffix,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'})
 opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),p.NoRedirect())
 try:
  with opener.open(req,timeout=20) as response:data=response.read(8*1024*1024+1)
  must(len(data)<=8*1024*1024);return json.loads(data,object_pairs_hook=p.r.unique)
 except Exception:raise ValueError('GITHUB_PROVENANCE_OR_ACTIVITY_NOT_CONFIRMED') from None

def nonapplicable_issue_peer(row,get,workflow_sha):
 expected={'.github/workflows/kfaah-owner-stage-only.yml':{'review','stage'},'.github/workflows/kfaah-owner-publish.yml':{'review','publish'}}
 names=expected.get(row.get('path'))
 if not names or not workflow_sha or row.get('event')!='issues' or row.get('head_branch')!='main' or row.get('head_sha')!=workflow_sha or type(row.get('id')) is not int or row.get('run_attempt')!=1:return False
 obj=get('actions/runs/'+str(row['id'])+'/attempts/1/jobs?per_page=100')
 jobs=obj.get('jobs')
 # Only exact known job sets that are already proven skipped are exempted.
 # Empty, pending, executing, foreign-head or partial job evidence stays blocking.
 return type(jobs) is list and obj.get('total_count')==len(names)==len(jobs) and all(type(job) is dict for job in jobs) and {job.get('name') for job in jobs}==names and all(job.get('status')=='completed' and job.get('conclusion')=='skipped' for job in jobs)

def _publishers_quiet_single(get,this_run,workflow_sha=None):
 for status in ('queued','in_progress','waiting','pending','requested'):
  for page in range(1,11):
   obj=get('actions/runs?status='+status+'&per_page=100&page='+str(page));rows=obj['workflow_runs']
   for row in rows:
    path=row.get('path','').lower()
    if row.get('id')!=int(this_run) and any(w in path for w in ('publish','deploy','manager','release','stage-only')):
     if nonapplicable_issue_peer(row,get,workflow_sha):continue
     raise ValueError('KNOWN_GITHUB_PUBLISHER_ACTIVE')
   if len(rows)<100:break
  else:raise ValueError('PUBLISHER_SCAN_INCOMPLETE')

def publishers_quiet(get,this_run,workflow_sha=None,legacy_get=None):
 _publishers_quiet_single(get,this_run,workflow_sha)
 if legacy_get is None:raise ValueError('LEGACY_PUBLISHER_STATE_NOT_CONFIRMED')
 _publishers_quiet_single(legacy_get,this_run,None)

def legacy_reader(p):
 token=os.environ.get('KFAAH_LEGACY_READ_TOKEN','')
 if not token:raise ValueError('LEGACY_READONLY_TOKEN_REQUIRED')
 return lambda suffix:api_get(token,p,suffix,LEGACY_REPO)

def approved_audit_source(file):
 raw=file.read_bytes();must(hashlib.sha256(raw).hexdigest()=='c0256667ac20a8e9ec4a79ecf3059368846867711ea326c8f077c43b9731c942')
 text=raw.decode();start=text.index('          import hashlib, json, os, pwd, stat, time\n');end=text.index('          PYTHON\n',start)
 code='\n'.join(line[10:] for line in text[start:end].splitlines())+'\n';compile(code,'approved-audit','exec');return code

def payload(tools,auditfile,remote,request,phase,run_id,attempt):
 # Only approved source files are compiled remotely; issue text is serialized data.
 code='import types,sys,json\n'
 for name,source in [('approved_audit',approved_audit_source(auditfile)),('approved_release',(tools/'release.py').read_text())]:
  code+='m=types.ModuleType('+repr(name)+');sys.modules['+repr(name)+']=m\n'
  code+='exec(compile('+repr(source)+','+repr(name)+',"exec"),m.__dict__)\n'
 code+='namespace={"__name__":"remote_stage"}\nexec(compile('+repr(remote.read_text())+',"remote_stage","exec"),namespace)\n'
 code+='namespace["main"](json.loads('+repr(json.dumps(request))+'),'+repr(phase)+','+repr(run_id)+','+repr(attempt)+')\n'
 return code.encode()

def sanitize(obj,r):
 must(type(obj) is dict)
 # Import definitions only; no remote operation or audit main is run.
 sys.modules['approved_release']=r
 sys.modules['approved_audit']=types.ModuleType('approved_audit')
 file=Path(__file__).with_name('remote_stage.py')
 spec=importlib.util.spec_from_file_location('evidence_filter',file);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 return module.safe_evidence(obj)

def main():
 parser=argparse.ArgumentParser();parser.add_argument('action',choices=('plan','verify','backup','stage','evidence'))
 parser.add_argument('--tools',type=Path,required=True);parser.add_argument('--audit-workflow',type=Path,required=True);parser.add_argument('--bundle',type=Path,default=Path('sealed-bundle'))
 args=parser.parse_args()
 if args.action in ('backup','stage') and not EXECUTION_ENABLED:raise ValueError('BLOCKED_PENDING_INDEPENDENT_APPROVAL')
 r,p=dependency_modules(args.tools)
 event=json.loads(r.read_regular(Path(os.environ['GITHUB_EVENT_PATH']),1048576),object_pairs_hook=r.unique)
 q=request_from_event(event,os.environ['WORKFLOW_SHA'],os.environ['GITHUB_RUN_ATTEMPT'],r)
 run_id=r.check(r.POSITIVE,os.environ['GITHUB_RUN_ID']);attempt=os.environ['GITHUB_RUN_ATTEMPT']
 if args.action=='plan':
  with open(os.environ['GITHUB_OUTPUT'],'a') as out:
   for key in ('build_run_id','artifact_id'):out.write(key+'='+q[key]+'\n')
  print('OWNER_STAGE_ONLY_REQUEST_ACCEPTED');return
 if args.action=='evidence':
  for file in sorted(Path('stage-evidence').glob('*-result.jsonl')):
   for raw in file.read_bytes().splitlines():
    must(len(raw)<=262144);print(json.dumps(sanitize(json.loads(raw),r),sort_keys=True))
  return
 token=os.environ.get('GH_TOKEN','');must(bool(token));get=lambda suffix:api_get(token,p,suffix)
 head=p.verify_run(q,get);publishers_quiet(get,run_id,os.environ['WORKFLOW_SHA'],legacy_reader(p))
 if args.action=='verify':
  manifest,_=r.verify(args.bundle,q['manifest_sha256'],q['archive_sha256']);p.compare_origin(manifest,q,head)
  print('STAGE_CANDIDATE_GITHUB_PROVENANCE_AND_BYTES_VERIFIED');return
 manifest,_=r.verify(args.bundle,q['manifest_sha256'],q['archive_sha256']);p.compare_origin(manifest,q,head)
 host=os.environ.get('HETZNER_HOST','');must(os.environ.get('HETZNER_USER')=='deploy' and re.fullmatch(r'(?:[A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9])',host))
 key=Path(os.environ['STAGE_KEY_DIR']);must(key.is_absolute())
 common=['-F','/dev/null','-i',str(key/'key'),'-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+str(key/'known_hosts'),'-o','ConnectTimeout=15','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=2']
 if args.action=='stage':
  txn='/home/deploy/frontend-stage-backups/stage-'+run_id+'-'+attempt
  # Exactly two verified files, fixed private deploy-owned candidate directory.
  subprocess.run(['/usr/bin/scp',*common,str(args.bundle/'manifest.json'),str(args.bundle/'bundle.tar'),'deploy@'+host+':'+txn+'/candidate/'],check=True,timeout=600,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 code=payload(args.tools,args.audit_workflow,Path(__file__).with_name('remote_stage.py'),q,args.action,run_id,attempt)
 command=['/usr/bin/ssh',*common,'deploy@'+host,'/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I -']
 log=Path('stage-evidence');log.mkdir(exist_ok=True)
 result=subprocess.run(command,input=code,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=1800,check=False)
 must(len(result.stdout)<=262144)
 records=[]
 for raw in result.stdout.splitlines():records.append(sanitize(json.loads(raw),r))
 with (log/(args.action+'-result.jsonl')).open('wb') as out:
  for row in records:out.write(r.canonical(row))
 print('STAGE_ONLY_PHASE='+args.action+' EXIT='+str(result.returncode))
 if result.returncode:raise SystemExit(result.returncode)
if __name__=='__main__':
 try:main()
 except (OSError,ValueError,subprocess.SubprocessError):raise SystemExit('STAGE_ONLY_STOPPED; INSPECT_SAFE_PHASE_EVIDENCE') from None
