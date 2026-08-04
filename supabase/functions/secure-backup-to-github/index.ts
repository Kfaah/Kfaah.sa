// Secure encrypted backup -> GitHub (private repo, encrypted parts only).
//
// Security model:
//  - Hybrid encryption: AES-256-GCM for payloads, AES key wrapped with RSA-OAEP(SHA-256).
//  - The RSA private key is NOT in this project and never reaches GitHub.
//  - Only encrypted parts + a non-sensitive manifest are uploaded.
//  - Secret values (token/owner/repo) are never logged.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const BACKUP_FORMAT_VERSION = 1;
const ALG = 'RSA-OAEP-256+AES-256-GCM';
// Raw bytes per part before encryption. Keeps each encrypted+base64 part well under 40MB.
const MAX_PART_RAW_BYTES = 14 * 1024 * 1024;
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
  if (cachedRsaKey) return cachedRsaKey;
  cachedRsaKey = await crypto.subtle.importKey(
    'spki',
    pemToDer(RSA_PUBLIC_KEY_PEM),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );
  return cachedRsaKey;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Encrypts plaintext bytes into a self-describing JSON envelope (text). */
async function encryptEnvelope(plaintext: Uint8Array, meta: Record<string, unknown>): Promise<string> {
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext),
  );
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

async function githubPut(
  path: string,
  contentText: string,
  message: string,
): Promise<string> {
  const token = Deno.env.get('GITHUB_BACKUP_TOKEN');
  const owner = Deno.env.get('GITHUB_BACKUP_OWNER');
  const repo = Deno.env.get('GITHUB_BACKUP_REPO');
  if (!token || !owner || !repo) throw new Error('github_backup_secrets_missing');

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'kfaah-secure-backup',
      },
      body: JSON.stringify({
        message,
        content: b64encode(new TextEncoder().encode(contentText)),
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    // Never log the token; body may include the repo path only.
    throw new Error(`github_put_failed [${res.status}]: ${body.slice(0, 400)}`);
  }
  const json = await res.json();
  return json?.commit?.html_url ?? '';
}

type PartInfo = { name: string; sha256: string; bytes: number; kind: string };

function stampPath(now: Date): { dir: string; stamp: string } {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return { dir: `secure-backups/${y}/${m}/${d}`, stamp };
}

async function authorize(req: Request): Promise<{ ok: boolean; reason?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return { ok: false, reason: 'missing_token' };
  const token = authHeader.slice(7);

  // service_role (cron / internal) is allowed.
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
    if (payload?.role === 'service_role') return { ok: true };
  } catch { /* not a decodable JWT; fall through */ }

  const anon = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );
  const { data, error } = await anon.auth.getClaims(token);
  const userId = data?.claims?.sub as string | undefined;
  if (error || !userId) return { ok: false, reason: 'invalid_token' };

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: isSuper } = await admin.rpc('is_super_admin', { _user_id: userId });
  if (isSuper !== true) return { ok: false, reason: 'not_super_admin' };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = await authorize(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: 'Unauthorized', reason: auth.reason }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const startedAt = new Date();
  const { dir, stamp } = stampPath(startedAt);
  const basePath = `${dir}/${stamp}`;

  const { data: logRow } = await admin
    .from('secure_backup_logs')
    .insert({ backup_type: 'full', status: 'running', remote_path: basePath })
    .select('id')
    .single();
  const logId = logRow?.id as string | undefined;

  const parts: PartInfo[] = [];
  const commitUrls: string[] = [];
  const errors: string[] = [];
  let tablesCount = 0;
  let rowsCount = 0;
  let filesCount = 0;
  let totalFileBytes = 0;

  const uploadPart = async (kind: string, index: number, payload: unknown) => {
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    const envelope = await encryptEnvelope(plaintext, {
      kind,
      index,
      created_at: new Date().toISOString(),
      raw_bytes: plaintext.byteLength,
    });
    const name = `${kind}-${String(index).padStart(4, '0')}.enc.json`;
    const url = await githubPut(`${basePath}/${name}`, envelope, `secure backup: ${kind} part ${index}`);
    if (url) commitUrls.push(url);
    parts.push({ name, sha256: await sha256Hex(envelope), bytes: envelope.length, kind });
  };

  try {
    // ---------- 1. Database: all public tables, dynamically ----------
    const { data: tableList, error: listErr } = await admin.rpc('sb_list_public_tables');
    if (listErr) throw new Error(`list_tables_failed: ${listErr.message}`);

    let dbBuffer: Record<string, unknown[]> = {};
    let dbBufferBytes = 0;
    let dbPartIndex = 0;

    const flushDb = async () => {
      if (Object.keys(dbBuffer).length === 0) return;
      await uploadPart('database', dbPartIndex++, { tables: dbBuffer });
      dbBuffer = {};
      dbBufferBytes = 0;
    };

    for (const t of (tableList ?? []) as { table_name: string }[]) {
      const rows: unknown[] = [];
      let offset = 0;
      // paged read so huge tables do not blow memory in one call
      for (;;) {
        const { data, error } = await admin.rpc('sb_dump_public_table', {
          _table: t.table_name,
          _limit: TABLE_PAGE,
          _offset: offset,
        });
        if (error) {
          errors.push(`table:${t.table_name}: ${error.message}`);
          break;
        }
        const page = (data ?? []) as unknown[];
        rows.push(...page);
        if (page.length < TABLE_PAGE) break;
        offset += TABLE_PAGE;
        if (offset > 500_000) break;
      }
      tablesCount++;
      rowsCount += rows.length;
      dbBuffer[t.table_name] = rows;
      dbBufferBytes += JSON.stringify(rows).length;
      if (dbBufferBytes >= MAX_PART_RAW_BYTES) await flushDb();
    }

    // ---------- 2. Restore-critical auth data ----------
    const authDump: Record<string, unknown[]> = {};
    for (const t of ['users', 'identities', 'mfa_factors']) {
      const rows: unknown[] = [];
      let offset = 0;
      for (;;) {
        const { data, error } = await admin.rpc('sb_dump_auth_table', {
          _table: t,
          _limit: AUTH_PAGE,
          _offset: offset,
        });
        if (error) {
          errors.push(`auth:${t}: ${error.message}`);
          break;
        }
        const page = (data ?? []) as unknown[];
        rows.push(...page);
        if (page.length < AUTH_PAGE) break;
        offset += AUTH_PAGE;
      }
      authDump[t] = rows;
      rowsCount += rows.length;
    }
    dbBuffer['__auth__'] = [authDump];

    // ---------- 3. Storage metadata ----------
    const { data: storageMeta, error: smErr } = await admin.rpc('sb_dump_storage_metadata');
    if (smErr) errors.push(`storage_metadata: ${smErr.message}`);
    dbBuffer['__storage_metadata__'] = [storageMeta ?? {}];
    await flushDb();

    // ---------- 4. Actual storage files ----------
    const { data: buckets, error: bErr } = await admin.storage.listBuckets();
    if (bErr) errors.push(`list_buckets: ${bErr.message}`);

    let fileBuffer: { bucket: string; path: string; content_b64: string }[] = [];
    let fileBufferBytes = 0;
    let filePartIndex = 0;

    const flushFiles = async () => {
      if (fileBuffer.length === 0) return;
      await uploadPart('storage-files', filePartIndex++, { files: fileBuffer });
      fileBuffer = [];
      fileBufferBytes = 0;
    };

    const walk = async (bucket: string, prefix: string, depth = 0): Promise<void> => {
      if (depth > 12) return;
      const { data: entries, error } = await admin.storage
        .from(bucket)
        .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
      if (error) {
        errors.push(`list:${bucket}/${prefix}: ${error.message}`);
        return;
      }
      for (const entry of entries ?? []) {
        const full = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (!entry.id) {
          await walk(bucket, full, depth + 1);
          continue;
        }
        const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(full);
        if (dlErr || !blob) {
          errors.push(`download:${bucket}/${full}: ${dlErr?.message ?? 'empty'}`);
          continue;
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        filesCount++;
        totalFileBytes += bytes.byteLength;
        fileBuffer.push({ bucket, path: full, content_b64: b64encode(bytes) });
        fileBufferBytes += Math.ceil(bytes.byteLength * 1.34);
        if (fileBufferBytes >= MAX_PART_RAW_BYTES) await flushFiles();
      }
    };

    for (const b of buckets ?? []) {
      await walk(b.name, '');
    }
    await flushFiles();

    // ---------- 5. Non-sensitive manifest ----------
    const status = errors.length === 0 ? 'success' : 'partial';
    const manifest = {
      format: BACKUP_FORMAT_VERSION,
      alg: ALG,
      created_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      status,
      counts: {
        tables: tablesCount,
        rows: rowsCount,
        files: filesCount,
        parts: parts.length,
        errors: errors.length,
      },
      total_file_bytes: totalFileBytes,
      parts: parts.map((p) => ({ name: p.name, kind: p.kind, sha256: p.sha256, bytes: p.bytes })),
    };
    const manifestUrl = await githubPut(
      `${basePath}/manifest.json`,
      JSON.stringify(manifest, null, 2),
      'secure backup: manifest',
    );
    if (manifestUrl) commitUrls.push(manifestUrl);

    if (logId) {
      await admin.from('secure_backup_logs').update({
        status,
        tables_count: tablesCount,
        rows_count: rowsCount,
        files_count: filesCount,
        total_bytes: totalFileBytes,
        parts_count: parts.length,
        errors_count: errors.length,
        error_summary: errors.length ? errors.slice(0, 20).join(' | ').slice(0, 4000) : null,
        commit_urls: commitUrls.slice(-25),
        manifest,
        finished_at: new Date().toISOString(),
      }).eq('id', logId);
    }

    console.log(`secure backup ${status}: tables=${tablesCount} rows=${rowsCount} files=${filesCount} parts=${parts.length} errors=${errors.length}`);

    return new Response(JSON.stringify({ status, manifest, remote_path: basePath }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('secure backup failed:', msg);
    if (logId) {
      await admin.from('secure_backup_logs').update({
        status: 'failed',
        tables_count: tablesCount,
        rows_count: rowsCount,
        files_count: filesCount,
        total_bytes: totalFileBytes,
        parts_count: parts.length,
        errors_count: errors.length + 1,
        error_summary: [msg, ...errors].join(' | ').slice(0, 4000),
        commit_urls: commitUrls.slice(-25),
        finished_at: new Date().toISOString(),
      }).eq('id', logId);
    }
    return new Response(JSON.stringify({ error: 'backup_failed', details: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});