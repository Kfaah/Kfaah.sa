#!/usr/bin/env python3
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / 'deploy/prepared-release.py'
if not MODULE.exists():
    MODULE = Path(__file__).with_name('prepared-release.py')
spec = importlib.util.spec_from_file_location('prepared_release', MODULE)
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class PreparedReleaseTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.workspace = self.root / 'workspace'
        self.workspace.mkdir()
        self.prepared = self.root / 'prepared'
        self.base = 'a' * 40
        for path, content in {'index.html': '<div id="root"></div>', 'package.json': '{}',
            'package-lock.json': '{}', 'vite.config.ts': 'export default {}',
            'src/app.tsx': 'hello', 'public/logo.svg': '<svg/>', 'logo.png': 'root image',
            '.env.local': 'EXAMPLE_SECRET=never-export', 'vite.fast.config.ts': 'preview only',
            'dist/index.html': '<div id="root"></div><script src="/assets/a.js"></script>https://kfaah.sa',
            'dist/assets/a.js': 'compiled app'}.items():
            p = self.workspace / path
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content)

    def prepare(self):
        meta = release.prepare(self.workspace, self.prepared, '41', '50', self.base)
        path = self.prepared / '50/manifest.json'
        return meta, release.read_manifest(path, meta['manifestSha256'], '41', '50', self.base)

    def test_roundtrip_source_and_stage(self):
        _, manifest = self.prepare()
        release.verify_source(self.workspace, manifest)
        incoming = self.root / 'incoming'
        release.stage(manifest, self.prepared / '50', incoming, receive=False)
        self.assertEqual(manifest['files'], release.regular_tree(incoming))

    def test_sensitive_and_preview_config_excluded(self):
        _, manifest = self.prepare()
        self.assertNotIn('.env.local', manifest['inputs'])
        self.assertNotIn('vite.fast.config.ts', manifest['inputs'])
        self.assertIn('logo.png', manifest['inputs'])

    def test_different_source_rejected(self):
        _, manifest = self.prepare()
        (self.workspace / 'src/app.tsx').write_text('changed')
        with self.assertRaises(ValueError): release.verify_source(self.workspace, manifest)

    def test_unreviewed_extra_source_rejected(self):
        _, manifest = self.prepare()
        (self.workspace / 'src/extra.tsx').write_text('injected')
        with self.assertRaises(ValueError): release.verify_source(self.workspace, manifest)

    def test_bundle_tamper_rejected_before_staging(self):
        _, manifest = self.prepare()
        (self.prepared / '50/dist/assets/a.js').write_text('changed')
        with self.assertRaises(ValueError):
            release.stage(manifest, self.prepared / '50', self.root / 'incoming', receive=False)
        self.assertFalse((self.root / 'incoming').exists())

    def test_manifest_tamper_rejected(self):
        meta, _ = self.prepare()
        path = self.prepared / '50/manifest.json'
        path.write_text(path.read_text() + ' ')
        with self.assertRaises(ValueError): release.read_manifest(path, meta['manifestSha256'], '41', '50', self.base)

    def test_wrong_attempt_rejected(self):
        meta, _ = self.prepare()
        with self.assertRaises(ValueError):
            release.read_manifest(self.prepared / '50/manifest.json', meta['manifestSha256'], '42', '50', self.base)

    def test_symlink_in_bundle_rejected(self):
        (self.workspace / 'dist/link').symlink_to(self.workspace / 'package.json')
        with self.assertRaises(ValueError): self.prepare()

    def test_symlink_in_source_rejected(self):
        (self.workspace / 'src/link.ts').symlink_to(self.workspace / 'package.json')
        with self.assertRaises(ValueError): self.prepare()

    def test_overwriting_prepared_job_rejected(self):
        self.prepare()
        with self.assertRaises(ValueError): self.prepare()

    def test_legacy_build_origin_rejected(self):
        (self.workspace / 'dist/assets/a.js').write_text('https://old.supabase.co')
        with self.assertRaises(ValueError): self.prepare()

    def test_identifiers_cannot_escape(self):
        with self.assertRaises(ValueError):
            release.prepare(self.workspace, self.prepared, '41', '../50', self.base)


if __name__ == '__main__':
    unittest.main()
