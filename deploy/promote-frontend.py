#!/usr/bin/python3
"""Promote a verified frontend release atomically and roll back on HTTP mismatch."""
import datetime, fcntl, hashlib, html, os, re, shutil, stat, sys, time, uuid
from pathlib import Path
from urllib.request import Request, urlopen

def validate_tree(root):
    if root.is_symlink() or not root.is_dir():
        raise ValueError("Release must be a regular directory")
    for path in root.rglob("*"):
        mode = path.lstat().st_mode
        if not (stat.S_ISREG(mode) or stat.S_ISDIR(mode)):
            raise ValueError("Unsupported release entry: " + str(path.relative_to(root)))

def validate_release(root):
    validate_tree(root)
    index = root / "index.html"
    body = index.read_bytes()
    text = body.decode("utf-8")
    if '<div id="root"' not in text:
        raise ValueError("Not a Kfaah SPA")
    if re.search(r"supabase\.co|lovable\.app|lovable-badge", text, re.I):
        raise ValueError("Blocked frontend origin")
    refs = re.findall(r'(?:src|href)=["\'](/?(?:assets/[^"\']+|hide-badge\.js))["\']', text)
    assets = []
    for ref in refs:
        rel = html.unescape(ref).lstrip("/").split("?")[0]
        path = root / rel
        if ".." in Path(rel).parts or not path.is_file() or not path.resolve().is_relative_to(root.resolve()):
            raise ValueError("Missing or unsafe entry asset: " + rel)
        assets.append(rel)
    if not any(p.startswith("assets/") and p.endswith(".js") for p in assets):
        raise ValueError("No entry JS")
    return ["index.html", *dict.fromkeys(assets)]

def point(link, target):
    temporary = link.with_name(link.name + ".next-" + uuid.uuid4().hex)
    temporary.symlink_to(target, target_is_directory=True)
    os.replace(temporary, link)

def promote(stage, current, releases, verify):
    if not current.is_symlink():
        raise ValueError("Current release pointer is not initialized")
    previous = current.resolve(strict=True)
    if not previous.is_relative_to(releases.resolve()):
        raise ValueError("Current pointer outside releases")
    assets = validate_release(stage)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    candidate = releases / (".building-" + stamp)
    final = releases / stamp
    shutil.copytree(stage, candidate, symlinks=True)
    validate_tree(candidate)
    # Retain hashed chunks needed by tabs that were already open.
    if (previous / "assets").is_dir():
        for source in (previous / "assets").rglob("*"):
            destination = candidate / "assets" / source.relative_to(previous / "assets")
            if source.is_file() and not source.is_symlink() and not destination.exists():
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
    validate_release(candidate)
    for path in candidate.rglob("*"):
        os.chmod(path, 0o755 if path.is_dir() else 0o644)
    os.chmod(candidate, 0o755)
    candidate.rename(final)
    point(current, final)
    try:
        verify(final, assets)
    except BaseException:
        point(current, previous)
        raise
    return final, previous

def verify_http(release, assets):
    for relative in assets:
        expected = (release / relative).read_bytes()
        last_error = None
        for attempt in range(5):
            try:
                url = "https://kfaah.sa/" + ("" if relative == "index.html" else relative)
                request = Request(url + "?release-check=" + uuid.uuid4().hex, headers={"Cache-Control": "no-cache"})
                with urlopen(request, timeout=20) as response:
                    actual = response.read()
                if hashlib.sha256(actual).digest() != hashlib.sha256(expected).digest():
                    raise ValueError("Live content differs: " + relative)
                last_error = None
                break
            except Exception as error:
                last_error = error
                if attempt < 4:
                    time.sleep(1)
        if last_error:
            raise last_error

def main():
    if sys.argv[1:] != ["--live"]:
        raise SystemExit("usage: kfaah-promote-frontend --live")
    with open("/run/lock/kfaah-promote-frontend.lock", "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        final, previous = promote(Path("/var/www/kfaah-staging"), Path("/var/www/kfaah-current"), Path("/var/www/kfaah-releases"), verify_http)
        result = datetime.datetime.now(datetime.timezone.utc).isoformat() + " LIVE_OK release=" + str(final) + " rollback=" + str(previous)
        with open("/var/log/kfaah-deploy.log", "a") as log:
            log.write(result + "\n")
        print(result)

if __name__ == "__main__":
    main()
