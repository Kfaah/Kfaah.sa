#!/usr/bin/env python3
import base64
import hashlib
import json
import os
import re
import signal
import subprocess
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse
from pathlib import Path

ROOT = Path(os.environ.get("KFAAH_FAST_ROOT", "/home/deploy/kfaah-fast"))
WORKSPACE = ROOT / "workspace"
BASELINE = ROOT / "baseline"
PRIVATE_KEY = ROOT / "private.pem"
MANAGER_URL = os.environ.get("KFAAH_MANAGER_URL", "https://kfaah-manager.floot.app").rstrip("/")
WORKER_ID = os.environ.get("KFAAH_WORKER_ID", "kfaah-fast-1")
NODE_BIN = ROOT / "node" / "bin"
CLOUDFLARED = ROOT / "cloudflared"
VITE_LOG = ROOT / "vite.log"
TUNNEL_LOG = ROOT / "cloudflared.log"
LAST_PREVIEW = ROOT / "last-preview.json"

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
    req = urllib.request.Request(
        MANAGER_URL + path,
        data=(body if method != "GET" else None),
        headers=headers,
        method=method,
    )
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

def wait_http(url, attempts=80, delay=0.25):
    for _ in range(attempts):
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status < 500:
                    return True
        except Exception:
            time.sleep(delay)
    return False

def ensure_fast_vite_config():
    config = WORKSPACE / "vite.fast.config.ts"
    config.write_text(
        """import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";
export default defineConfig((env) => {
  const base = typeof baseConfig === "function" ? baseConfig(env) : baseConfig;
  return mergeConfig(base, {
    server: {
      allowedHosts: true,
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
      hmr: false,
    },
  });
});
""",
        encoding="utf-8",
    )
    return config

def ensure_vite():
    if wait_http("http://127.0.0.1:4173/", attempts=1, delay=0):
        return

    stop_managed_processes("vite")

    config = ensure_fast_vite_config()
    env = os.environ.copy()
    env["PATH"] = str(NODE_BIN) + os.pathsep + env.get("PATH", "")
    log_handle = open(VITE_LOG, "ab", buffering=0)
    subprocess.Popen(
        [
            str(NODE_BIN / "npm"),
            "run",
            "dev",
            "--",
            "--config",
            str(config),
            "--host",
            "127.0.0.1",
            "--port",
            "4173",
        ],
        cwd=WORKSPACE,
        env=env,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    if not wait_http("http://127.0.0.1:4173/"):
        raise RuntimeError("Vite preview did not start")

def read_tunnel_url():
    if not TUNNEL_LOG.exists():
        return None
    text = TUNNEL_LOG.read_text(encoding="utf-8", errors="ignore")
    matches = re.findall(r"https://[a-z0-9-]+\.trycloudflare\.com", text)
    return matches[-1] if matches else None

def is_managed_process(kind, args, cwd):
    if kind == "cloudflared":
        return cwd == ROOT and args and args[0] == str(CLOUDFLARED) and "http://127.0.0.1:4173" in args
    return cwd == WORKSPACE and str(WORKSPACE / "node_modules/vite/bin/vite.js") in args and "--port" in args and args[args.index("--port") + 1:args.index("--port") + 2] == ["4173"]

def managed_process_ids(kind):
    found = []
    for proc in Path("/proc").iterdir():
        if not proc.name.isdigit(): continue
        try:
            if proc.stat().st_uid != os.getuid(): continue
            args = (proc / "cmdline").read_bytes().decode().rstrip(chr(0)).split(chr(0))
            if is_managed_process(kind, args, (proc / "cwd").resolve()):
                found.append(int(proc.name))
        except (OSError, UnicodeError): pass
    return found

def stop_managed_processes(kind):
    for pid in managed_process_ids(kind):
        try: os.kill(pid, signal.SIGTERM)
        except ProcessLookupError: pass
    time.sleep(0.5)

def cloudflared_running():
    return bool(managed_process_ids("cloudflared"))

def stop_cloudflared():
    stop_managed_processes("cloudflared")

def tunnel_healthy(url):
    return bool(url and wait_http(url.rstrip("/") + "/", attempts=2, delay=0.2))

def ensure_tunnel():
    current = read_tunnel_url()
    if current and cloudflared_running() and tunnel_healthy(current):
        return current

    stop_cloudflared()
    try:
        TUNNEL_LOG.unlink()
    except FileNotFoundError:
        pass

    log_handle = open(TUNNEL_LOG, "ab", buffering=0)
    subprocess.Popen(
        [str(CLOUDFLARED), "tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:4173"],
        cwd=ROOT,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    for _ in range(80):
        url = read_tunnel_url()
        if url and tunnel_healthy(url):
            return url
        time.sleep(0.5)
    raise RuntimeError("Cloudflare preview tunnel did not start")

def reset_workspace():
    if not BASELINE.exists():
        raise RuntimeError("Fast preview baseline is missing")
    subprocess.run(
        [
            "rsync",
            "-a",
            "--checksum",
            "--delete",
            "--exclude",
            "node_modules/",
            "--exclude",
            "vite.fast.config.ts",
            str(BASELINE) + "/",
            str(WORKSPACE) + "/",
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

def apply_edits(edits):
    reset_workspace()
    staged = {}
    for edit in edits:
        path = str(edit.get("path") or "")
        old, new = edit.get("old"), edit.get("new")
        parts = path.split("/")
        if not path or not isinstance(new, str) or "\\" in path or "%" in path or any(not p or p.startswith(".") for p in parts):
            raise RuntimeError("Invalid edit path")
        if path not in ("index.html", "vite.config.ts") and not (path.startswith("src/") or path.startswith("public/")):
            raise RuntimeError("Path not allowed: " + path)
        if any((WORKSPACE / Path(*parts[:i])).is_symlink() for i in range(1, len(parts) + 1)):
            raise RuntimeError("Symlink edit target rejected")
        target = (WORKSPACE / path).resolve()
        if not str(target).startswith(str(WORKSPACE.resolve()) + os.sep):
            raise RuntimeError("Path escape rejected")
        current = staged.get(path)
        exists = path in staged or target.exists()
        if current is None and exists:
            current = target.read_text(encoding="utf-8")
        if old is None:
            if exists: raise RuntimeError("Create target already exists: " + path)
            staged[path] = new
        else:
            if not isinstance(old, str) or not old or current is None or current.count(old) != 1:
                raise RuntimeError("Reviewed source does not match: " + path)
            staged[path] = current.replace(old, new, 1)
    for path, text in staged.items():
        target = WORKSPACE / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")

def validate_baseline(job):
    expected = str(job.get("baseSha") or "")
    marker = BASELINE / ".manager-base-sha"
    if job.get("protocolVersion") != 2 or not re.fullmatch("[a-f0-9]{40}", expected):
        raise RuntimeError("This job has no pinned source version; create a new request")
    if not marker.exists() or marker.read_text().strip() != expected:
        raise RuntimeError("Source baseline changed; synchronize the verified source before retrying")

def validate_build():
    env = os.environ.copy()
    env["PATH"] = str(NODE_BIN) + os.pathsep + env.get("PATH", "")
    stamp = ROOT / "dependencies.sha256"
    lock_hash = hashlib.sha256((WORKSPACE / "package-lock.json").read_bytes()).hexdigest()
    log_path = ROOT / "build.log"
    with open(log_path, "ab") as output:
        if not stamp.exists() or stamp.read_text().strip() != lock_hash:
            subprocess.run([str(NODE_BIN / "npm"), "ci", "--no-audit", "--no-fund"],
                cwd=WORKSPACE, env=env, stdout=output, stderr=subprocess.STDOUT, check=True, timeout=360)
            stamp.write_text(lock_hash)
        subprocess.run([str(NODE_BIN / "npm"), "run", "build"],
            cwd=WORKSPACE, env=env, stdout=output, stderr=subprocess.STDOUT, check=True, timeout=300)
    if not (WORKSPACE / "dist" / "index.html").is_file():
        raise RuntimeError("Build did not produce a page")


def save_last_preview(job, announced_url):
    data = {
        "commandId": str(job["commandId"]),
        "jobId": str(job["jobId"]),
        "callbackToken": job["callbackToken"],
        "previewPath": job.get("previewPath") or "/",
        "announcedUrl": announced_url,
    }
    LAST_PREVIEW.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

def send_preview_callback(job, tunnel_url):
    preview_path = job.get("previewPath") or "/"
    target = tunnel_url.rstrip("/") + preview_path
    if not wait_http(target, attempts=20, delay=0.25):
        raise RuntimeError("Preview route did not become reachable")
    json_post("/_api/preview-live-ready", {
        "commandId": str(job["commandId"]),
        "jobId": str(job["jobId"]),
        "token": job["callbackToken"],
        "previewUrl": tunnel_url,
        "previewPath": preview_path,
    })

def announce_preview(job):
    ensure_vite()
    tunnel_url = ensure_tunnel()
    send_preview_callback(job, tunnel_url)
    save_last_preview(job, tunnel_url)

def load_last_preview():
    if not LAST_PREVIEW.exists():
        return None
    try:
        return json.loads(LAST_PREVIEW.read_text(encoding="utf-8"))
    except Exception:
        return None

def maintain_preview():
    last = load_last_preview()
    if not last or not last.get("jobId"):
        return
    ensure_vite()
    tunnel_url = ensure_tunnel()
    preview_path = last.get("previewPath") or "/"
    target = tunnel_url.rstrip("/") + preview_path
    if not wait_http(target, attempts=2, delay=0.2):
        raise RuntimeError("Current preview route is not reachable")
    if last.get("announcedUrl") != tunnel_url:
        json_post("/_api/preview-live-ready", {
            "commandId": str(last["commandId"]),
            "jobId": str(last.get("jobId", "")),
            "token": last["callbackToken"],
            "previewUrl": tunnel_url,
            "previewPath": preview_path,
        })
        last["announcedUrl"] = tunnel_url
        LAST_PREVIEW.write_text(
            json.dumps(last, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        log("preview tunnel refreshed: " + tunnel_url)

def finish_job(job, ok, error=None):
    payload = {
        "jobId": str(job["jobId"]), "commandId": str(job["commandId"]),
        "token": job["callbackToken"], "ok": bool(ok),
        "branch": job.get("branch") or "", "error": error or "",
    }
    pending = ROOT / "pending-completion.json"
    pending.write_text(json.dumps(payload), encoding="utf-8")
    pending.chmod(0o600)
    retry_pending_completion()

def retry_pending_completion():
    pending = ROOT / "pending-completion.json"
    if not pending.exists(): return
    payload = json.loads(pending.read_text(encoding="utf-8"))
    try:
        json_post("/_api/worker-job-complete", payload)
        pending.unlink()
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 404, 409):
            log("completion no longer accepted: " + str(exc.code))
            pending.rename(ROOT / "rejected-completion.json")
        else: raise


def process_job(job):
    try:
        log("processing job " + str(job.get("jobId")))
        validate_baseline(job)
        if LAST_PREVIEW.exists():
            LAST_PREVIEW.rename(ROOT / "previous-preview.json")
        apply_edits(job.get("edits") or [])
        validate_build()
        announce_preview(job)
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
    tunnel_url = ensure_tunnel()
    log("worker started at " + tunnel_url)
    last_maintenance = 0.0
    while True:
        now = time.time()
        if now - last_maintenance >= 5.0:
            try:
                maintain_preview()
            except Exception as exc:
                log("preview maintenance error: " + repr(exc))
            last_maintenance = now
        try:
            retry_pending_completion()
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
