#!/usr/bin/env python3
"""Freeze preview builds, and verify them before an explicitly approved promotion."""
import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import tempfile
from pathlib import Path

ROOT = Path('/home/deploy/kfaah-fast')
PREPARED = ROOT / 'prepared'
INCOMING = Path('/home/deploy/incoming')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def regular_tree(root):
    if root.is_symlink() or not root.is_dir():
        raise ValueError('Expected a regular directory')
    files = {}
    for path in sorted(root.rglob('*')):
        mode = path.lstat().st_mode
        if stat.S_ISREG(mode):
            files[path.relative_to(root).as_posix()] = digest(path)
        elif not stat.S_ISDIR(mode):
            raise ValueError('Special file or symlink rejected')
    return files


def build_inputs(workspace):
    """Cover all application files and root build/config files, including additions."""
    result = {}
    for name in ('src', 'public'):
        directory = workspace / name
        if directory.exists() or directory.is_symlink():
            result.update({name + '/' + p: sha for p, sha in regular_tree(directory).items()})
    for path in sorted(workspace.iterdir()):
        if path.name.startswith('.') or path.name == 'vite.fast.config.ts':
            continue
        if path.is_file() or path.is_symlink():
            if path.is_symlink() or not path.is_file():
                raise ValueError('Invalid root build input')
            result[path.name] = digest(path)
    if not {'index.html', 'package.json', 'package-lock.json', 'vite.config.ts'} <= result.keys():
        raise ValueError('Missing build inputs')
    return result


def validate_bundle(bundle):
    files = regular_tree(bundle)
    page = (bundle / 'index.html').read_bytes()
    if b'<div id="root"' not in page or b'https://kfaah.sa' not in page:
        raise ValueError('Build does not target the production gateway')
    if b'%VITE_' in page:
        raise ValueError('Unresolved build configuration')
    for name in files:
        data = (bundle / name).read_bytes().lower()
        if any(s in data for s in (b'.supabase.co', b'lovable.app', b'lovable.dev')):
            raise ValueError('Legacy dependency in prepared build')
    if not any(name.startswith('assets/') and name.endswith('.js') for name in files):
        raise ValueError('No compiled application')
    return files


def identifiers(command, job, base):
    if not re.fullmatch(r'[1-9][0-9]*', str(command)) or not re.fullmatch(r'[1-9][0-9]*', str(job)):
        raise ValueError('Invalid command/job identifier')
    if not re.fullmatch(r'[a-f0-9]{40}', base):
        raise ValueError('Invalid source version')


def prepare(workspace, prepared_root, command, job, base):
    identifiers(command, job, base)
    source_inputs = build_inputs(workspace)
    validate_bundle(workspace / 'dist')
    prepared_root.mkdir(parents=True, exist_ok=True)
    if prepared_root.is_symlink():
        raise ValueError('Invalid prepared directory')
    target = prepared_root / str(job)
    if target.exists() or target.is_symlink():
        raise ValueError('An immutable bundle already exists for this job')
    temporary = Path(tempfile.mkdtemp(prefix='.building-', dir=prepared_root))
    try:
        shutil.copytree(workspace / 'dist', temporary / 'dist', symlinks=True)
        files = validate_bundle(temporary / 'dist')
        if source_inputs != build_inputs(workspace):
            raise ValueError('Source changed while preparing the release')
        manifest = {'formatVersion': 1, 'commandId': str(command), 'jobId': str(job),
                    'baseSha': base, 'inputs': source_inputs, 'files': files}
        manifest_path = temporary / 'manifest.json'
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=True, sort_keys=True, separators=(',', ':')) + '\n')
        sha = digest(manifest_path)
        temporary.rename(target)
        return {'version': 1, 'manifestSha256': sha}
    except BaseException:
        # The exact temporary directory is created above beneath prepared_root.
        shutil.rmtree(temporary)
        raise


def read_manifest(path, expected_sha, command, job, base):
    identifiers(command, job, base)
    if not re.fullmatch(r'[a-f0-9]{64}', expected_sha) or path.is_symlink() or not path.is_file():
        raise ValueError('Invalid manifest identity')
    if digest(path) != expected_sha:
        raise ValueError('Prepared manifest no longer matches the approved preview')
    manifest = json.loads(path.read_text())
    if (manifest.get('formatVersion'), manifest.get('commandId'), manifest.get('jobId'), manifest.get('baseSha')) != (1, str(command), str(job), base):
        raise ValueError('Prepared release belongs to a different attempt')
    for field in ('inputs', 'files'):
        if not isinstance(manifest.get(field), dict) or not manifest[field]:
            raise ValueError('Missing manifest hashes')
        for name, sha in manifest[field].items():
            if (not isinstance(name, str) or '\\' in name or name.startswith('/') or
                    any(p in ('', '.', '..') for p in name.split('/')) or
                    not isinstance(sha, str) or not re.fullmatch(r'[a-f0-9]{64}', sha)):
                raise ValueError('Invalid manifest entry')
    return manifest


def verify_source(workspace, manifest):
    if build_inputs(workspace) != manifest['inputs']:
        raise ValueError('Prepared build source differs from reviewed GitHub source')


def stage(manifest, directory, incoming, receive=True):
    bundle = directory / 'dist'
    if validate_bundle(bundle) != manifest['files']:
        raise ValueError('Prepared build content changed')
    if incoming.is_symlink():
        raise ValueError('Incoming directory is a symlink')
    incoming.mkdir(parents=True, exist_ok=True)
    if any(not (p.is_file() or p.is_dir()) or p.is_symlink() for p in incoming.rglob('*')):
        raise ValueError('Unsafe existing incoming tree')
    subprocess.run(['rsync', '-a', '--checksum', '--delete', str(bundle) + '/', str(incoming) + '/'], check=True)
    if validate_bundle(incoming) != manifest['files']:
        raise ValueError('Staged build differs from immutable bundle')
    if receive:
        subprocess.run(['sudo', '-n', '/usr/local/bin/kfaah-receive-frontend', str(incoming)], check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['verify-source', 'stage'])
    parser.add_argument('--command', required=True)
    parser.add_argument('--job', required=True)
    parser.add_argument('--base', required=True)
    parser.add_argument('--sha', required=True)
    parser.add_argument('--manifest')
    args = parser.parse_args()
    identifiers(args.command, args.job, args.base)
    if args.action == 'verify-source':
        manifest = read_manifest(Path(args.manifest), args.sha, args.command, args.job, args.base)
        verify_source(Path.cwd(), manifest)
        print('PREPARED_SOURCE_VERIFIED')
    else:
        directory = PREPARED / args.job
        if PREPARED.is_symlink() or directory.is_symlink():
            raise ValueError('Unsafe prepared release directory')
        manifest = read_manifest(directory / 'manifest.json', args.sha, args.command, args.job, args.base)
        stage(manifest, directory, INCOMING)
        print('PREPARED_BUNDLE_STAGED')


if __name__ == '__main__':
    main()
