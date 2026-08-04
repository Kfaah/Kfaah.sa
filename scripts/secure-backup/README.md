# النسخ الاحتياطي المشفّر — secure-backup-to-github

> **مسار المجلد:** هذه الملفات في `scripts/secure-backup/` وليست في `scripts/backup/`، لأن قاعدة `backup/` في `.gitignore` تستثني أي مجلد بهذا الاسم في أي عمق، فلم تكن الملفات تُحفظ في المستودع إطلاقاً. لا تنقلها إلى `scripts/backup/`.

## نظرة عامة
- الوظيفة `secure-backup-to-github` تُصدّر جميع جداول `public` ديناميكياً، وبيانات الدخول الضرورية من `auth` (users / identities / mfa_factors فقط)، وبيانات `storage` الوصفية، وملفات التخزين الفعلية.
- التشفير هجين: **AES-256-GCM** للبيانات + **RSA-OAEP (SHA-256)** لتغليف مفتاح AES. المفتاح الخاص غير موجود داخل المشروع ولا يُرفع إلى GitHub.
- تُرفع الأجزاء المشفّرة فقط إلى `secure-backups/YYYY/MM/DD/<timestamp>/` مع `manifest.json` غير حساس.
- الجدولة: `secure-backup-daily` عبر pg_cron يومياً الساعة **03:00 UTC**.

## الاستعادة
الأداة `scripts/secure-backup/restore-secure-backup.mjs` **تفك التشفير وتتحقق وتستخرج محلياً فقط** — وهي ليست استعادة إنتاج تلقائية.

1. جهّز المفتاح الخاص RSA **خارج مجلد المشروع** (الأداة ترفض مفتاحاً داخل المشروع)، ولا يُخزَّن في المستودع أبداً.
2. نزّل مجلد النسخة المطلوب من مستودع النسخ الخاص (يحوي `manifest.json` وأجزاء `*.enc.json`).
3. شغّل:

```bash
BACKUP_DIR=./downloaded/2026/08/04/<timestamp> \
PRIVATE_KEY_PEM_PATH="$HOME/.secrets/kfaah-backup-private.pem" \
RESTORE_OUTPUT_DIR=./restore-out \
node scripts/secure-backup/restore-secure-backup.mjs
```

ما تفعله الأداة بالترتيب:
- تتحقق أن بصمة المفتاح العام المشتق من المفتاح الخاص تطابق `manifest.public_key_fingerprint_sha256` **قبل** فك أي جزء.
- ترفض أي نسخة حالتها ليست `success` إلا مع `ALLOW_PARTIAL=yes`.
- تتحقق من `SHA-256` لكل جزء أولاً، ثم تفك RSA-OAEP(SHA-256) ثم AES-256-GCM.
- تكتب `database.json` و`storage/` و`restore-report.json` (أعداد وبصمة ونتيجة، بلا بيانات حساسة) في `RESTORE_OUTPUT_DIR` فقط.
- تمنع path traversal بصرامة وترفض أسماء buckets/مسارات خطرة.

**التحميل إلى قاعدة بيانات ليس تلقائياً.** مع `CONFIRM_RESTORE=yes` يجب توفير `RESTORE_DATABASE_URL` يبدو `test`/`staging`/`localhost`، ثم تتوقف الأداة برسالة واضحة بأن تحميل البيانات يحتاج خطة إدراج مراجعة. لا تُنفَّذ أي عملية حذف أو إدراج. اختبار تحميل كامل إلى **قاعدة اختبار منفصلة** هو خطوة تشغيلية لاحقة بمراجعة بشرية.

## جولة التدقيق الأمني — 2026-08-04
1. **التحقق من الهوية:** لا قبول بمجرد فك حمولة JWT وقراءة `role`. الاستدعاء الداخلي بمطابقة **timing-safe** مع `SUPABASE_SERVICE_ROLE_KEY` أو بتحقق خادمي من مفتاح service role. المستخدم: تحقق الجلسة ثم `is_super_admin`.
2. **فصل الصلاحيات:** أي `backup_id`/`stage`/`cursor` يُرفض بـ 403 لغير الداخلي.
3. **منع التزامن:** سجل `running` أحدث من ساعتين ⇒ 409؛ الأقدم يُعلَّم `failed` (stale) دون حذف.
4. **manifest:** يحتوي `public_key_fingerprint_sha256`.
5. **saveProgress:** يرفع استثناءً عند فشل التحديث.

نتيجة آخر تشغيل تجريبي: `success` — 105 جدول، 3345 صف، 101 ملف (= عدد `storage.objects`)، 6 أجزاء، 7 التزامات = الأجزاء + 1، أكبر جزء ≈ 8.57MB (< 40MB)، 0 أخطاء، البصمة `fa7e02da0a4f6c41da30383b3af1861f67168a0f1548ad6c4eb4495c78496570`، وcron `secure-backup-daily` وحيد ومفعّل `0 3 * * *`.

> لا توضع أي أسرار أو مفاتيح أو كلمات مرور في هذا المجلد أو في السجلات.