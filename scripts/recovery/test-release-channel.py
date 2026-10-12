#!/usr/bin/env python3
"""Offline tests: synthetic events/artifacts; no GitHub, SSH or production data."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / 'deploy/frontend-interface'
sys.path.insert(0, str(TOOLS))

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

r = load('channel_release_test', TOOLS / 'release.py')
p = load('channel_provenance_test', TOOLS / 'provenance.py')
s = load('channel_stage_test', TOOLS / 'stage_only.py')
u = load('channel_publish_test', TOOLS / 'publish_only.py')
c = load('channel_policy_test', TOOLS / 'channel_policy.py')
i = load('channel_install_test', ROOT / 'deploy/install-frontend-dependencies.py')
SHA = 'a' * 40
H64 = 'b' * 64
OWNER = 341028123
REPO = 'Kfaah/Kfaah.sa'

def event(title, request):
    return {'action': 'opened', 'sender': {'id': OWNER},
            'repository': {'full_name': REPO, 'owner': {'id': OWNER}},
            'issue': {'title': title, 'user': {'id': OWNER}, 'author_association': 'OWNER', 'body': json.dumps(request)}}

def prepare():
    return {'version': 1, 'operation': 'PREPARE', 'workflow_sha': SHA,
            'build_workflow_sha': SHA, 'source_sha': 'c' * 40,
            **{k: None for k in ('build_run_id', 'build_attempt', 'artifact_id', 'manifest_sha256', 'archive_sha256')}}

class ChannelTests(unittest.TestCase):
    def test_owner_can_prepare(self):
        self.assertEqual(r.plan_request(event('KFAAH_FRONTEND_PREPARE_V1', prepare()), SHA), prepare())

    def test_foreign_identity_repository_owner_and_issue_are_rejected(self):
        base = event('KFAAH_FRONTEND_PREPARE_V1', prepare())
        for section, key, value in [('sender','id',253139283), ('repository','full_name','gaberalhrese-cloud/shop-soulmate-04'), ('issue','author_association','COLLABORATOR')]:
            e = copy.deepcopy(base); e[section][key] = value
            with self.subTest(section=section), self.assertRaises(ValueError): r.plan_request(e, SHA)
        for path in [('repository','owner'), ('issue','user')]:
            e = copy.deepcopy(base);e[path[0]][path[1]]['id'] = 253139283
            with self.subTest(path=path), self.assertRaises(ValueError): r.plan_request(e, SHA)

    def test_reruns_reopened_and_pull_requests_are_rejected(self):
        e = event('KFAAH_FRONTEND_PREPARE_V1', prepare())
        with self.assertRaises(ValueError): r.plan_request(e, SHA, '2')
        e['action'] = 'reopened'
        with self.assertRaises(ValueError): r.plan_request(e, SHA)
        e['action'] = 'opened';e['issue']['pull_request'] = {}
        with self.assertRaises(ValueError): r.plan_request(e, SHA)

    def test_duplicate_extra_boolean_and_old_commit_are_rejected(self):
        e = event('KFAAH_FRONTEND_PREPARE_V1', prepare())
        e['issue']['body'] = e['issue']['body'][:-1] + ',"version":1}'
        with self.assertRaises(ValueError): r.plan_request(e, SHA)
        for key, value in [('extra', 'x'), ('version', True), ('workflow_sha', 'd'*40), ('build_run_id','10')]:
            q=prepare();q[key]=value
            with self.subTest(key=key), self.assertRaises(ValueError):r.plan_request(event('KFAAH_FRONTEND_PREPARE_V1', q),SHA)

    def test_old_artifact_identity_actor_and_expiry_rejected(self):
        q = {'build_run_id':'12','build_attempt':'1','artifact_id':'34','build_workflow_sha':SHA}
        run = {'id':12,'run_attempt':1,'status':'completed','conclusion':'success','event':'issues',
               'head_branch':'main','path':p.WORKFLOW,'repository':{'full_name':REPO},'actor':{'id':OWNER},'head_sha':SHA}
        artifact = {'id':34,'expired':False,'name':'kfaah-frontend-bundle-12-1','workflow_run':{'id':12,'head_sha':SHA}}
        self.assertEqual(p.verify_run(q,lambda suffix:artifact if 'artifacts' in suffix else run),SHA)
        for obj,key,value in [(run,'actor',{'id':253139283}),(run,'head_branch','feature'),(artifact,'expired',True),(artifact,'id',35)]:
            a,b=copy.deepcopy(run),copy.deepcopy(artifact)
            (a if obj is run else b)[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):p.verify_run(q,lambda suffix:b if 'artifacts' in suffix else a)

    def test_build_origin_rejects_different_source(self):
        q={'source_sha':'c'*40,'build_run_id':'12','build_attempt':'1'}
        manifest={'origin':{'kind':'build','sourceSha':'d'*40,'workflowSha':SHA,'buildRunId':'12','buildAttempt':'1'}}
        with self.assertRaises(ValueError):p.compare_origin(manifest,q,SHA)

    def test_dependency_hashes_match_reviewed_files_and_tampering_rejected(self):
        s.dependency_modules(TOOLS)
        with tempfile.TemporaryDirectory() as d:
            target=Path(d)
            for name in s.HASHES:(target/name).write_bytes((TOOLS/name).read_bytes())
            (target/'provenance.py').write_text('#tampered')
            with self.assertRaises(ValueError):s.dependency_modules(target)
        u.load_dependencies(TOOLS,TOOLS)

    def test_audit_source_preserves_byte_hash_gate(self):
        workflow=ROOT/'.github/workflows/kfaah-owner-baseline-preflight.yml'
        source=s.approved_audit_source(workflow)
        compile(source,'approved-audit','exec')
        with tempfile.TemporaryDirectory() as d:
            f=Path(d)/'bad.yml';f.write_bytes(workflow.read_bytes()+b'\n')
            with self.assertRaises(ValueError):s.approved_audit_source(f)

    def test_missing_release_binding_cannot_validate_stage(self):
        self.assertIsNone(s.TOOLS_SHA)
        q={'version':1,'operation':'STAGE_ONLY','workflow_sha':SHA,'build_workflow_sha':SHA,'source_sha':'c'*40,
           'build_run_id':'12','build_attempt':'1','artifact_id':'34','manifest_sha256':H64,'archive_sha256':H64,
           'expected_current':None,'baseline_manifest_sha256':None,'expected_receive_sha256':s.RECEIVE_SHA,
           'expected_promote_sha256':s.PROMOTE_SHA,'quiet_window_confirmed':True}
        with self.assertRaises(ValueError):s.request_from_event(event(s.TITLE,q),SHA,'1',r)

    def test_valid_synthetic_stage_still_requires_exact_baseline_and_quiet_window(self):
        q={'version':1,'operation':'STAGE_ONLY','workflow_sha':SHA,'build_workflow_sha':SHA,'source_sha':'c'*40,
           'build_run_id':'12','build_attempt':'1','artifact_id':'34','manifest_sha256':H64,'archive_sha256':H64,
           'expected_current':'/var/www/kfaah-releases/test-1','baseline_manifest_sha256':H64,'expected_receive_sha256':s.RECEIVE_SHA,
           'expected_promote_sha256':s.PROMOTE_SHA,'quiet_window_confirmed':True}
        with patch.multiple(s,TOOLS_SHA=SHA,AUDIT_SHA=SHA,CURRENT=q['expected_current'],BASELINE_SHA=H64):
            self.assertEqual(s.request_from_event(event(s.TITLE,q),SHA,'1',r),q)
            for key,value in [('quiet_window_confirmed',False),('baseline_manifest_sha256','f'*64),('expected_receive_sha256','f'*64)]:
                bad=dict(q);bad[key]=value
                with self.subTest(key=key),self.assertRaises(ValueError):s.request_from_event(event(s.TITLE,bad),SHA,'1',r)

    def test_stage_and_publish_hard_locks_before_any_remote_operation(self):
        self.assertIs(s.EXECUTION_ENABLED,False);self.assertIs(u.EXECUTION_ENABLED,False)
        for action in ['backup','stage']:
            with patch.object(sys,'argv',['stage_only.py',action,'--tools',str(TOOLS),'--audit-workflow','unused']),patch.object(s.subprocess,'run') as remote:
                with self.assertRaises(ValueError):s.main()
                remote.assert_not_called()
        with patch.object(sys,'argv',['publish_only.py','publish','--stage-tools',str(TOOLS),'--build-tools',str(TOOLS),'--audit-workflow','unused']),patch.object(u.subprocess,'run') as remote:
            with self.assertRaises(ValueError):u.main()
            remote.assert_not_called()

    def test_publish_request_requires_new_owner_exact_stage_and_baseline(self):
        q={'version':1,'operation':'PUBLISH','workflow_sha':SHA,'stage_workflow_sha':SHA,
           'stage_run_id':'21','stage_attempt':'1','stage_artifact_id':'22',
           'stage_result_sha256':H64,'stage_backup_result_sha256':H64,
           'build_workflow_sha':SHA,'source_sha':'c'*40,'build_run_id':'12','build_attempt':'1',
           'artifact_id':'34','manifest_sha256':H64,'archive_sha256':H64,
           'expected_current':'/var/www/kfaah-releases/test-1','baseline_manifest_sha256':H64,
           'expected_receive_sha256':s.RECEIVE_SHA,'expected_promote_sha256':s.PROMOTE_SHA,'quiet_window_confirmed':True}
        with patch.multiple(s,TOOLS_SHA=SHA,CURRENT=q['expected_current'],BASELINE_SHA=H64),patch.object(u,'STAGE_SHA',SHA):
            self.assertEqual(u.plan_request(event('KFAAH_OWNER_PUBLISH_V1',q),SHA,'1',r,s),q)
            for key,value in [('stage_attempt','2'),('quiet_window_confirmed',False),('expected_current','/var/www/kfaah'),('build_workflow_sha','d'*40),('extra',1)]:
                bad=dict(q);bad[key]=value
                with self.subTest(key=key),self.assertRaises(ValueError):u.plan_request(event('KFAAH_OWNER_PUBLISH_V1',bad),SHA,'1',r,s)
            e=event('KFAAH_OWNER_PUBLISH_V1',q);e['sender']['id']=253139283
            with self.assertRaises(ValueError):u.plan_request(e,SHA,'1',r,s)

    def test_publish_rejects_foreign_or_retried_stage_run(self):
        q={'stage_run_id':'21','stage_attempt':'1','stage_artifact_id':'22'}
        run={'id':21,'run_attempt':1,'status':'completed','conclusion':'success','event':'issues',
             'head_branch':'main','head_sha':SHA,'path':u.STAGE_WORKFLOW,'repository':{'full_name':REPO},'actor':{'id':OWNER}}
        artifact={'id':22,'expired':False,'name':'kfaah-stage-only-evidence-21-1','workflow_run':{'id':21,'head_sha':SHA}}
        with patch.object(u,'STAGE_SHA',SHA):
            u.verify_stage_run(q,lambda suffix:artifact if 'artifacts' in suffix else run)
            for key,value in [('run_attempt',2),('actor',{'id':253139283}),('repository',{'full_name':'foreign/repo'}),('conclusion','failure')]:
                bad=dict(run);bad[key]=value
                with self.subTest(key=key),self.assertRaises(ValueError):u.verify_stage_run(q,lambda suffix:artifact if 'artifacts' in suffix else bad)

    def test_publish_stage_evidence_requires_exact_bytes(self):
        with tempfile.TemporaryDirectory() as d:
            directory=Path(d)
            (directory/'stage-result.jsonl').write_bytes(b'{}\n')
            (directory/'backup-result.jsonl').write_bytes(b'{}\n')
            q={'stage_result_sha256':hashlib.sha256(b'{}').hexdigest(),'stage_backup_result_sha256':H64}
            with self.assertRaises(ValueError):u.evidence(q,directory,r)

    def test_unknown_publisher_is_blocked(self):
        def get(_):return {'workflow_runs':[{'id':99,'path':'.github/workflows/foreign-publish.yml'}]}
        with self.assertRaises(ValueError):s.publishers_quiet(get,'12',SHA)

    def test_legacy_publisher_scan_is_required_and_fail_closed(self):
        quiet=lambda _: {'workflow_runs': []}
        with self.assertRaises(ValueError):s.publishers_quiet(quiet,'12',SHA)
        s.publishers_quiet(quiet,'12',SHA,quiet)
        busy=lambda _: {'workflow_runs': [{'id':99,'path':'.github/workflows/legacy-deploy.yml'}]}
        with self.assertRaises(ValueError):s.publishers_quiet(quiet,'12',SHA,busy)

    def test_no_auto_publish_and_legacy_workflows_are_archived(self):
        active=ROOT/'.github/workflows'
        self.assertFalse((active/'kfaah-one-shot-publish.yml').exists())
        self.assertTrue((ROOT/'docs/legacy-workflows/kfaah-one-shot-publish.yml').is_file())
        for path in active.glob('*.yml'):
            text=path.read_text()
            self.assertNotIn('253139283',text)
            self.assertNotIn('gaberalhrese-cloud/shop-soulmate-04',text)
            if 'HETZNER_SSH_KEY' in text:
                self.assertTrue("if: ${{ false && needs.review.result == 'success' }}" in text or '      false &&' in text,str(path))
        for name in ['kfaah-owner-stage-only.yml','kfaah-owner-publish.yml']:
            self.assertIn("if: ${{ false && needs.review.result == 'success' }}",(active/name).read_text())

    def test_mirror_rewrite_preserves_versions_integrity_and_original(self):
        original={'lockfileVersion':3,'packages':{'node_modules/queue':{'version':'6.0.2','integrity':'sha512-fixture','resolved':i.MIRROR+'queue/-/queue-6.0.2.tgz'}}}
        rewritten=i.normalized_lock(json.dumps(original))
        pkg=rewritten['packages']['node_modules/queue']
        self.assertEqual(pkg['resolved'],i.REGISTRY+'queue/-/queue-6.0.2.tgz')
        self.assertEqual(pkg['integrity'],'sha512-fixture');self.assertEqual(pkg['version'],'6.0.2')
        self.assertTrue(original['packages']['node_modules/queue']['resolved'].startswith(i.MIRROR))
        del original['packages']['node_modules/queue']['integrity']
        with self.assertRaises(ValueError):i.normalized_lock(json.dumps(original))

    def test_unknown_existing_node_modules_preserved(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/'node_modules').mkdir();f=root/'node_modules/keep.txt';f.write_text('keep')
            with self.assertRaises(ValueError),patch.object(i.subprocess,'run') as npm:i.install(root)
            self.assertEqual(f.read_text(),'keep');npm.assert_not_called()

    def test_approval_identity_is_immutable_and_bindings_unset(self):
        obj=c.approval();self.assertEqual(obj['repository'],REPO);self.assertEqual(obj['owner_id'],OWNER)
        self.assertTrue(all(obj[k] is None for k in obj if k not in ['repository','owner_id']))

if __name__ == '__main__':unittest.main(verbosity=2)
