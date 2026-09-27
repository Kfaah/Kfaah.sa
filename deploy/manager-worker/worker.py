#!/usr/bin/env python3
import base64
import hashlib
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(os.environ.get("KFAAH_FAST_ROOT", "/home/deploy/kfaah-fast"))
WORKSPACE = ROOT / "workspace"
PRIVATE_KEY = ROOT / "private.pem"
MANAGER_URL = os.environ.get("KFAAH_MANAGER_URL", "https://kfaah-manager.floot.app").rstrip("/")
WORKER_ID = os.environ.get("KFAAH_WORKER_ID", "kfaah-fast-1")
NODE_BIN = ROOT / "node" / "bin"
PLAYWRIGHT = WORKSPACE / "node_modules" / ".bin" / "playwright"
VITE_LOG = ROOT / "vite.log"
WORKER_LOG = ROOT / "worker.log"

def log(message):
    print(time.strftime("%Y-%m-%d %H:%M:%S"), message, flush=True)

def body_hash(body):
    return hashlib.sha256(body).hexdigest()

def sign(method, path, ts, body=b""):
    message = f"{method}\n{path}\n{ts}\n{body_hash(body)}".encode()
    proc = subprocess.run(
        ["openssl", "dgst", "-sha256", "-sign", str(PRIVATE_KEY)],
        input=message,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    return base64.b64encode(proc.stdout).decode()

def signed_request(method, path, payload=None, timeout=30):
    body = b""
    headers = {}
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
        headers["Content-Type"] = "application/json"
    ts = str(int(time.time()))
    headers["X-Kfaah-Worker"] = WORKER_ID
    headers["X-Kfaah-Timestamp"] = ts
    headers["X-Kfaah-Signature"] = sign(method, path, ts, body)
    req = urllib.request.Request(MANAGER_URL + path, data=(body if method != "GET" else None), headers=headers, method=method)
    return urllib.request.urlopen(req, timeout=timeout)

def json_post(path, payload, timeout=30):
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    req = urllib.request.Request(
        MANAGER_URL + path,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode())

def ensure_vite():
    try:
        with urllib.request.urlopen("http://127.0.0.1:4173/", timeout=1) as response:
            if response.status < 500:
                return
    except Exception:
        pass
    env = os.environ.copy()
    env["PATH"] = str(NODE_BIN) + os.pathsep + env.get("PATH", "")
    log_handle = open(VITE_LOG, "ab", buffering=0)
    subprocess.Popen(
        [str(NODE_BIN / "npm"), "run", "dev", "--", "--host", "127.0.0.1", "--port", "4173"],
        cwd=WORKSPACE,
        env=env,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    for _ in range(60):
        try:
            with urllib.request.urlopen("http://127.0.0.1:4173/", timeout=1) as response:
                if response.status < 500:
                    return
        except Exception:
            time.sleep(0.25)
    raise RuntimeError("Vite preview did not start")

def reset_workspace():
    subprocess.run(["git", "reset", "--hard", "HEAD"], cwd=WORKSPACE, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    subprocess.run(["git", "clean", "-fd", "-e", "node_modules/"], cwd=WORKSPACE, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def apply_edits(edits):
    reset_workspace()
    for edit in edits:
        path = str(edit.get("path") or "")
        old = edit.get("old")
        new = edit.get("new")
        if not path or new is None:
            raise RuntimeError("Invalid edit payload")
        if path not in ("index.html", "vite.config.ts") and not (path.startswith("src/") or path.startswith("public/")):
            raise RuntimeError("Path not allowed: " + path)
        target = (WORKSPACE / path).resolve()
        if not str(target).startswith(str(WORKSPACE.resolve()) + os.sep):
            raise RuntimeError("Path escape rejected")
        if old is None:
            if target.exists():
                raise RuntimeError("Create target already exists: " + path)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(str(new), encoding="utf-8")
            continue
        if not target.exists():
            raise RuntimeError("Target missing: " + path)
        text = target.read_text(encoding="utf-8")
        old = str(old)
        count = text.count(old)
        if not old or count != 1:
            raise RuntimeError(f"Expected exact old text once in {path}, found {count}")
        target.write_text(text.replace(old, str(new), 1), encoding="utf-8")

def capture(preview_path, command_id):
    ensure_vite()
    time.sleep(0.8)
    desktop = ROOT / f"preview-{command_id}-desktop.png"
    mobile = ROOT / f"preview-{command_id}-mobile.png"
    url = "http://127.0.0.1:4173" + preview_path
    env = os.environ.copy()
    env["PATH"] = str(NODE_BIN) + os.pathsep + env.get("PATH", "")
    common = [str(PLAYWRIGHT), "screenshot", "--full-page", "--wait-for-timeout=800"]
    subprocess.run(common + ["--viewport-size=1440,900", url, str(desktop)], cwd=WORKSPACE, env=env, check=True, timeout=30)
    subprocess.run(common + ["--viewport-size=390,844", url, str(mobile)], cwd=WORKSPACE, env=env, check=True, timeout=30)
    return desktop, mobile

def upload_preview(job, desktop, mobile):
    token = job["callbackToken"]
    command_id = str(job["commandId"])
    target = json_post("/_api/preview-upload-target", {
        "commandId": command_id,
        "token": token,
        "desktopSize": desktop.stat().st_size,
        "mobileSize": mobile.stat().st_size,
        "previewPath": job.get("previewPath") or "/",
    })
    subprocess.run(["curl", "-fsS", "-X", "PUT", "-H", "Content-Type: image/png", "--data-binary", "@" + str(desktop), target["desktopPresignedUrl"]], check=True, timeout=60)
    subprocess.run(["curl", "-fsS", "-X", "PUT", "-H", "Content-Type: image/png", "--data-binary", "@" + str(mobile), target["mobilePresignedUrl"]], check=True, timeout=60)
    json_post("/_api/preview-upload-complete", {"commandId": command_id, "token": token})

def finish_job(job, ok, error=None):
    payload = {
        "jobId": str(job["jobId"]),
        "commandId": str(job["commandId"]),
        "token": job["callbackToken"],
        "ok": bool(ok),
        "branch": job.get("branch") or "",
        "error": error or "",
    }
    try:
        json_post("/_api/worker-job-complete", payload)
    except Exception as exc:
        log("job completion callback failed: " + repr(exc))

def process_job(job):
    try:
        log("processing job " + str(job.get("jobId")))
        apply_edits(job.get("edits") or [])
        desktop, mobile = capture(job.get("previewPath") or "/", str(job["commandId"]))
        upload_preview(job, desktop, mobile)
        finish_job(job, True)
        log("completed job " + str(job.get("jobId")))
    except Exception as exc:
        log("job failed: " + repr(exc))
        finish_job(job, False, str(exc)[:1000])

def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    if not PRIVATE_KEY.exists():
        raise RuntimeError("worker private key missing")
    ensure_vite()
    log("worker started")
    while True:
        try:
            with signed_request("GET", "/_api/worker-next-job", timeout=15) as response:
                if response.status == 204:
                    time.sleep(0.6)
                    continue
                data = json.loads(response.read().decode())
                job = data.get("job")
                if job:
                    process_job(job)
                else:
                    time.sleep(0.6)
        except urllib.error.HTTPError as exc:
            if exc.code in (204, 404, 503):
                time.sleep(1.0)
            else:
                log("poll HTTP error " + str(exc.code))
                time.sleep(2.0)
        except Exception as exc:
            log("poll error: " + repr(exc))
            time.sleep(2.0)

if __name__ == "__main__":
    main()
