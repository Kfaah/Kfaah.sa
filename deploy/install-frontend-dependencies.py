#!/usr/bin/env python3
"""Frozen installation without changing tracked manifests, versions or integrity.
The old private cache host is replaced only in a temporary copy of the lockfile.
Only this helper's generated node_modules links may be replaced; preserve other files.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

MIRROR = 'https://europe-west1-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache/'
REGISTRY = 'https://registry.npmjs.org/'
PREFIX = 'kfaah-frontend-deps-'

def normalized_lock(lock):
    obj = json.loads(lock)
    if obj.get('lockfileVersion') not in (2, 3) or type(obj.get('packages')) is not dict:
        raise ValueError('Unsupported npm lockfile')
    for item in obj['packages'].values():
        url = item.get('resolved', '')
        if url.startswith(MIRROR):
            if not item.get('integrity') or '?' in url or '#' in url or '..' in url:
                raise ValueError('Private mirror package lacks safe identity')
            item['resolved'] = REGISTRY + url[len(MIRROR):]
    return obj

def install(root):
    root = root.resolve()
    link = root / 'node_modules'
    if link.exists() or link.is_symlink():
        target = link.resolve()
        if (not link.is_symlink() or not target.name == 'node_modules' or
                not target.parent.name.startswith(PREFIX) or
                not (target.parent / '.kfaah-generated-dependencies').is_file()):
            raise ValueError('Existing node_modules preserved; use a clean checkout for this helper')
    lock = normalized_lock((root / 'package-lock.json').read_text())
    directory = Path(tempfile.mkdtemp(prefix=PREFIX))
    shutil.copyfile(root / 'package.json', directory / 'package.json')
    (directory / 'package-lock.json').write_text(json.dumps(lock))
    subprocess.run(['npm', 'ci', '--prefix', str(directory), '--no-audit', '--no-fund'], check=True)
    (directory / '.kfaah-generated-dependencies').touch()
    # Old generated directories remain available; no unknown files are removed.
    if link.is_symlink():
        link.unlink()
    link.symlink_to(directory / 'node_modules', target_is_directory=True)
    print('Frozen dependencies installed; tracked manifests and integrity unchanged.')

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path.cwd())
    args = parser.parse_args()
    install(args.root)
