"""Read-only fixed failed transaction probe. Loaded with independently pinned modules.
Never calls stage main, backup, journal, receiver, promoter, or a subprocess.
"""
import errno, fcntl, json, os, pwd, stat
from pathlib import Path
import approved_stage as m
RUN='38073963173'
TXN=m.BASE+'/stage-'+RUN+'-1'
CURRENT='/var/www/kfaah-releases/20261009T213800Z-126960cf'
MANIFEST='175f07648cbf276c814937b03ed69f9ee2bff7c891333a9c444ee9a9115072cb'
REQUEST={'expected_current':CURRENT,'baseline_manifest_sha256':MANIFEST}
REASONS=frozenset('NUMERIC_GROUP_CONTEXT_LIMIT HISTORICAL_PATH_REJECTED LEGACY_DIRECTORY_UNSAFE PRIVATE_DIRECTORY_REJECTED CURRENT_BASELINE_CHANGED CURRENT_UNSAFE CURRENT_MISMATCH ANCESTOR_UNPROTECTED HELPER_IDENTITY_MISMATCH HELPER_UNPROTECTED HELPER_REPLACED HELPER_CHANGED HELPER_LIMIT RECEIVER_TREE_UNSAFE RECEIVER_FILE_UNSAFE BADGE_DESTINATION_IS_DIRECTORY LOG_UNSAFE LEGACY_BADGE_UNSAFE LEGACY_BADGE_CHANGED NONREGULAR_BASELINE BASELINE_COPY_OWNER NONSTATIC_BASELINE BASELINE_HARDLINK UNPROTECTED_BASELINE DIRECTORY_REPLACED FILE_REPLACED FILE_CHANGED DIRECTORY_CHANGED DEADLINE_PARTIAL_SCAN ENTRY_LIMIT_PARTIAL_SCAN LOCK_UNSAFE'.split())
RELEASE_REASONS={'Untrusted directory ancestor':'DIRECTORY_OWNER_OR_MODE_REJECTED','Wrong owner':'OWNER_REJECTED','Unsafe relative path':'STATIC_PATH_REJECTED','Regular single-link file required':'REGULAR_FILE_REJECTED','Special mode rejected':'SPECIAL_MODE_REJECTED','Unprotected content':'MODE_REJECTED'}
def safe_error(exc):
 if isinstance(exc,OSError):return {'reason':'OS_ERROR','errno':exc.errno if type(exc.errno) is int else None}
 value=str(exc)
 return {'reason':value if value in REASONS else RELEASE_REASONS.get(value,'UNCLASSIFIED_EXPECTATION_REJECTED')}
def metadata(path):
 # Open every parent without following links; final entry itself is lstat only.
 fd=m.r.open_directory(Path(path).parent)
 try:s=os.fstat(fd) if Path(path)==Path('/') else os.stat(Path(path).name,dir_fd=fd,follow_symlinks=False)
 finally:os.close(fd)
 kind='directory' if stat.S_ISDIR(s.st_mode) else 'file' if stat.S_ISREG(s.st_mode) else 'symlink' if stat.S_ISLNK(s.st_mode) else 'special'
 return {'type':kind,'uid':s.st_uid,'gid':s.st_gid,'mode':format(stat.S_IMODE(s.st_mode),'04o'),'nlink':s.st_nlink,'size':s.st_size,'dev':s.st_dev,'ino':s.st_ino}
def numeric_identity():
 groups=sorted(set(os.getgroups()));m.must(len(groups)<=256,'NUMERIC_GROUP_CONTEXT_LIMIT')
 return {'uid':os.getuid(),'euid':os.geteuid(),'gid':os.getgid(),'egid':os.getegid(),'supplementaryGids':groups}
def directory_guard(path,ancestors,owner):
 fd=m.r.open_directory(path,ancestors,owner);os.close(fd);return {}
def legacy_guard():
 fd=m.legacy_directory();os.close(fd);return {}
def private_guard(path):
 fd=m.private_dir(path);os.close(fd);return {}
def lock_guard():
 parent=m.r.open_directory('/home/deploy',(0,1000),1000)
 try:fd=os.open('.kfaah-stage-only.lock',os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent)
 finally:os.close(parent)
 try:
  s=os.fstat(fd);m.must(stat.S_ISREG(s.st_mode) and s.st_uid==1000 and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o600,'LOCK_UNSAFE')
  fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
  return {'availableAtProbe':True}
 finally:os.close(fd)
def inventory_guard():
 inv=m.tree_inventory(m.STAGING,(0,33));m.must('hide-badge.js' not in inv['directories'],'BADGE_DESTINATION_IS_DIRECTORY')
 return {'counts':inv['scan']['counts'],'manifestSha256':inv['scan']['manifestSha256']}
def receiver_guard():
 out=m.receiver_paths();return {'counts':out['inventory']['scan']['counts'],'manifestSha256':out['inventory']['scan']['manifestSha256'],'legacyBadgePresent':out['legacyBadge'] is not None}
def pointer_guard():
 fd=m.a.directory("/var/www")
 try:m.a.pointer(fd,CURRENT);return {"matchesApprovedBaseline":True}
 finally:os.close(fd)
def current_guard():
 _,out=m.current_check(REQUEST);return {'counts':out['counts'],'manifestSha256':out['manifestSha256']}
def processes_guard():
 return {'matchingCount':m.a.known_processes()['matchingCount']}
def helpers_guard():
 m.helpers();return {'expectedMatch':True}
def copy_guard(path):
 fd=m.private_dir(TXN);os.close(fd)
 # Reuse safe no-follow historical scanner; output excludes file paths/content.
 digest,out=m.content_scan(path);return {'contentSha256':digest,'counts':out['counts']}
def probe(probe_id,operation):
 try:return {'probe':probe_id,'status':'PASSED',**operation()}
 except (OSError,ValueError) as exc:return {'probe':probe_id,'status':'NOT_CONFIRMED',**safe_error(exc)}
def diagnose():
 rows=[]
 fixed={'filesystem_root':'/','var':'/var','var_log':'/var/log','var_www':'/var/www','home':'/home','home_deploy':'/home/deploy','usr':'/usr','usr_local':'/usr/local','usr_local_bin':'/usr/local/bin','releases':'/var/www/kfaah-releases','current_baseline':CURRENT,'base':m.BASE,'transaction':TXN,'lock':'/home/deploy/.kfaah-stage-only.lock','staging':m.STAGING,'legacy':m.LEGACY,'log':m.LOG,'current_link':'/var/www/kfaah-current'}
 for key,path in fixed.items():rows.append(probe('metadata_'+key,lambda path=path:metadata(path)))
 # Child observations guarded against symlinked/misowned transaction ancestors.
 for child in ('baseline','baseline-manifest.jsonl','candidate','staging-before','staging-manifest.jsonl','staging-ready.json','baseline-ready.json','incoming-swap.json','stage-result.json'):
  def observe(child=child):
   private_guard(m.BASE);private_guard(TXN);return metadata(TXN+'/'+child)
  rows.append(probe('transaction_'+child.replace('.','_').replace('-','_'),observe))
 operations=[('identity_numeric',numeric_identity),('base_private_guard',lambda:private_guard(m.BASE)),('transaction_private_guard',lambda:private_guard(TXN)),('lock_guard',lock_guard),('current_pointer',pointer_guard),('current_check',current_guard),('helpers',helpers_guard),('known_processes',processes_guard),('staging_root_guard',lambda:directory_guard(m.STAGING,(0,),33)),('staging_inventory',inventory_guard),('legacy_root_guard',legacy_guard),('receiver_paths',receiver_guard),('baseline_copy_scan',lambda:copy_guard(TXN+'/baseline')),('staging_copy_scan',lambda:copy_guard(TXN+'/staging-before'))]
 rows.extend(probe(key,operation) for key,operation in operations)
 return {'phase':'READ_ONLY_BACKUP_DIAGNOSTIC','stageRunId':RUN,'historicalFailureExactlyIdentified':False,'observationsAreCurrent':True,'receiverInvoked':False,'promoteInvoked':False,'filesystemWritesRequested':False,'probes':rows}
def main():
 if os.geteuid()!=1000 or pwd.getpwuid(1000).pw_name!='deploy':raise ValueError('DEPLOY_IDENTITY_REJECTED')
 print(json.dumps(diagnose(),sort_keys=True,separators=(',',':')),flush=True)
if __name__=='__main__':main()
