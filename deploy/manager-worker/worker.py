#!/usr/bin/env python3
import base64
import hashlib
import json
import os
import re
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
    },
  });
});
""",
        encoding="utf-8",
    )
    return config

def ensure_vite(tunnel_url):
    host = urlparse(tunnel_url).hostname or ""
    host_file = ROOT / "vite-allowed-host.txt"
    current_host = host_file.read_text().strip() if host_file.exists() else ""
    if current_host == host and wait_http("http://127.0.0.1:4173/", attempts=1, delay=0):
        return

    subprocess.run(
        ["pkill", "-u", str(os.getuid()), "-f", "node.*vite"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    time.sleep(0.5)

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
    host_file.write_text(host, encoding="utf-8")

def read_tunnel_url():
    if not TUNNEL_LOG.exists():
        return None
    text = TUNNEL_LOG.read_text(encoding="utf-8", errors="ignore")
    matches = re.findall(r"https://[a-z0-9-]+\.trycloudflare\.com", text)
    return matches[-1] if matches else None

def ensure_tunnel():
    current = read_tunnel_url()
    if current and subprocess.run(
        ["pgrep", "-u", str(os.getuid()), "-f", "cloudflared tunnel"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    ).returncode == 0:
        return current

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
        if url:
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
    for edit in edits:
        path = str(edit.get("path") or "")
        old = edit.get("old")
        new = edit.get("new")
        if not path or new is None:
            raise RuntimeError("Invalid edit payload")
        if path not in ("index.html", "vite.config.ts") and not (
            path.startswith("src/") or path.startswith("public/")
        ):
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

def announce_preview(job):
    tunnel_url = ensure_tunnel()
    ensure_vite(tunnel_url)
    preview_path = job.get("previewPath") or "/"
    target = tunnel_url + preview_path
    if not wait_http(target, attempts=20, delay=0.25):
        raise RuntimeError("Preview route did not become reachable")
    json_post("/_api/preview-live-ready", {
        "commandId": str(job["commandId"]),
        "token": job["callbackToken"],
        "previewUrl": tunnel_url,
        "previewPath": preview_path,
    })

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
    tunnel_url = ensure_tunnel()
    ensure_vite(tunnel_url)
    log("worker started at " + tunnel_url)
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
