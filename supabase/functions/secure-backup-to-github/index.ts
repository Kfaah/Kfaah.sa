// Secure encrypted backup -> GitHub (private repo, encrypted parts only).
//
// Security model:
//  - Hybrid encryption: AES-256-GCM for payloads, AES key wrapped with RSA-OAEP(SHA-256).
//  - The RSA private key is NOT in this project and never reaches GitHub.
//  - Only encrypted parts + a non-sensitive manifest are uploaded.
//  - Secret values (token/owner/repo/service key) are never logged.
//
// Execution model: the job is split into small self-chaining stages so no single
// invocation exceeds the edge CPU budget.
//   entry -> stage=database (cursor over tables) -> stage=storage (cursor over objects) -> stage=finalize

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const BACKUP_FORMAT_VERSION = 1;
const ALG = 'RSA-OAEP-256+AES-256-GCM';
const MAX_PART_RAW_BYTES = 6 * 1024 * 1024;   // keeps encrypted+base64 part far below 40MB
const CPU_BUDGET_MS = 5000;                   // wall-clock budget per invocation stage
const TABLE_PAGE = 1000;
const AUTH_PAGE = 500;

const RSA_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAoBQitNtNjiZtpsUN3nMu
rgMCpb7U392Ht0RtR3a5QtJen87iYJ51h4FCVofmWJB/5mwLIMYodK//7iIVmaQR
xxlsEIH4wwdMHoYIIN//DilWkCaCzDwxFUdW6TB9qXvXRzZ9RI8fH8WVHyPXZTTj
DDT0xZ6HaodUuZBd06sD6c5pQ1pmIcKWo4K5YdnslsRK0G/nMznKEe7m+7paJM51
yqC6U5Hua2XQ26+4xFn25K/pnNR7cAb7DW+r7lVHgEtywk2ZNuv1UsdurniWSXZQ
5X7vqMR+be9C++/B83tok4DCEl7X0HsjTTbvLC5O/n30gUoej9AGhnFu1m1Tnhqr
vsU9O5zNS/XuOUkqwKJPXLi9C5nzC5C6zyiOGpaG+ZkwBN3ZE71f5HsisskHOPfS
vQCMI+VP9NsF/5PLA12tLlhZvbHtq4YFJHHJTE2iVkcWLg3CYOMJH2/4x10WZd5p
znr1rhwVE7Gg9g8NLqCU/cp2cw5YlQ7V4iDrcm/SMTjgxxmcxRloCQeDxfOF750c
yazavD2vWCznxJ7R2V5wyvLJU5zbR3X7mvL/3ew46N9PambXJr1yo+kaX5/UbxfG
5t3OgyDbOPgsZ1FEeyaUMwDOLA7cEo5q0lXpG7smL6YFb2WAWolZLjBv+nCSxZDd
C8qSXa5wYNsopJSY0DyjuTkCAwEAAQ==
-----END PUBLIC KEY-----`;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function b64encode(bytes: Uint8Array): string {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(out);
}

function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const raw = atob(body);
  const der = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) der[i] = raw.charCodeAt(i);
  return der;
}

let cachedRsaKey: CryptoKey | null = null;
async function getRsaKey(): Promise<CryptoKey> {
  if (!cachedRsaKey) {
    cachedRsaKey = await crypto.subtle.importKey(
      'spki',
      pemToDer(RSA_PUBLIC_KEY_PEM),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    );
  }
  return cachedRsaKey;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Fingerprint of the public key (DER/SPKI) — safe to publish, contains no private material.
async function publicKeyFingerprint(): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', pemToDer(RSA_PUBLIC_KEY_PEM));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function encryptEnvelope(plaintext: Uint8Array, meta: Record<string, unknown>): Promise<string> {
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext));
  const rawAes = new Uint8Array(await crypto.subtle.exportKey('raw', aesKey));
  const wrapped = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, await getRsaKey(), rawAes),
  );
  return JSON.stringify({
    format: BACKUP_FORMAT_VERSION,
    alg: ALG,
    meta,
    encrypted_key: b64encode(wrapped),
    iv: b64encode(iv),
    ciphertext: b64encode(ct),
  });
}

async function githubPut(path: string, contentText: string, message: string): Promise<string> {
  const token = Deno.env.get('GITHUB_BACKUP_TOKEN');
  const owner = Deno.env.get('GITHUB_BACKUP_OWNER');
  const repo = Deno.env.get('GITHUB_BACKUP_REPO');
  if (!token || !owner || !repo) throw new Error('github_backup_secrets_missing');

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'kfaah-secure-backup',
    },
    body: JSON.stringify({ message, content: b64encode(new TextEncoder().encode(contentText)) }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`github_put_failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  return json?.commit?.html_url ?? '';
}

type Part = { name: string; kind: string; sha256: string; bytes: number };
type Progress = {
  base_path: string;
  parts: Part[];
  commit_urls: string[];
  errors: string[];
  tables: number;
  rows: number;
  files: number;
  file_bytes: number;
};

const adminClient = () => createClient(SUPABASE_URL, SERVICE_KEY);

async function loadProgress(admin: ReturnType<typeof adminClient>, id: string): Promise<Progress> {
  const { data } = await admin.from('secure_backup_logs').select('manifest').eq('id', id).single();
  return (data?.manifest ?? {}) as Progress;
}

async function saveProgress(
  admin: ReturnType<typeof adminClient>,
  id: string,
  p: Progress,
  extra: Record<string, unknown> = {},
) {
  const { error } = await admin.from('secure_backup_logs').update({
    manifest: p,
    tables_count: p.tables,
    rows_count: p.rows,
    files_count: p.files,
    total_bytes: p.file_bytes,
    parts_count: p.parts.length,
    errors_count: p.errors.length,
    error_summary: p.errors.length ? p.errors.slice(0, 20).join(' | ').slice(0, 4000) : null,
    commit_urls: p.commit_urls.slice(-25),
    ...extra,
  }).eq('id', id);
  if (error) throw new Error(`progress_update_failed: ${error.message}`);
}

async function chain(stage: string, backupId: string, cursor: number) {
  // Dispatched through pg_net so the next stage survives this invocation shutting down.
  const { error } = await adminClient().rpc('sb_enqueue_backup_stage', {
    _stage: stage,
    _backup_id: backupId,
    _cursor: cursor,
  });
  if (error) throw new Error(`stage_dispatch_failed(${stage}): ${error.message}`);
}

async function uploadPart(
  admin: ReturnType<typeof adminClient>,
  p: Progress,
  kind: string,
  payload: unknown,
) {
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const index = p.parts.filter((x) => x.kind === kind).length;
  const envelope = await encryptEnvelope(plaintext, {
    kind,
    index,
    created_at: new Date().toISOString(),
    raw_bytes: plaintext.byteLength,
  });
  const name = `${kind}-${String(index).padStart(4, '0')}.enc.json`;
  const url = await githubPut(`${p.base_path}/${name}`, envelope, `secure backup: ${kind} part ${index}`);
  if (url) p.commit_urls.push(url);
  p.parts.push({ name, kind, sha256: await sha256Hex(envelope), bytes: envelope.length });
}

// Length-safe, timing-safe string comparison.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  // Compare hashes so unequal lengths don't short-circuit.
  if (x.length !== y.length) {
    let acc = 0;
    for (let i = 0; i < Math.max(x.length, y.length); i++) acc |= (x[i] ?? 0) ^ (y[i] ?? 1);
    return acc === 0 && x.length === y.length;
  }
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

type Caller = 'internal' | 'super_admin' | null;

async function authorize(req: Request): Promise<Caller> {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();

  // Internal caller: the token must BE the actual service role key (constant-time compare).
  // Never trust a self-asserted `role` claim inside an unverified JWT payload.
  if (SERVICE_KEY && timingSafeEqual(token, SERVICE_KEY)) return 'internal';

  const anon = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data, error } = await anon.auth.getClaims(token);
  const userId = data?.claims?.sub as string | undefined;
  if (error || !userId) return null;
  const { data: isSuper } = await adminClient().rpc('is_super_admin', { _user_id: userId });
  return isSuper === true ? 'super_admin' : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const caller = await authorize(req);
  if (!caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = adminClient();
  let body: { stage?: string; backup_id?: string; cursor?: number } = {};
  try { body = await req.json(); } catch { /* empty body = entry */ }

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    // Stage/cursor dispatch is internal-only: a super_admin session may start a backup
    // entry but can never drive stages or cursors manually.
    if ((body.backup_id || body.stage || body.cursor !== undefined) && caller !== 'internal') {
      return json({ error: 'forbidden_stage_dispatch' }, 403);
    }

    // ---------------- entry ----------------
    if (!body.backup_id) {
      // Single-flight guard: never run two backups in parallel.
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: runningRows, error: runningErr } = await admin.from('secure_backup_logs')
        .select('id, started_at').eq('status', 'running').order('started_at', { ascending: false });
      if (runningErr) throw new Error(`running_lookup_failed: ${runningErr.message}`);

      const stale = (runningRows ?? []).filter((r) => r.started_at < twoHoursAgo);
      for (const r of stale) {
        // Mark stale runs failed — records are kept, never deleted.
        const { error: staleErr } = await admin.from('secure_backup_logs').update({
          status: 'failed',
          error_summary: 'stale_running_run_marked_failed (no progress for over 2 hours)',
          finished_at: new Date().toISOString(),
        }).eq('id', r.id);
        if (staleErr) throw new Error(`stale_update_failed: ${staleErr.message}`);
      }

      const active = (runningRows ?? []).find((r) => r.started_at >= twoHoursAgo);
      if (active) {
        return json({ error: 'backup_already_running', backup_id: active.id }, 409);
      }

      const now = new Date();
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, '0');
      const d = String(now.getUTCDate()).padStart(2, '0');
      const basePath = `secure-backups/${y}/${m}/${d}/${now.toISOString().replace(/[:.]/g, '-')}`;

      const progress: Progress = {
        base_path: basePath, parts: [], commit_urls: [], errors: [],
        tables: 0, rows: 0, files: 0, file_bytes: 0,
      };
      const { data: row, error } = await admin.from('secure_backup_logs')
        .insert({ backup_type: 'full', status: 'running', remote_path: basePath, manifest: progress })
        .select('id').single();
      if (error) throw new Error(`log_insert_failed: ${error.message}`);

      await chain('database', row!.id, 0);
      console.log('secure backup started');
      return json({ status: 'started', backup_id: row!.id, remote_path: basePath });
    }

    const backupId = body.backup_id;
    const cursor = body.cursor ?? 0;
    const progress = await loadProgress(admin, backupId);
    const t0 = Date.now();

    // ---------------- database stage ----------------
    if (body.stage === 'database') {
      const { data: tableList, error: listErr } = await admin.rpc('sb_list_public_tables');
      if (listErr) throw new Error(`list_tables_failed: ${listErr.message}`);
      const names = ((tableList ?? []) as { table_name: string }[]).map((t) => t.table_name);
      // pseudo entries appended after the public tables
      const units = [...names, '__auth__', '__storage_metadata__'];

      const buffer: Record<string, unknown[]> = {};
      let bufferBytes = 0;
      let i = cursor;

      for (; i < units.length; i++) {
        const unit = units[i];

        if (unit === '__auth__') {
          const authDump: Record<string, unknown[]> = {};
          for (const t of ['users', 'identities', 'mfa_factors']) {
            const rows: unknown[] = [];
            let off = 0;
            for (;;) {
              const { data, error } = await admin.rpc('sb_dump_auth_table', { _table: t, _limit: AUTH_PAGE, _offset: off });
              if (error) { progress.errors.push(`auth:${t}: ${error.message}`); break; }
              const page = (data ?? []) as unknown[];
              rows.push(...page);
              if (page.length < AUTH_PAGE) break;
              off += AUTH_PAGE;
            }
            authDump[t] = rows;
            progress.rows += rows.length;
          }
          buffer['__auth__'] = [authDump];
          bufferBytes += 200_000;
        } else if (unit === '__storage_metadata__') {
          const { data, error } = await admin.rpc('sb_dump_storage_metadata');
          if (error) progress.errors.push(`storage_metadata: ${error.message}`);
          buffer['__storage_metadata__'] = [data ?? {}];
          bufferBytes += 200_000;
        } else {
          const rows: unknown[] = [];
          let off = 0;
          for (;;) {
            const { data, error } = await admin.rpc('sb_dump_public_table', { _table: unit, _limit: TABLE_PAGE, _offset: off });
            if (error) { progress.errors.push(`table:${unit}: ${error.message}`); break; }
            const page = (data ?? []) as unknown[];
            rows.push(...page);
            if (page.length < TABLE_PAGE) break;
            off += TABLE_PAGE;
            if (off > 500_000) break;
          }
          progress.tables += 1;
          progress.rows += rows.length;
          buffer[unit] = rows;
          bufferBytes += JSON.stringify(rows).length;
        }

        if (bufferBytes >= MAX_PART_RAW_BYTES || Date.now() - t0 > CPU_BUDGET_MS) { i++; break; }
      }

      if (Object.keys(buffer).length) await uploadPart(admin, progress, 'database', { tables: buffer });
      await saveProgress(admin, backupId, progress);

      if (i < units.length) await chain('database', backupId, i);
      else await chain('storage', backupId, 0);
      return json({ stage: 'database', next_cursor: i, of: units.length });
    }

    // ---------------- storage files stage ----------------
    if (body.stage === 'storage') {
      const { data: meta, error: metaErr } = await admin.rpc('sb_dump_storage_metadata');
      if (metaErr) throw new Error(`storage_metadata_failed: ${metaErr.message}`);
      const objects = ((meta as { objects?: { bucket_id: string; name: string }[] })?.objects ?? [])
        .filter((o) => o?.bucket_id && o?.name);

      const files: { bucket: string; path: string; content_b64: string }[] = [];
      let bytes = 0;
      let i = cursor;

      for (; i < objects.length; i++) {
        const o = objects[i];
        const { data: blob, error } = await admin.storage.from(o.bucket_id).download(o.name);
        if (error || !blob) {
          progress.errors.push(`download:${o.bucket_id}: ${error?.message ?? 'empty'}`);
          continue;
        }
        const buf = new Uint8Array(await blob.arrayBuffer());
        progress.files += 1;
        progress.file_bytes += buf.byteLength;
        files.push({ bucket: o.bucket_id, path: o.name, content_b64: b64encode(buf) });
        bytes += Math.ceil(buf.byteLength * 1.34);
        if (bytes >= MAX_PART_RAW_BYTES || Date.now() - t0 > CPU_BUDGET_MS) { i++; break; }
      }

      if (files.length) await uploadPart(admin, progress, 'storage-files', { files });
      await saveProgress(admin, backupId, progress);

      if (i < objects.length) await chain('storage', backupId, i);
      else await chain('finalize', backupId, 0);
      return json({ stage: 'storage', next_cursor: i, of: objects.length });
    }

    // ---------------- finalize ----------------
    if (body.stage === 'finalize') {
      const { data: row } = await admin.from('secure_backup_logs')
        .select('started_at').eq('id', backupId).single();
      const status = progress.errors.length === 0 ? 'success' : 'partial';
      const manifest = {
        format: BACKUP_FORMAT_VERSION,
        alg: ALG,
        created_at: row?.started_at ?? new Date().toISOString(),
        finished_at: new Date().toISOString(),
        status,
        public_key_fingerprint_sha256: await publicKeyFingerprint(),
        counts: {
          tables: progress.tables,
          rows: progress.rows,
          files: progress.files,
          parts: progress.parts.length,
          errors: progress.errors.length,
        },
        total_file_bytes: progress.file_bytes,
        parts: progress.parts,
      };
      const url = await githubPut(`${progress.base_path}/manifest.json`, JSON.stringify(manifest, null, 2), 'secure backup: manifest');
      if (url) progress.commit_urls.push(url);
      await saveProgress(admin, backupId, progress, { status, finished_at: new Date().toISOString(), manifest });
      console.log(`secure backup ${status}: tables=${progress.tables} rows=${progress.rows} files=${progress.files} parts=${progress.parts.length} errors=${progress.errors.length}`);
      return json({ status, manifest });
    }

    return json({ error: 'unknown_stage' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('secure backup failed:', msg);
    if (body.backup_id) {
      await admin.from('secure_backup_logs').update({
        status: 'failed',
        error_summary: msg.slice(0, 4000),
        finished_at: new Date().toISOString(),
      }).eq('id', body.backup_id);
    }
    return json({ error: 'backup_failed', details: msg }, 500);
  }
});
