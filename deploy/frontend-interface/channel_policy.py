"""Review-only binding. No network, secrets, server commands or activation flags."""
import json
from pathlib import Path

REPOSITORY = 'Kfaah/Kfaah.sa'
OWNER_ID = 341028123
FIELDS = {'repository', 'owner_id', 'expected_current', 'baseline_manifest_sha256',
          'build_tools_commit', 'audit_tools_commit', 'stage_tools_commit'}

def unique(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise ValueError('DUPLICATE_APPROVAL_FIELD')
        out[key] = value
    return out

def approval():
    path = Path(__file__).with_name('channel-approval.json')
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 4096:
        raise ValueError('APPROVAL_FILE_REJECTED')
    obj = json.loads(path.read_text(), object_pairs_hook=unique)
    if (type(obj) is not dict or set(obj) != FIELDS or
            obj['repository'] != REPOSITORY or type(obj['owner_id']) is not int or
            obj['owner_id'] != OWNER_ID):
        raise ValueError('APPROVAL_IDENTITY_REJECTED')
    return obj

if __name__ == '__main__':
    obj = approval()
    missing = sorted(key for key, value in obj.items() if value is None)
    print('Repository: ' + REPOSITORY)
    print('Owner ID: ' + str(OWNER_ID))
    print('Server execution: LOCKED (workflow and Python guards)')
    print('Unverified release bindings: ' + ', '.join(missing))
