"""Fixed deploy-user STAGE_ONLY operations; loaded with pinned audited modules."""
import ctypes, errno, fcntl, hashlib, json, os, pwd, stat, subprocess, time, uuid
from pathlib import Path
import approved_audit as a
import approved_release as r
BASE='/home/deploy/frontend-stage-backups'
INCOMING='/home/deploy/incoming'
STAGING='/var/www/kfaah-staging'
LEGACY='/var/www/kfaah'
LOG='/var/log/kfaah-deploy.log'
EXECUTION_ENABLED=True  # Independent approval of the revised code is still required.

EVIDENCE_FIELDS={'phase','result','reason','backupPath','manifestSha256','contentSha256','counts','baselineBytesVerified','contentExported','stagingBeforePreserved','stagingBeforeContentSha256','baselineContentSha256','promoteInvoked','receiverInvoked','receiverSourceReviewed','allWritersExcluded','quietWindowAssertion','automaticRootRecovery','expectedHtmlInjection','legacyBadgeSha256','retainedFileCount','receiveExitCode','differenceCount','differences','truncated','stagingMatchesReceiverModel','incomingRecovery','incomingCandidateRetained','oldIncomingNeverDeleted','currentBaselineMatchedBeforeAfter','baselineStillVerified','helpersMatchedBeforeAfter'}
def safe_evidence(obj):
 out={key:value for key,value in obj.items() if key in EVIDENCE_FIELDS}
 if 'counts' in out:
  keys={'entries','files','directories','bytes','symlinks','hardlinks','special','unprotected'}
  out['counts']={k:v for k,v in out['counts'].items() if k in keys and type(v) is int and v>=0}
 if 'differences' in out:
  rows=[]
  for row in out['differences'][:100]:
   path=frontend_name(row['path']);item={'path':path}
   for key in ('expected','actual'):
    value=row.get(key)
    if value is not None:
     r.check(r.H64,value['sha256']);must(type(value['size']) is int and value['size']>=0,'EVIDENCE_SIZE_REJECTED');value={'sha256':value['sha256'],'size':value['size']}
    item[key]=value
   rows.append(item)
  out['differences']=rows
 for key in ('manifestSha256','contentSha256','stagingBeforeContentSha256','baselineContentSha256','legacyBadgeSha256'):
  if out.get(key) is not None:r.check(r.H64,out[key])
 return out
def emit(o):print(json.dumps(safe_evidence(o),sort_keys=True,separators=(',',':')),flush=True)
def must(v,msg):
 if not v:raise ValueError(msg)
def safe_component(v):
 must(type(v) is str and v not in ('','.','..') and '/' not in v,'COMPONENT_REJECTED')
 return v

def private_dir(path,create=False):
 path=Path(path);fd=r.open_directory(path.parent,(0,1000),1000 if str(path.parent).startswith('/home/deploy') else None)
 try:
  if create:os.mkdir(path.name,0o700,dir_fd=fd)
  child=os.open(path.name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd)
  s=os.fstat(child)
  if s.st_uid!=1000 or stat.S_IMODE(s.st_mode)!=0o700:os.close(child);raise ValueError('PRIVATE_DIRECTORY_REJECTED')
  return child
 finally:os.close(fd)

def frontend_name(relative):
 r.name('/'.join('well-known' if part=='.well-known' else part for part in relative.split('/')))
 return relative
def static_name(relative):
 frontend_name(relative)
 return Path(relative).suffix.lower() in r.SUFFIXES or '.well-known' in relative.split('/') or Path(relative).name.startswith('index.html.bak')

def relative_parent(rootfd,relative,create=False,directory_mode=0o700):
 frontend_name(relative);parts=relative.split('/');fd=os.dup(rootfd)
 try:
  for part in parts[:-1]:
   if create:
    try:os.mkdir(part,directory_mode,dir_fd=fd)
    except FileExistsError:pass
   child=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd)
   os.close(fd);fd=child
  return fd,parts[-1]
 except BaseException:os.close(fd);raise

def immutable_bytes(parent,name,data,mode=0o600):
 safe_component(name);fd=os.open(name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode,dir_fd=parent)
 try:
  with os.fdopen(os.dup(fd),'wb') as out:out.write(data);out.flush();os.fsync(out.fileno())
  os.fchmod(fd,mode)
 finally:os.close(fd)
 os.fsync(parent)

def content_row(row):
 out={'path':row['path'],'type':row['type']}
 if row['type']=='file':out|={'size':row['size'],'sha256':row['sha256']}
 return out

def content_scan(path,protect=False):
 h=hashlib.sha256()
 def visit(record):
  row=record['entry'];must(row['type'] in ('directory','file'),'NONREGULAR_BASELINE');must(row['uid']==(0 if protect else 1000),'BASELINE_COPY_OWNER')
  if row['path']!='.':
   frontend_name(row['path'])
   if row['type']=='file':must(static_name(row['path']),'NONSTATIC_BASELINE')
  must(row['nlink']==1 if row['type']=='file' else True,'BASELINE_HARDLINK')
  must(not (int(row['mode'],8)&0o7022),'UNPROTECTED_BASELINE')
  h.update(a.canonical(content_row(row)))
 result=a.scan(path,output=visit,protect=protect)
 return h.hexdigest(),result

def baseline_copy(source,dest,manifest_path,expected_sha,protect=True,source_owners=(0,)):
 """Streaming historical copy; uses audited scanner's million-entry limit, no byte cap."""
 os.mkdir(dest,0o700);sourcefd=a.directory(source,protect);destfd=r.open_directory(dest)
 content=hashlib.sha256();manifest=hashlib.sha256();manifestfd=os.open(manifest_path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:
  def visit(record):
   row=record['entry'];must(row['type'] in ('file','directory'),'BASELINE_NONREGULAR')
   must(row['uid'] in source_owners if source_owners is not None else True,'BASELINE_OWNER')
   must(not int(row['mode'],8)&0o7022,'BASELINE_MODE')
   if row['path']!='.':frontend_name(row['path'])
   if row['type']=='directory':
    if row['path']!='.':
     parent,name=relative_parent(destfd,row['path'],True)
     try:os.mkdir(name,0o700,dir_fd=parent);os.fsync(parent)
     finally:os.close(parent)
   else:
    must(row['nlink']==1 and static_name(row['path']),'BASELINE_FILE_REJECTED')
    srcparent,name=relative_parent(sourcefd,row['path']);dstparent,_=relative_parent(destfd,row['path'])
    src=dst=None
    try:
     src=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=srcparent)
     before=os.fstat(src);must(a.descriptor(row['path'],before)=={k:v for k,v in row.items() if k!='sha256'},'COPY_SOURCE_REPLACED')
     dst=os.open(name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=dstparent);h=hashlib.sha256();size=0
     while True:
      chunk=os.read(src,1048576)
      if not chunk:break
      size+=len(chunk);must(size<=row['size'],'COPY_SOURCE_GREW');h.update(chunk)
      view=memoryview(chunk)
      while view:view=view[os.write(dst,view):]
     must(size==row['size'] and h.hexdigest()==row['sha256'] and a.meta(before)==a.meta(os.fstat(src)) and a.meta(before)==a.meta(os.stat(name,dir_fd=srcparent,follow_symlinks=False)),'COPY_SOURCE_CHANGED')
     os.fsync(dst);os.fsync(dstparent)
    finally:
     if src is not None:os.close(src)
     if dst is not None:os.close(dst)
     os.close(srcparent);os.close(dstparent)
   raw=a.canonical(row);manifest.update(raw);content.update(a.canonical(content_row(row)))
   view=memoryview(raw)
   while view:view=view[os.write(manifestfd,view):]
  original=a.scan(source,output=visit,protect=protect)
  must(original['manifestSha256']==manifest.hexdigest()==expected_sha,'BASELINE_APPROVAL_MISMATCH')
  second=a.scan(source,output=None,protect=protect);must(second==original,'BASELINE_CHANGED_DURING_COPY')
  cloned_sha,cloned=content_scan(dest)
  must(cloned_sha==content.hexdigest() and cloned['counts']['files']==original['counts']['files'] and cloned['counts']['bytes']==original['counts']['bytes'],'BACKUP_BYTES_MISMATCH')
  os.fsync(manifestfd);os.fsync(destfd)
  return {'originalManifestSha256':expected_sha,'contentSha256':cloned_sha,'counts':original['counts']}
 finally:os.close(manifestfd);os.close(sourcefd);os.close(destfd)

def helpers():
 rows=[a.helper_hash(n) for n in sorted(a.HELPERS)];must(all(row['expectedMatch'] for row in rows),'HELPER_IDENTITY_MISMATCH');return rows

def current_check(request):
 parent=a.directory('/var/www')
 try:
  before=a.pointer(parent,request['expected_current']);s=a.scan(request['expected_current'],output=None)
  must(s['manifestSha256']==request['baseline_manifest_sha256'] and before==a.pointer(parent,request['expected_current']),'CURRENT_BASELINE_CHANGED')
  must(not any(s['counts'][k] for k in ('symlinks','hardlinks','special','unprotected')),'CURRENT_UNSAFE')
  return before,s
 finally:os.close(parent)

def backup(request,txn):
 parent=a.directory('/var/www');before=a.pointer(parent,request['expected_current'])
 try:
  verified_before,_=current_check(request);must(before==verified_before,'CURRENT_CHANGED_BEFORE_BACKUP')
  must(a.known_processes()['matchingCount']==0,'KNOWN_SERVER_HELPER_ACTIVE')
  helpers();private=None
  try:
   try:basefd=private_dir(BASE)
   except FileNotFoundError:basefd=private_dir(BASE,True)
   try:os.mkdir(Path(txn).name,0o700,dir_fd=basefd);os.fsync(basefd)
   finally:os.close(basefd)
   private=private_dir(txn)
   original=baseline_copy(request['expected_current'],txn+'/baseline',txn+'/baseline-manifest.jsonl',request['baseline_manifest_sha256'])
   must(before==a.pointer(parent,request['expected_current']),'CURRENT_POINTER_CHANGED')
   os.mkdir('candidate',0o700,dir_fd=private)
   ready={'version':1,'createdUtc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'current':request['expected_current'],**original}
   staging_ready=preserve_staging(txn)
   must(before==a.pointer(parent,request['expected_current']),'CURRENT_CHANGED_DURING_STAGING_BACKUP')
   immutable_bytes(private,'baseline-ready.json',a.canonical(ready));os.fsync(private)
   return {'phase':'BACKUP_READY','backupPath':txn+'/baseline','manifestSha256':original['originalManifestSha256'],'contentSha256':original['contentSha256'],'counts':original['counts'],'baselineBytesVerified':True,'currentBaselineMatchedBeforeAfter':True,'contentExported':False,'stagingBeforePreserved':True,'stagingBeforeContentSha256':staging_ready['contentSha256']}
  finally:
   if private is not None:os.close(private)
 finally:os.close(parent)

def verify_backup(txn,request):
 fd=private_dir(txn);os.close(fd)
 ready=json.loads(r.read_regular(txn+'/baseline-ready.json',16384),object_pairs_hook=r.unique)
 must(ready.get('current')==request['expected_current'] and ready.get('originalManifestSha256')==request['baseline_manifest_sha256'],'BACKUP_READY_MISMATCH')
 # Baseline JSONL may exceed the new-bundle 4MiB manifest limit; stream it.
 manifest=hashlib.sha256();content=hashlib.sha256();f=os.open(txn+'/baseline-manifest.jsonl',os.O_RDONLY|os.O_NOFOLLOW)
 try:
  s=os.fstat(f);must(stat.S_ISREG(s.st_mode) and s.st_uid==1000 and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o600,'BACKUP_MANIFEST_UNPROTECTED')
  with os.fdopen(os.dup(f),'rb') as stream:
   for raw in stream:
    must(len(raw)<=1048576,'BASELINE_RECORD_LIMIT');row=json.loads(raw,object_pairs_hook=r.unique);must(a.canonical(row)==raw,'BASELINE_MANIFEST_NONCANONICAL')
    manifest.update(raw);content.update(a.canonical(content_row(row)))
  must(a.meta(s)==a.meta(os.fstat(f)),'BASELINE_MANIFEST_CHANGED')
 finally:os.close(f)
 sha,copied=content_scan(txn+'/baseline')
 must(manifest.hexdigest()==request['baseline_manifest_sha256'] and content.hexdigest()==sha==ready.get('contentSha256'),'BACKUP_CHANGED')
 must(copied['counts']['files']==ready['counts']['files'] and copied['counts']['bytes']==ready['counts']['bytes'],'BACKUP_COUNTS_CHANGED')
 return ready

def root_identity(info):
 return {'dev':info.st_dev,'ino':info.st_ino,'uid':info.st_uid,'mode':stat.S_IMODE(info.st_mode)}
def dir_identity(parent,name):
 try:s=os.stat(name,dir_fd=parent,follow_symlinks=False)
 except FileNotFoundError:return None
 must(stat.S_ISDIR(s.st_mode) and s.st_uid==1000 and not s.st_mode&0o7022,'INCOMING_CONTAINER_UNSAFE')
 return root_identity(s)
def rename_noreplace(parent,source,target):
 safe_component(source);safe_component(target)
 libc=ctypes.CDLL(None,use_errno=True)
 function=getattr(libc,'renameat2',None);must(function is not None,'ATOMIC_NOREPLACE_UNAVAILABLE')
 function.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint];function.restype=ctypes.c_int
 if function(parent,os.fsencode(source),parent,os.fsencode(target),1)!=0:
  number=ctypes.get_errno();raise OSError(number,os.strerror(number))
 os.fsync(parent)
def journal_write(txn,state):
 fd=private_dir(txn);temporary='swap-journal-'+uuid.uuid4().hex
 try:
  immutable_bytes(fd,temporary,a.canonical(state))
  try:
   old=os.stat('incoming-swap.json',dir_fd=fd,follow_symlinks=False)
   must(stat.S_ISREG(old.st_mode) and old.st_uid==1000 and old.st_nlink==1 and stat.S_IMODE(old.st_mode)==0o600,'JOURNAL_UNSAFE')
  except FileNotFoundError:pass
  os.replace(temporary,'incoming-swap.json',src_dir_fd=fd,dst_dir_fd=fd);os.fsync(fd)
 finally:os.close(fd)
def journal_read(txn):
 fd=private_dir(txn);os.close(fd)
 return json.loads(r.read_regular(txn+'/incoming-swap.json',16384),object_pairs_hook=r.unique)
def swap_names(txn):
 suffix=Path(txn).name
 must(suffix.startswith('stage-'),'TRANSACTION_NAME_REJECTED')
 parts=suffix.split('-');must(len(parts)==3 and parts[0]=='stage' and parts[2]=='1','TRANSACTION_NAME_REJECTED');r.check(r.POSITIVE,parts[1])
 prefix='incoming.stage-only-'+parts[1]+'-'+parts[2]
 return {'incoming':Path(INCOMING).name,'candidate':prefix+'.candidate','previous':prefix+'.previous','retained':prefix+'.retained'}
def prepare_incoming(files,txn):
 r.validate(files);names=swap_names(txn);parent=r.open_directory(Path(INCOMING).parent,(0,1000),1000)
 try:
  must(not Path(txn+'/incoming-swap.json').exists(),'SWAP_ALREADY_EXISTS')
  for key in ('candidate','previous','retained'):must(dir_identity(parent,names[key]) is None,'UNIQUE_SWAP_PATH_EXISTS')
  original=dir_identity(parent,names['incoming'])
  os.mkdir(names['candidate'],0o700,dir_fd=parent);candidate=os.open(names['candidate'],os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent)
  try:
   for relative,data in sorted(files.items()):
    fd,name=relative_parent(candidate,relative,True,0o755)
    try:immutable_bytes(fd,name,data,0o644)
    finally:os.close(fd)
   os.fchmod(candidate,0o755);os.fsync(candidate)
   identity=root_identity(os.fstat(candidate));must(identity['dev']==os.fstat(parent).st_dev and (original is None or original['dev']==identity['dev']),'CROSS_FILESYSTEM_SWAP_REJECTED')
  finally:os.close(candidate)
  candidate_path=str(Path(INCOMING).parent/names['candidate'])
  must(r.file_map(r.snapshot(candidate_path,1000,True,(0,1000)))==r.file_map(files),'PREPARED_CANDIDATE_MISMATCH')
  state={'version':1,'phase':'PREPARED','names':names,'original':original,'candidate':identity}
  journal_write(txn,state);os.fsync(parent);return state
 finally:os.close(parent)
def install_incoming(txn,checkpoint=lambda name:None):
 state=journal_read(txn);parent=r.open_directory(Path(INCOMING).parent,(0,1000),1000);names=state['names']
 try:
  must(names==swap_names(txn) and state['phase']=='PREPARED','SWAP_STATE_REJECTED')
  must(dir_identity(parent,names['incoming'])==state['original'] and dir_identity(parent,names['candidate'])==state['candidate'],'SWAP_IDENTITY_CHANGED')
  state['phase']='PRESERVING_ORIGINAL';journal_write(txn,state);checkpoint('before-preserve')
  if state['original'] is not None:rename_noreplace(parent,names['incoming'],names['previous'])
  checkpoint('after-preserve')
  state['phase']='INSTALLING_CANDIDATE';journal_write(txn,state)
  rename_noreplace(parent,names['candidate'],names['incoming']);checkpoint('after-install')
  state['phase']='INSTALLED';journal_write(txn,state)
 finally:os.close(parent)
def recover_incoming(txn,receiver_stopped_confirmed=False,checkpoint=lambda name:None):
 state=journal_read(txn);names=state['names'];must(names==swap_names(txn),'RECOVERY_NAMES_REJECTED')
 must(state['phase'] not in ('RECEIVER_RUNNING','RECEIVER_STATUS_UNKNOWN') or receiver_stopped_confirmed,'RECEIVER_STOP_CONFIRMATION_REQUIRED')
 parent=r.open_directory(Path(INCOMING).parent,(0,1000),1000)
 try:
  original=state['original'];current=dir_identity(parent,names['incoming']);previous=dir_identity(parent,names['previous'])
  candidate=state['candidate'];retained=dir_identity(parent,names['retained'])
  must(retained in (None,candidate),'RETAINED_IDENTITY_CHANGED')
  if current==original and previous is None:
   result='ORIGINAL_INCOMING_PRESENT' if original else 'ORIGINAL_INCOMING_ABSENCE_PRESENT'
  else:
   must(previous==original,'ORIGINAL_BACKUP_NOT_CONFIRMED')
   if current is not None:
    must(current==candidate and retained is None,'UNKNOWN_INCOMING_NOT_OVERWRITTEN')
    rename_noreplace(parent,names['incoming'],names['retained']);checkpoint('after-retain')
   if original is not None:rename_noreplace(parent,names['previous'],names['incoming']);checkpoint('after-restore')
   must(dir_identity(parent,names['incoming'])==original,'ORIGINAL_RESTORE_NOT_CONFIRMED');result='ORIGINAL_INCOMING_RESTORED'
  state['phase']='RESTORED';journal_write(txn,state)
  return {'incomingRecovery':result,'incomingCandidateRetained':dir_identity(parent,names['retained'])==candidate,'oldIncomingNeverDeleted':True}
 finally:os.close(parent)

def difference(expected,actual):
 e=r.file_map(expected);s=r.file_map(actual);rows=[]
 for path in sorted(set(e)|set(s)):
  if e.get(path)!=s.get(path):rows.append({'path':path,'expected':e.get(path),'actual':s.get(path)})
 bounded=[];size=0
 for row in rows[:100]:
  raw=a.canonical(row)
  if size+len(raw)>131072:break
  bounded.append(row);size+=len(raw)
 return {'differenceCount':len(rows),'differences':bounded,'truncated':len(rows)>len(bounded),'badgeCandidateOnly':bool(rows) and all(row['path'] in ('index.html','hide-badge.js') for row in rows),'automaticAcceptance':False}

def excluded(relative):
 return any(part=='hide-badge.js' or part=='.well-known' or part.startswith('index.html.bak') for part in relative.split('/'))
def tree_inventory(path,owners,exact_modes=False):
 files={};directories=[]
 def visit(record):
  row=record['entry'];must(row['type'] in ('directory','file') and row['uid'] in owners and not int(row['mode'],8)&0o7022,'RECEIVER_TREE_UNSAFE')
  if row['path']!='.':frontend_name(row['path'])
  if exact_modes:must(int(row['mode'],8)==(0o644 if row['type']=='file' else 0o755),'RECEIVER_MODE_MISMATCH')
  if row['type']=='file':
   must(row['nlink']==1 and static_name(row['path']),'RECEIVER_FILE_UNSAFE');files[row['path']]={'sha256':row['sha256'],'size':row['size']}
  else:directories.append(row['path'])
 result=a.scan(path,output=visit,protect=False)
 return {'files':files,'directories':directories,'scan':result}
def receiver_paths(post=False):
 # No new root permission; refuse redirected or writable root destinations.
 root=r.open_directory('/var/www',(0,));os.close(root)
 stage=r.open_directory(STAGING,(0,),33);os.close(stage)
 inventory=tree_inventory(STAGING,(0,33),post)
 must('hide-badge.js' not in inventory['directories'],'BADGE_DESTINATION_IS_DIRECTORY')
 log_parent=r.open_directory(Path(LOG).parent,(0,))
 try:
  try:
   info=os.stat(Path(LOG).name,dir_fd=log_parent,follow_symlinks=False)
   must(stat.S_ISREG(info.st_mode) and info.st_uid==0 and info.st_nlink==1 and not info.st_mode&0o7022,'LOG_UNSAFE')
   log_identity=root_identity(info)
  except FileNotFoundError:log_identity=None
 finally:os.close(log_parent)
 legacy=None;legacy_identity=None
 try:
  fd=r.open_directory(LEGACY,(0,),0)
 except FileNotFoundError:fd=None
 if fd is not None:
  try:
   legacy_identity=root_identity(os.fstat(fd))
   try:
    info=os.stat('hide-badge.js',dir_fd=fd,follow_symlinks=False)
    must(stat.S_ISREG(info.st_mode) and info.st_uid in (0,33) and info.st_nlink==1 and not info.st_mode&0o7022,'LEGACY_BADGE_UNSAFE')
    data=r.read_regular(Path(LEGACY)/'hide-badge.js',r.MAX_BYTES)
    must(a.meta(info)==a.meta(os.stat('hide-badge.js',dir_fd=fd,follow_symlinks=False)),'LEGACY_BADGE_CHANGED')
    legacy={'sha256':r.digest(data),'size':len(data)}
   except FileNotFoundError:pass
  finally:os.close(fd)
 return {'inventory':inventory,'legacyBadge':legacy,'legacyDirectoryIdentity':legacy_identity,'logIdentity':log_identity}
def receiver_model(incoming,index_bytes,previous,legacy_badge):
 expected={p:d for p,d in incoming['files'].items() if not excluded(p)}
 expected.update({p:d for p,d in previous['files'].items() if excluded(p)})
 if legacy_badge is not None:expected['hide-badge.js']=legacy_badge
 text=index_bytes.decode('utf-8',errors='replace')
 injected='hide-badge.js' not in text and '</head>' in text
 if injected:
  transformed=text.replace('</head>','<script src="/hide-badge.js"></script></head>',1).encode('utf-8')
  expected['index.html']={'sha256':r.digest(transformed),'size':len(transformed)}
 dirs={'.'}
 for p in expected:
  dirs.update(parent.as_posix() for parent in Path(p).parents)
 dirs.update(d for d in previous['directories'] if excluded(d))
 return {'files':expected,'directories':sorted(dirs),'htmlInjectionExpected':injected,'badgeReferenceMissing':(injected or 'hide-badge.js' in text) and 'hide-badge.js' not in expected}
def descriptor_diff(expected,actual):
 rows=[{'path':p,'expected':expected.get(p),'actual':actual.get(p)} for p in sorted(set(expected)|set(actual)) if expected.get(p)!=actual.get(p)]
 bounded=[];size=0
 for row in rows[:100]:
  raw=a.canonical(row)
  if size+len(raw)>131072:break
  bounded.append(row);size+=len(raw)
 return {'differenceCount':len(rows),'differences':bounded,'truncated':len(rows)>len(bounded)}
def preserve_staging(txn):
 observed=receiver_paths();original=observed['inventory']['scan'];sha=original['manifestSha256']
 copy=baseline_copy(STAGING,txn+'/staging-before',txn+'/staging-manifest.jsonl',sha,False,(0,33))
 ready={'version':1,'source':STAGING,'createdUtc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),**copy}
 fd=private_dir(txn)
 try:immutable_bytes(fd,'staging-ready.json',a.canonical(ready))
 finally:os.close(fd)
 return ready
def verified_staging_backup(txn):
 ready=json.loads(r.read_regular(txn+'/staging-ready.json',16384),object_pairs_hook=r.unique)
 must(ready.get('source')==STAGING,'STAGING_BACKUP_SOURCE_REJECTED')
 digest,scanned=content_scan(txn+'/staging-before')
 must(digest==ready['contentSha256'] and scanned['counts']['files']==ready['counts']['files'] and scanned['counts']['bytes']==ready['counts']['bytes'],'STAGING_BACKUP_CHANGED')
 return tree_inventory(txn+'/staging-before',(1000,)),ready
def staging_recovery_plan(txn):
 # Prepare only a deploy-owned copy. It never calls sudo or assumes staging rename rights.
 saved,ready=verified_staging_backup(txn);observed=receiver_paths()
 must(a.known_processes()['matchingCount']==0,'KNOWN_SERVER_HELPER_ACTIVE')
 target=txn+'/manual-staging-recovery'
 copy=baseline_copy(txn+'/staging-before',target,txn+'/manual-staging-recovery-manifest.jsonl',saved['scan']['manifestSha256'],False,(1000,))
 must(copy['contentSha256']==ready['contentSha256'],'RECOVERY_CANDIDATE_CHANGED')
 inventory=tree_inventory(target,(1000,));page=r.read_regular(Path(target)/'index.html',r.MAX_MANIFEST)
 assets=subprocess.run(['/usr/bin/grep','-REiq',r'https://[a-z0-9]+\.supabase\.co|lovable\.app',target+'/assets'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=300,check=False)
 must(assets.returncode==1,'OLD_STAGING_ASSETS_RECEIVER_INELIGIBLE')
 must(b'<div id="root"' in page and not __import__('re').search(rb'supabase\.co|lovable\.app|lovable\.dev|Made with Lovable|lovable-badge',page,__import__('re').I),'OLD_STAGING_RECEIVER_INELIGIBLE')
 expected=receiver_model(inventory,page,observed['inventory'],observed['legacyBadge'])
 difference=descriptor_diff(saved['files'],expected['files'])
 return {'recoveryCandidatePath':target,'receiverInvocation':['/usr/bin/sudo','-n','--','/usr/local/bin/kfaah-receive-frontend','/home/deploy/incoming'],
         'expectedFiles':expected['files'],'expectedDirectories':expected['directories'],
         'bytePerfectStagingPossible':difference['differenceCount']==0 and sorted(saved['directories'])==expected['directories'],
         'differenceFromSavedStaging':difference,'automaticRootRecovery':False,
         'manualPrerequisites':['independent approval','confirmed receiver termination','operational quiet window','recheck fixed path guards','validated recovery candidate installed at fixed incoming','post-receive historical inventory comparison','incoming recovery from preserved directory']}
def prepare_historical_recovery_incoming(plan,recovery_txn):
 """Manual preparation only; unlimited historical validator, no receiver invocation."""
 source=plan['recoveryCandidatePath'];inventory=tree_inventory(source,(1000,));source_content,_=content_scan(source)
 names=swap_names(recovery_txn);parent=r.open_directory(Path(INCOMING).parent,(0,1000),1000)
 try:
  must(not Path(recovery_txn+'/incoming-swap.json').exists(),'RECOVERY_TRANSACTION_EXISTS')
  for key in ('candidate','previous','retained'):must(dir_identity(parent,names[key]) is None,'RECOVERY_NAME_COLLISION')
  original=dir_identity(parent,names['incoming']);target=str(Path(INCOMING).parent/names['candidate'])
  copied=baseline_copy(source,target,recovery_txn+'/recovery-input-manifest.jsonl',inventory['scan']['manifestSha256'],False,(1000,))
  must(copied['contentSha256']==source_content,'HISTORICAL_RECOVERY_INPUT_CHANGED')
  candidate=dir_identity(parent,names['candidate'])
  must(candidate['dev']==os.fstat(parent).st_dev and (original is None or original['dev']==candidate['dev']),'RECOVERY_CROSS_FILESYSTEM')
  journal_write(recovery_txn,{'version':1,'phase':'PREPARED','names':names,'original':original,'candidate':candidate})
  return {'candidatePrepared':True,'contentSha256':source_content,'files':copied['counts']['files'],'bytes':copied['counts']['bytes']}
 finally:os.close(parent)

def validate_manual_recovery(expected,actual_path):
 observed=tree_inventory(actual_path,(0,33,1000))
 must(expected['expectedFiles']==observed['files'] and expected['expectedDirectories']==sorted(observed['directories']),'MANUAL_RECOVERY_MODEL_MISMATCH')
 return True

def receive_once(files):
 result=subprocess.run(['/usr/bin/sudo','-n','--','/usr/local/bin/kfaah-receive-frontend','/home/deploy/incoming'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=300,check=False)
 return result.returncode

def stage(request,txn):
 must(EXECUTION_ENABLED,'INDEPENDENT_APPROVAL_REQUIRED')
 private_dir_fd=private_dir(txn);os.close(private_dir_fd)
 ready=verify_backup(txn,request);before,_=current_check(request);before_helpers=helpers()
 manifest,files=r.verify(txn+'/candidate',request['manifest_sha256'],request['archive_sha256'])
 origin=manifest['origin'];must(all(origin.get(k)==v for k,v in {'kind':'build','sourceSha':request['source_sha'],'workflowSha':request['build_workflow_sha'],'buildRunId':request['build_run_id'],'buildAttempt':request['build_attempt']}.items()),'CANDIDATE_ORIGIN_MISMATCH')
 outcome={'phase':'STAGE_ONLY','baselineBytesVerified':True,'backupPath':txn+'/baseline','baselineContentSha256':ready['contentSha256'],'promoteInvoked':False,'receiverInvoked':False,'receiverSourceReviewed':True,'allWritersExcluded':False,'quietWindowAssertion':request['quiet_window_confirmed'],'automaticRootRecovery':False}
 try:
  must(a.known_processes()['matchingCount']==0,'KNOWN_SERVER_HELPER_ACTIVE')
  saved,staging_ready=verified_staging_backup(txn);observed=receiver_paths()
  must(observed['inventory']['scan']['manifestSha256']==staging_ready['originalManifestSha256'],'STAGING_CHANGED_SINCE_BACKUP')
  modeled=receiver_model({'files':r.file_map(files)},files['index.html'],observed['inventory'],observed['legacyBadge'])
  outcome['expectedHtmlInjection']=modeled['htmlInjectionExpected'];outcome['legacyBadgeSha256']=observed['legacyBadge']['sha256'] if observed['legacyBadge'] else None
  outcome['retainedFileCount']=sum(excluded(p) for p in observed['inventory']['files'])
  fd=private_dir(txn)
  try:immutable_bytes(fd,'receiver-model.json',a.canonical(modeled))
  finally:os.close(fd)
  prepare_incoming(files,txn);install_incoming(txn)
  # Recheck all write/read anchors just before the fixed root invocation.
  latest=receiver_paths();must(latest==observed,'RECEIVER_PATHS_CHANGED')
  must(r.file_map(r.snapshot(INCOMING,1000,True,(0,1000)))==r.file_map(files),'INSTALLED_INCOMING_CHANGED')
  state=journal_read(txn);state['phase']='RECEIVER_RUNNING';journal_write(txn,state)
  outcome['receiverInvoked']=True;code=receive_once(files);outcome['receiveExitCode']=code
  state['phase']='RECEIVER_RETURNED';journal_write(txn,state)
  actual=receiver_paths(post=True)
  must(actual['legacyBadge']==observed['legacyBadge'] and actual['legacyDirectoryIdentity']==observed['legacyDirectoryIdentity'],'LEGACY_BADGE_CHANGED')
  outcome|=descriptor_diff(modeled['files'],actual['inventory']['files'])
  outcome['stagingMatchesReceiverModel']=code==0 and outcome['differenceCount']==0 and modeled['directories']==sorted(actual['inventory']['directories']) and not modeled['badgeReferenceMissing']
 except (OSError,ValueError,subprocess.TimeoutExpired):
  outcome|={'stagingMatchesReceiverModel':False,'reason':'STAGING_READ_OR_RECEIVE_NOT_CONFIRMED'}
  if outcome['receiverInvoked']:
   state=journal_read(txn)
   if state['phase']=='RECEIVER_RUNNING':state['phase']='RECEIVER_STATUS_UNKNOWN';journal_write(txn,state)
 finally:
  try:
   if Path(txn+'/incoming-swap.json').exists():outcome|=recover_incoming(txn)
   else:outcome['incomingRecovery']='ORIGINAL_NOT_RENAMED'
  except (OSError,ValueError):outcome['incomingRecovery']='MANUAL_RECOVERY_REQUIRED'
  try:
   after,_=current_check(request);outcome['currentBaselineMatchedBeforeAfter']=before==after;outcome['helpersMatchedBeforeAfter']=before_helpers==helpers()
   verify_backup(txn,request);outcome['baselineStillVerified']=True
  except (OSError,ValueError):outcome|={'currentBaselineMatchedBeforeAfter':False,'baselineStillVerified':False,'helpersMatchedBeforeAfter':False}
 fd=private_dir(txn)
 try:immutable_bytes(fd,'stage-result.json',a.canonical(outcome))
 finally:os.close(fd)
 return outcome

def stage_ready(result):
 return all(result.get(k) for k in ('stagingMatchesReceiverModel','currentBaselineMatchedBeforeAfter','baselineStillVerified','helpersMatchedBeforeAfter')) and result.get('incomingRecovery') in ('ORIGINAL_INCOMING_PRESENT','ORIGINAL_INCOMING_ABSENCE_PRESENT','ORIGINAL_INCOMING_RESTORED')

def main(request,phase,run_id,attempt):
 must(EXECUTION_ENABLED or phase=='recover-incoming','INDEPENDENT_APPROVAL_REQUIRED')
 must(phase in ('backup','stage','recover-incoming'),'PHASE_REJECTED')
 must(os.geteuid()==1000 and pwd.getpwuid(1000).pw_name=='deploy','DEPLOY_IDENTITY_REJECTED')
 r.check(r.POSITIVE,run_id);must(attempt=='1','RERUN_REJECTED')
 txn=BASE+'/stage-'+run_id+'-'+attempt
 # Cooperative deploy-user lock only; older publishers need an operational quiet window.
 parent=r.open_directory('/home/deploy',(0,1000),1000)
 lock=os.open('.kfaah-stage-only.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600,dir_fd=parent);os.close(parent)
 try:
  s=os.fstat(lock);must(stat.S_ISREG(s.st_mode) and s.st_uid==1000 and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o600,'LOCK_UNSAFE')
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  result=backup(request,txn) if phase=='backup' else (recover_incoming(txn) if phase=='recover-incoming' else stage(request,txn))
  emit(result)
  if phase=='stage' and not stage_ready(result):raise SystemExit(1)
 except (OSError,ValueError):
  emit({'phase':phase,'result':'STOPPED','reason':'EXPECTATION_NOT_CONFIRMED','backupPath':txn+'/baseline','promoteInvoked':False});raise SystemExit(1)
 finally:os.close(lock)
