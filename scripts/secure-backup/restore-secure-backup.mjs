#!/usr/bin/env node
/**
 * أداة فك وتحقق واستخراج نسخة secure-backup-to-github.
 *
 * ملاحظة مسار: هذه الأداة تعيش في scripts/secure-backup/ وليس scripts/backup/
 * لأن قاعدة `backup/` في .gitignore تستثني أي مجلد بهذا الاسم فلا يُحفظ في المستودع.
 *
 * تعمل محلياً فقط. الوضع الافتراضي dry run: تفك التشفير، تتحقق من SHA-256،
 * وتستخرج database.json و storage/ إلى مجلد محلي. لا تتصل بأي قاعدة إنتاج
 * ولا تنفّذ أي INSERT أو DELETE.
 *
 * متغيرات البيئة:
 *   BACKUP_DIR             (مطلوب) مجلد نسخة محمّل محلياً يحوي manifest.json و *.enc.json
 *   PRIVATE_KEY_PEM_PATH   (مطلوب) مسار المفتاح الخاص RSA — يجب أن يكون خارج المشروع
 *   RESTORE_OUTPUT_DIR     (اختياري) مجلد الإخراج، الافتراضي ./restore-out
 *   ALLOW_PARTIAL=yes      (اختياري) للسماح بنسخة حالتها ليست success
 *   CONFIRM_RESTORE=yes    (اختياري) يتطلب RESTORE_DATABASE_URL لقاعدة اختبار، ثم يتوقف بوضوح
 *   RESTORE_DATABASE_URL   (مع CONFIRM_RESTORE) يجب أن يبدو test/staging/localhost
 *
 * مثال:
 *   BACKUP_DIR=./downloaded/2026/08/04/20260804T031000Z \
 *   PRIVATE_KEY_PEM_PATH=$HOME/.secrets/kfaah-backup-private.pem \
 *   node scripts/secure-backup/restore-secure-backup.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const fail = (msg) => {
  console.error(`✖ ${msg}`);
  process.exit(1);
};
const info = (msg) => console.log(`• ${msg}`);

const env = process.env;
const BACKUP_DIR = env.BACKUP_DIR;
const PRIVATE_KEY_PEM_PATH = env.PRIVATE_KEY_PEM_PATH;
const OUT_DIR = path.resolve(env.RESTORE_OUTPUT_DIR || './restore-out');
const ALLOW_PARTIAL = env.ALLOW_PARTIAL === 'yes';
const CONFIRM_RESTORE = env.CONFIRM_RESTORE === 'yes';

if (!BACKUP_DIR) fail('BACKUP_DIR غير محدد.');
if (!PRIVATE_KEY_PEM_PATH) fail('PRIVATE_KEY_PEM_PATH غير محدد.');

const backupDir = path.resolve(BACKUP_DIR);
if (!fs.existsSync(backupDir) || !fs.statSync(backupDir).isDirectory()) {
  fail('BACKUP_DIR غير موجود أو ليس مجلداً.');
}

// المفتاح الخاص يجب أن يكون خارج شجرة المشروع.
const projectRoot = path.resolve(process.cwd());
const keyPath = path.resolve(PRIVATE_KEY_PEM_PATH);
if (keyPath === projectRoot || keyPath.startsWith(projectRoot + path.sep)) {
  fail('المفتاح الخاص يجب أن يكون خارج مجلد المشروع. انقله إلى مسار آمن ثم أعد المحاولة.');
}
if (!fs.existsSync(keyPath)) fail('ملف المفتاح الخاص غير موجود.');

// ---------- manifest ----------
const manifestPath = path.join(backupDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) fail('manifest.json غير موجود داخل BACKUP_DIR.');
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch {
  fail('manifest.json غير قابل للقراءة كـ JSON.');
}

if (manifest.status !== 'success' && !ALLOW_PARTIAL) {
  fail(`حالة النسخة "${manifest.status}" وليست success. استخدم ALLOW_PARTIAL=yes للمتابعة عن قصد.`);
}
if (!Array.isArray(manifest.parts) || manifest.parts.length === 0) {
  fail('manifest لا يحتوي قائمة أجزاء صالحة.');
}

// ---------- المفتاح الخاص وبصمة المفتاح العام ----------
let privateKey;
try {
  privateKey = crypto.createPrivateKey({
    key: fs.readFileSync(keyPath, 'utf8'),
    passphrase: env.PRIVATE_KEY_PASSPHRASE || undefined,
  });
} catch (e) {
  fail(`تعذر تحميل المفتاح الخاص: ${e.message}`);
}

const derivedPublicDer = crypto
  .createPublicKey(privateKey)
  .export({ type: 'spki', format: 'der' });
const derivedFingerprint = crypto.createHash('sha256').update(derivedPublicDer).digest('hex');
const expectedFingerprint = String(manifest.public_key_fingerprint_sha256 || '').toLowerCase();

if (!expectedFingerprint) {
  fail('manifest لا يحتوي public_key_fingerprint_sha256 — لا يمكن التأكد من مطابقة المفتاح.');
}
if (
  derivedFingerprint.length !== expectedFingerprint.length ||
  !crypto.timingSafeEqual(Buffer.from(derivedFingerprint), Buffer.from(expectedFingerprint))
) {
  fail('بصمة المفتاح العام المشتق من المفتاح الخاص لا تطابق بصمة المفتاح في manifest. توقف قبل فك أي جزء.');
}
info(`بصمة المفتاح مطابقة: ${derivedFingerprint}`);

// ---------- التحقق من SHA-256 لكل جزء أولاً ----------
const partFiles = [];
for (const part of manifest.parts) {
  const name = String(part?.name ?? '');
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name.includes('..')) {
    fail(`اسم جزء غير آمن في manifest: ${name}`);
  }
  const filePath = path.join(backupDir, name);
  if (path.dirname(path.resolve(filePath)) !== backupDir) fail(`مسار جزء غير آمن: ${name}`);
  if (!fs.existsSync(filePath)) fail(`الجزء مفقود محلياً: ${name}`);
  const raw = fs.readFileSync(filePath, 'utf8');
  const digest = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  if (digest !== String(part.sha256).toLowerCase()) {
    fail(`فشل تحقق SHA-256 للجزء ${name}. النسخة قد تكون تالفة أو معدّلة.`);
  }
  partFiles.push({ name, kind: part.kind, raw });
}
info(`تم التحقق من SHA-256 لـ ${partFiles.length} جزء بنجاح.`);

// ---------- فك التشفير ----------
function decryptEnvelope(envelopeText, name) {
  let env0;
  try {
    env0 = JSON.parse(envelopeText);
  } catch {
    fail(`الجزء ${name} ليس JSON صالحاً.`);
  }
  if (env0.alg && !/RSA-OAEP/i.test(env0.alg)) {
    fail(`الجزء ${name} يستخدم خوارزمية غير مدعومة: ${env0.alg}`);
  }
  const aesKey = crypto.privateDecrypt(
    { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(env0.encrypted_key, 'base64'),
  );
  if (aesKey.length !== 32) fail(`طول مفتاح AES غير متوقع في ${name}.`);

  const iv = Buffer.from(env0.iv, 'base64');
  const full = Buffer.from(env0.ciphertext, 'base64');
  const tag = full.subarray(full.length - 16);
  const body = full.subarray(0, full.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(tag);
  let plain;
  try {
    plain = Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    fail(`فشل التحقق من سلامة AES-GCM للجزء ${name}.`);
  }
  aesKey.fill(0);
  try {
    return JSON.parse(plain.toString('utf8'));
  } catch {
    fail(`محتوى الجزء ${name} غير قابل للقراءة كـ JSON.`);
  }
}

// ---------- منع path traversal بصرامة ----------
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
function safeJoinUnder(rootDir, segments) {
  for (const seg of segments) {
    if (!seg || seg === '.' || seg === '..' || !SAFE_SEGMENT.test(seg) || seg.startsWith('.')) {
      return null;
    }
  }
  const target = path.resolve(rootDir, ...segments);
  const rootResolved = path.resolve(rootDir);
  if (target !== rootResolved && !target.startsWith(rootResolved + path.sep)) return null;
  return target;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const storageOut = path.join(OUT_DIR, 'storage');
fs.mkdirSync(storageOut, { recursive: true });

const database = { tables: {} };
let filesWritten = 0;
let bytesWritten = 0;
const rejectedPaths = [];

for (const part of partFiles) {
  const payload = decryptEnvelope(part.raw, part.name);

  if (part.kind === 'database') {
    const tables = payload?.tables ?? {};
    for (const [table, rows] of Object.entries(tables)) {
      database.tables[table] = rows;
    }
  } else if (part.kind === 'storage-files') {
    for (const f of payload?.files ?? []) {
      const bucket = String(f?.bucket ?? '');
      const objPath = String(f?.path ?? '');
      if (!SAFE_SEGMENT.test(bucket)) {
        rejectedPaths.push('bucket_rejected');
        continue;
      }
      if (
        !objPath ||
        objPath.includes('\0') ||
        objPath.includes('\\') ||
        path.isAbsolute(objPath) ||
        objPath.split('/').some((s) => s === '..')
      ) {
        rejectedPaths.push('path_rejected');
        continue;
      }
      const target = safeJoinUnder(storageOut, [bucket, ...objPath.split('/')]);
      if (!target) {
        rejectedPaths.push('path_rejected');
        continue;
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const buf = Buffer.from(String(f.content_b64 ?? ''), 'base64');
      fs.writeFileSync(target, buf, { mode: 0o600 });
      filesWritten += 1;
      bytesWritten += buf.byteLength;
    }
  } else {
    info(`نوع جزء غير معروف تم تخطيه: ${part.kind}`);
  }
}

const dbPath = path.join(OUT_DIR, 'database.json');
fs.writeFileSync(dbPath, JSON.stringify(database, null, 2), { mode: 0o600 });

const tableNames = Object.keys(database.tables);
const rowCount = tableNames.reduce(
  (acc, t) => acc + (Array.isArray(database.tables[t]) ? database.tables[t].length : 0),
  0,
);

// ---------- تقرير غير حساس ----------
const report = {
  tool: 'restore-secure-backup',
  mode: CONFIRM_RESTORE ? 'confirm-requested' : 'dry-run',
  ran_at: new Date().toISOString(),
  manifest_status: manifest.status,
  manifest_counts: manifest.counts ?? null,
  public_key_fingerprint_sha256: derivedFingerprint,
  parts_verified: partFiles.length,
  sha256_verified: true,
  tables_extracted: tableNames.length,
  rows_extracted: rowCount,
  files_extracted: filesWritten,
  file_bytes_extracted: bytesWritten,
  rejected_unsafe_entries: rejectedPaths.length,
  loaded_into_database: false,
  result: 'decrypted_verified_extracted',
};
fs.writeFileSync(path.join(OUT_DIR, 'restore-report.json'), JSON.stringify(report, null, 2), {
  mode: 0o600,
});

info(`تم الاستخراج إلى: ${OUT_DIR}`);
info(`جداول: ${tableNames.length} | صفوف: ${rowCount} | ملفات: ${filesWritten} | مرفوض: ${rejectedPaths.length}`);

// ---------- بوابة الحماية ----------
if (CONFIRM_RESTORE) {
  const url = env.RESTORE_DATABASE_URL || '';
  if (!url) fail('CONFIRM_RESTORE=yes يتطلب RESTORE_DATABASE_URL لقاعدة اختبار.');
  if (!/(test|staging|localhost|127\.0\.0\.1)/i.test(url)) {
    fail('RESTORE_DATABASE_URL لا يبدو قاعدة اختبار/staging/localhost. تم الإيقاف لحماية الإنتاج.');
  }
  console.log(
    '\n⚠ توقف مقصود: تم فك التشفير والتحقق والاستخراج بنجاح، لكن تحميل البيانات إلى قاعدة\n' +
      '  يحتاج خطة إدراج مراجعة (ترتيب الجداول، القيود، المفاتيح الأجنبية، بيانات auth/storage).\n' +
      '  لم يُنفَّذ أي DELETE أو INSERT. راجع database.json ثم نفّذ خطة تحميل معتمدة يدوياً\n' +
      '  على قاعدة اختبار منفصلة فقط.',
  );
  process.exit(0);
}

console.log('\n✔ dry run انتهى: فك تشفير + تحقق SHA-256 + استخراج محلي فقط. لم يُلمس أي قاعدة بيانات.');