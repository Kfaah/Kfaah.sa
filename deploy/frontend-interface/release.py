#!/usr/bin/env python3
"""Immutable frontend build bundles for PREPARE/VERIFY only.
No SSH, sudo, root writes or production invocation is implemented here.
"""
import argparse, hashlib, html, io, json, os, re, stat, tarfile
from pathlib import Path

MAX_FILES=10000
MAX_BYTES=256*1024*1024
MAX_MANIFEST=4*1024*1024
H64=re.compile(r'[a-f0-9]{64}')
H40=re.compile(r'[a-f0-9]{40}')
POSITIVE=re.compile(r'[1-9][0-9]*')
SUFFIXES={'.html','.js','.css','.json','.map','.svg','.png','.jpg','.jpeg','.gif','.webp','.ico','.woff','.woff2','.ttf','.otf','.txt','.pdf','.mp4','.webm','.avif'}
BLOCKED=re.compile(rb'lovable\.(?:app|dev)|ai\.gateway\.lovable|\.supabase\.co',re.I)

def check(pattern,value):
    if type(value) is not str or not pattern.fullmatch(value):raise ValueError('Invalid identifier')
    return value

def digest(data):return hashlib.sha256(data).hexdigest()
def canonical(obj):return (json.dumps(obj,sort_keys=True,separators=(',',':'),ensure_ascii=True)+'\n').encode()
def unique(pairs):
    obj={}
    for key,value in pairs:
        if key in obj:raise ValueError('Duplicate JSON key')
        obj[key]=value
    return obj

def name(value):
    if type(value) is not str or not re.fullmatch(r'[A-Za-z0-9_./-]+',value) or value.startswith('/') or any(p in ('','.','..') or p.startswith('.') for p in value.split('/')):raise ValueError('Unsafe relative path')
    return value

def metadata(info):
    return tuple(getattr(info,key) for key in ('st_dev','st_ino','st_size','st_mtime_ns','st_ctime_ns','st_mode','st_uid','st_gid','st_nlink'))

def safe_info(info,owner,protected,directory=False):
    if directory:
        if not stat.S_ISDIR(info.st_mode):raise ValueError('Directory required')
    elif not stat.S_ISREG(info.st_mode) or info.st_nlink!=1:raise ValueError('Regular single-link file required')
    if info.st_mode&0o7000:raise ValueError('Special mode rejected')
    if owner is not None and info.st_uid!=owner:raise ValueError('Wrong owner')
    if protected and info.st_mode&0o022:raise ValueError('Unprotected content')

def open_directory(path,ancestor_owners=None,target_owner=None):
    path=Path(path).absolute()
    if '..' in path.parts:raise ValueError('Unsafe directory')
    fd=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
        for index,part in enumerate(path.parts[1:]):
            child=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd)
            os.close(fd);fd=child
            info=os.fstat(fd)
            owners=(target_owner,) if target_owner is not None and index==len(path.parts)-2 else ancestor_owners
            if owners is not None and (info.st_uid not in owners or info.st_mode&0o022):raise ValueError('Untrusted directory ancestor')
        return fd
    except BaseException:os.close(fd);raise

def snapshot(root,owner=None,protected=False,ancestor_owners=None):
    """Pinned nofollow snapshot with before/after file and directory metadata checks."""
    fd=open_directory(root,ancestor_owners,owner if ancestor_owners is not None else None);files={};total=0
    def walk(parent,prefix):
        nonlocal total
        before=os.fstat(parent);safe_info(before,owner,protected,True)
        for entry in sorted(os.listdir(parent)):
            relative=name(prefix+entry);info=os.stat(entry,dir_fd=parent,follow_symlinks=False)
            if stat.S_ISDIR(info.st_mode):
                child=os.open(entry,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent)
                try:
                    if metadata(info)!=metadata(os.fstat(child)):raise ValueError('Directory changed')
                    walk(child,relative+'/')
                finally:os.close(child)
            else:
                safe_info(info,owner,protected)
                if len(files)>=MAX_FILES or total+info.st_size>MAX_BYTES:raise ValueError('Snapshot size limit')
                handle=os.open(entry,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent)
                try:
                    initial=os.fstat(handle);safe_info(initial,owner,protected)
                    if metadata(info)!=metadata(initial):raise ValueError('File replaced')
                    chunks=[];size=0
                    while True:
                        data=os.read(handle,min(65536,MAX_BYTES-total-size+1))
                        if not data:break
                        chunks.append(data);size+=len(data)
                        if total+size>MAX_BYTES:raise ValueError('Snapshot size limit')
                    if size!=initial.st_size or metadata(initial)!=metadata(os.fstat(handle)) or metadata(initial)!=metadata(os.stat(entry,dir_fd=parent,follow_symlinks=False)):raise ValueError('File changed')
                    files[relative]=b''.join(chunks);total+=size
                finally:os.close(handle)
        if metadata(before)!=metadata(os.fstat(parent)):raise ValueError('Directory changed during snapshot')
    try:walk(fd,'')
    finally:os.close(fd)
    validate(files)
    return files

def validate(files):
    if not files or len(files)>MAX_FILES or sum(map(len,files.values()))>MAX_BYTES:raise ValueError('Bundle size limit')
    for relative,data in files.items():
        name(relative)
        if any(parent.as_posix() in files for parent in Path(relative).parents if parent.as_posix()!='.'):raise ValueError('File/directory path conflict')
        if Path(relative).suffix.lower() not in SUFFIXES:raise ValueError('Static suffix required')
        if BLOCKED.search(data):raise ValueError('Blocked origin')
    page=files.get('index.html',b'')
    if b'<div id="root"' not in page or b'https://kfaah.sa' not in page or b'%VITE_' in page:raise ValueError('Invalid SPA/gateway')
    refs=re.findall(r'(?:src|href)=["\'](/?(?:assets/[^"\']+|hide-badge\.js))["\']',page.decode('utf-8'))
    entries=[name(html.unescape(ref).lstrip('/').split('?')[0]) for ref in refs]
    if not any(p.startswith('assets/') and p.endswith('.js') for p in entries) or any(p not in files for p in entries):raise ValueError('Missing referenced assets')

def file_map(files):return {n:{'sha256':digest(data),'size':len(data)} for n,data in sorted(files.items())}

def validate_origin(origin):
    if type(origin) is not dict:raise ValueError('Invalid provenance')
    if origin.get('kind')=='build':
        if set(origin)!={'kind','sourceSha','workflowSha','buildRunId','buildAttempt','nodeVersion','lockSha256'}:raise ValueError('Invalid build schema')
        check(H40,origin['sourceSha']);check(H40,origin['workflowSha']);check(POSITIVE,origin['buildRunId']);check(POSITIVE,origin['buildAttempt']);check(re.compile(r'v22\.[0-9]+\.[0-9]+'),origin['nodeVersion']);check(H64,origin['lockSha256'])
    else:raise ValueError('Unknown provenance')

def pack_files(files,output,origin):
    validate(files);validate_origin(origin)
    output=Path(output)
    if output.exists() or output.is_symlink():raise ValueError('Immutable output exists')
    manifest={'format':1,'gateway':'https://kfaah.sa','origin':origin,'files':file_map(files)};raw=canonical(manifest)
    if len(raw)>MAX_MANIFEST:raise ValueError('Manifest limit')
    archive=io.BytesIO()
    with tarfile.open(fileobj=archive,mode='w',format=tarfile.USTAR_FORMAT) as tar:
        for relative,data in sorted(files.items()):
            member=tarfile.TarInfo(relative);member.size=len(data);member.mode=0o644;tar.addfile(member,io.BytesIO(data))
    payload=archive.getvalue();identity={'manifestSha256':digest(raw),'archiveSha256':digest(payload)}
    output.mkdir(parents=True,mode=0o700)
    (output/'manifest.json').write_bytes(raw);(output/'bundle.tar').write_bytes(payload);(output/'identity.json').write_bytes(canonical(identity))
    return identity

def read_regular(path,limit):
    fd=open_directory(Path(path).parent)
    handle=None
    try:
        handle=os.open(Path(path).name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd)
        before=os.fstat(handle);safe_info(before,None,False)
        if before.st_size>limit:raise ValueError('Artifact size limit')
        with os.fdopen(os.dup(handle),'rb') as stream:data=stream.read(limit+1)
        if len(data)!=before.st_size or len(data)>limit or metadata(before)!=metadata(os.fstat(handle)):raise ValueError('Artifact changed')
        return data
    finally:
        if handle is not None:os.close(handle)
        os.close(fd)

def verify(directory,manifest_sha,archive_sha):
    check(H64,manifest_sha);check(H64,archive_sha)
    raw=read_regular(Path(directory)/'manifest.json',MAX_MANIFEST);payload=read_regular(Path(directory)/'bundle.tar',MAX_BYTES+MAX_FILES*2048)
    if digest(raw)!=manifest_sha or digest(payload)!=archive_sha:raise ValueError('Artifact identity mismatch')
    obj=json.loads(raw,object_pairs_hook=unique)
    if type(obj) is not dict or set(obj)!={'format','gateway','origin','files'} or type(obj['format']) is not int or obj['format']!=1 or obj['gateway']!='https://kfaah.sa' or canonical(obj)!=raw:raise ValueError('Manifest schema mismatch')
    validate_origin(obj['origin'])
    if type(obj['files']) is not dict or not 0<len(obj['files'])<=MAX_FILES:raise ValueError('Invalid file map')
    for relative,item in obj['files'].items():
        name(relative)
        if type(item) is not dict or set(item)!={'sha256','size'} or type(item['size']) is not int or not 0<=item['size']<=MAX_BYTES:raise ValueError('Invalid descriptor')
        check(H64,item['sha256'])
    files={};total=0
    with tarfile.open(fileobj=io.BytesIO(payload),mode='r:') as tar:
        for member in tar:
            relative=name(member.name)
            if member.type!=tarfile.REGTYPE or member.linkname or member.pax_headers or member.sparse or member.uid or member.gid or member.uname or member.gname or member.mode!=0o644:raise ValueError('Unsafe archive entry')
            if relative in files or relative not in obj['files'] or member.size!=obj['files'][relative]['size']:raise ValueError('Unexpected archive entry')
            total+=member.size
            if total>MAX_BYTES or len(files)>=MAX_FILES:raise ValueError('Archive size limit')
            files[relative]=tar.extractfile(member).read()
    validate(files)
    if file_map(files)!=obj['files']:raise ValueError('File identity mismatch')
    return obj,files

def plan_request(event,workflow_sha,attempt='1'):
    if attempt!='1' or event.get('action')!='opened' or event.get('sender',{}).get('id')!=253139283 or event.get('repository',{}).get('full_name')!='gaberalhrese-cloud/shop-soulmate-04' or event.get('repository',{}).get('owner',{}).get('id')!=253139283:raise ValueError('Unapproved event')
    issue=event.get('issue',{})
    if issue.get('user',{}).get('id')!=253139283 or issue.get('author_association')!='OWNER' or issue.get('title')!='KFAAH_FRONTEND_PREPARE_V1' or 'pull_request' in issue:raise ValueError('Unapproved requester')
    body=issue.get('body')
    if type(body) is not str or len(body.encode())>4096:raise ValueError('Request limit')
    request=json.loads(body,object_pairs_hook=unique)
    fields={'version','operation','workflow_sha','build_workflow_sha','source_sha','build_run_id','build_attempt','artifact_id','manifest_sha256','archive_sha256'}
    if type(request) is not dict or set(request)!=fields or type(request['version']) is not int or request['version']!=1 or request['operation'] not in ('PREPARE','VERIFY'):raise ValueError('Preparation only')
    check(H40,workflow_sha)
    if request['workflow_sha']!=workflow_sha:raise ValueError('Wrong reviewed workflow')
    check(H40,request['build_workflow_sha']);check(H40,request['source_sha'])
    ids=('build_run_id','build_attempt','artifact_id','manifest_sha256','archive_sha256')
    if request['operation']=='PREPARE':
        if request['build_workflow_sha']!=workflow_sha:raise ValueError('Prepare must use this reviewed workflow commit')
        if any(request[field] is not None for field in ids):raise ValueError('Preparation cannot reuse ambiguous build IDs')
    else:
        for field in ids:check(H64 if field.endswith('sha256') else POSITIVE,request[field])
    return request

def main():
    parser=argparse.ArgumentParser(description=__doc__);sub=parser.add_subparsers(dest='action',required=True)
    pack=sub.add_parser('pack-build');pack.add_argument('--dist',type=Path,required=True);pack.add_argument('--output',type=Path,required=True)
    for key in ('source-sha','workflow-sha','run-id','attempt','node-version'):pack.add_argument('--'+key,required=True)
    pack.add_argument('--lock',type=Path,required=True)
    verify_parser=sub.add_parser('verify');verify_parser.add_argument('--directory',type=Path,required=True);verify_parser.add_argument('--manifest-sha',required=True);verify_parser.add_argument('--archive-sha',required=True)
    plan=sub.add_parser('plan');plan.add_argument('--event',type=Path,required=True);plan.add_argument('--workflow-sha',required=True);plan.add_argument('--attempt',required=True);plan.add_argument('--outputs',type=Path,required=True)
    args=parser.parse_args()
    if args.action=='plan':
        event=json.loads(read_regular(args.event,1024*1024),object_pairs_hook=unique)
        result=plan_request(event,args.workflow_sha,args.attempt)
        with args.outputs.open('a') as stream:
            for key in ('operation','source_sha','build_run_id','build_attempt','artifact_id','manifest_sha256','archive_sha256'):
                stream.write(key+'='+str(result[key] or '')+'\n')
    elif args.action=='pack-build':result=pack_files(snapshot(args.dist),args.output,{'kind':'build','sourceSha':args.source_sha,'workflowSha':args.workflow_sha,'buildRunId':args.run_id,'buildAttempt':args.attempt,'nodeVersion':args.node_version,'lockSha256':digest(read_regular(args.lock,MAX_MANIFEST))})
    elif args.action=='verify':result=verify(args.directory,args.manifest_sha,args.archive_sha)[0]
    print(json.dumps(result,sort_keys=True))
if __name__=='__main__':main()
