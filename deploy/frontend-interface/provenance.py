#!/usr/bin/env python3
"""Read-only GitHub run/artifact provenance. No source code execution or server access."""
import argparse, importlib.util, json, os, urllib.request
from pathlib import Path
spec=importlib.util.spec_from_file_location('release',Path(__file__).with_name('release.py'));r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
REPO='Kfaah/Kfaah.sa'
WORKFLOW='.github/workflows/kfaah-owner-frontend-prepare.yml'

def verify_run(request,get):
    for key in ('build_run_id','build_attempt','artifact_id'):r.check(r.POSITIVE,request[key])
    run=get('actions/runs/'+request['build_run_id']+'/attempts/'+request['build_attempt'])
    if run.get('id')!=int(request['build_run_id']) or run.get('run_attempt')!=int(request['build_attempt']) or run.get('status')!='completed' or run.get('conclusion')!='success' or run.get('event')!='issues' or run.get('head_branch')!='main' or run.get('path')!=WORKFLOW or run.get('repository',{}).get('full_name')!=REPO or run.get('actor',{}).get('id')!=341028123:raise ValueError('Unapproved build provenance')
    head=r.check(r.H40,run.get('head_sha'))
    if head!=r.check(r.H40,request['build_workflow_sha']):raise ValueError('Build workflow commit differs from explicit approval')
    artifact=get('actions/artifacts/'+request['artifact_id'])
    if artifact.get('id')!=int(request['artifact_id']) or artifact.get('expired') is not False or artifact.get('name')!='kfaah-frontend-bundle-'+request['build_run_id']+'-'+request['build_attempt'] or artifact.get('workflow_run',{}).get('id')!=int(request['build_run_id']) or artifact.get('workflow_run',{}).get('head_sha')!=head:raise ValueError('Unapproved artifact identity')
    return head

def compare_origin(manifest,request,workflow_sha):
    expected={'kind':'build','sourceSha':request['source_sha'],'workflowSha':workflow_sha,'buildRunId':request['build_run_id'],'buildAttempt':request['build_attempt']}
    if any(manifest['origin'].get(k)!=v for k,v in expected.items()):raise ValueError('Bundle origin differs from approved run/source')

def main():
    p=argparse.ArgumentParser();p.add_argument('--event',type=Path,required=True);p.add_argument('--workflow-sha',required=True);p.add_argument('--attempt',required=True);p.add_argument('--bundle-directory',type=Path)
    a=p.parse_args();request=r.plan_request(json.loads(r.read_regular(a.event,1024*1024),object_pairs_hook=r.unique),a.workflow_sha,a.attempt)
    if request['operation']!='VERIFY':raise ValueError('Verification request required')
    token=os.environ.get('GH_TOKEN','')
    if not token:raise ValueError('Missing GitHub read token')
    def get(suffix):
        url='https://api.github.com/repos/'+REPO+'/'+suffix
        req=urllib.request.Request(url,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'})
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
        try:
            with opener.open(req,timeout=20) as response:data=response.read(4*1024*1024+1)
            if len(data)>4*1024*1024:raise ValueError('GitHub response limit')
            return json.loads(data,object_pairs_hook=r.unique)
        except Exception:raise ValueError('GitHub provenance not confirmed') from None
    head=verify_run(request,get)
    if a.bundle_directory:
        manifest,files=r.verify(a.bundle_directory,request['manifest_sha256'],request['archive_sha256']);compare_origin(manifest,request,head)
    print('VERIFIED_GITHUB_RUN_ARTIFACT'+('_AND_BUNDLE' if a.bundle_directory else ''))
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):raise ValueError('Redirect rejected')
if __name__=='__main__':main()
