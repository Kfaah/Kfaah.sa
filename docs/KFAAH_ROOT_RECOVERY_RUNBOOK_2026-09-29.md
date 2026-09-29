# Kfaah Root Recovery Runbook — 2026-09-29

## هدف هذا المسار

استعادة backend منصة كفاءة على Hetzner إلى Supabase Native Edge Runtime مع:
- عدم منح deploy user صلاحية root عامة.
- عدم تطبيق migrations على الإنتاج قبل اختبارها على clone معزول من قاعدة الإنتاج.
- عدم تحويل Nginx إلى Native Edge قبل قبول schema الإنتاج.
- نسخة احتياطية قبل كل تغيير backend.
- rollback تلقائي عند فشل smoke بعد cutover.
- استعادة جمعية تدبر بسياسة missing-only بعد نجاح المنصة الأساسية.

## ثوابت السلامة

1. لا تستخدم `supabase db reset` على الإنتاج.
2. لا تُلغ Lovable قبل اكتمال اختبارات القبول الحية.
3. لا تُعد كتابة سجل موجود من نسخة احتياطية لمجرد اختلافه؛ البيانات الحالية تُحفظ وتذهب للمراجعة.
4. لا تستعد `super_admin` تلقائياً من النسخ القديمة.
5. لا تفك نسخة تدبر إلا بمفتاح خاص بصمته العامة:
   `fa7e02da0a4f6c41da30383b3af1861f67168a0f1548ad6c4eb4495c78496570`.
6. لا تحول `/functions/v1/` من 9001 إلى 8000 إلا بعد نجاح Native canary وProduction Schema Gate.

## المرحلة 1 — bootstrap لمرة واحدة

تُنفذ من جلسة operator مخولة بـroot، من نسخة repository المراجعة:

```bash
cd /path/to/reviewed/shop-soulmate-04
sudo RECOVERY_OPERATOR="$(id -un)" SOURCE_ROOT="$PWD" \
  bash deploy/recovery/install_limited_recovery_sudo.sh
```

النتيجة المتوقعة:
- `/usr/local/bin/kfaah-backend-recovery`
- root-owned recovery scripts تحت `/usr/local/libexec/`
- `/var/lib/kfaah-recovery/incoming` قابل للكتابة فقط للـoperator.
- sudoers يسمح فقط بالـdispatcher المقيد، وليس shell عام.
- لا يحدث cutover في هذه الخطوة.

تحقق:

```bash
sudo -n /usr/local/bin/kfaah-backend-recovery audit
```

## المرحلة 2 — Stage Native Functions

شغّل يدوياً Workflow:

`Kfaah Stage Native Functions`

الـWorkflow:
- يغلّف `supabase/functions` + `supabase/migrations` + `types.ts`.
- يحسب SHA-256.
- يرسل الحزمة إلى `/var/lib/kfaah-recovery/incoming`.
- الـroot wrapper يعيد فحص SHA ومسارات tar.
- يأخذ backup قبل استبدال Native functions.
- يثبت نسخة العقد الحالية root-owned.
- يبطل أي `schema-ready` سابق.
- يشغّل `native-canary`.
- لا يغير Nginx.

## المرحلة 3 — Clone Plan للمخطط

شغّل يدوياً Workflow:

`Kfaah Production Schema Clone Plan`

أو على السيرفر:

```bash
sudo -n /usr/local/bin/kfaah-backend-recovery schema-plan
```

هذه الخطوة:
- تأخذ pg_dump من الإنتاج للقراءة فقط.
- تبني PostgreSQL clone مؤقتاً بنفس DB image.
- الشبكة في clone معطلة.
- تطبق migrations غير المسجلة على clone فقط.
- تقارن clone بعقد `types.ts`.
- تدقق RLS.
- تكتب `plan-manifest.json`.
- تزيل container/volume المؤقتين.
- لا تعدل قاعدة الإنتاج.

**إذا فشلت أي migration على clone: توقف.**
لا تطبق شيئاً على الإنتاج. أصلح migration/reconciliation ثم أعد Clone Plan.

## المرحلة 4 — إصلاح schema الإنتاج

هذه المرحلة لا تُنفذ آلياً حتى ينجح Clone Plan الفعلي على Hetzner.

قبل أي تطبيق:
- راجع `missing_migrations` في manifest.
- راجع أي اختلافات schema/RLS.
- تأكد أن مصدر migrations لم يتغير بعد الخطة.
- خذ backup جديد.
- استخدم migration history المتوافق مع Supabase CLI؛ لا تكتفِ بإضافة `version` يدوياً.

بعد إصلاح schema أعد Production Schema Gate.

## المرحلة 5 — Production Schema Gate

شغّل:

`Kfaah Production Schema Gate`

أو:

```bash
sudo -n /usr/local/bin/kfaah-backend-recovery schema-gate
```

البوابة تتطلب:
- كل جداول عقد التطبيق.
- كل أعمدة عقد التطبيق.
- صفر RLS hard failures.
- صفر global-admin-without-org warnings.
- الدوال الأمنية الحرجة.
- جدول `public_rate_limits`.
- cron `cleanup-public-rate-limits-daily` عند `17 3 * * *`.

فقط عند النجاح تُكتب:
`/var/lib/kfaah-recovery/schema-ready`

بصلاحية root:root 0600 وبصمة العقد المقبول.

## المرحلة 6 — Cutover

شغّل Workflow:

`Kfaah Native Functions Cutover`

وأدخل حرفياً:
`CONFIRM-NATIVE-CUTOVER`

الـdispatcher يرفض cutover إذا:
- schema-ready غير موجود.
- marker ليس root-owned 0600.
- بصمة العقد المقبول لا تطابق العقد الحالي.
- native-canary يفشل.

عند النجاح:
- backup جديد.
- Nginx `/functions/v1/` يتحول من 9001 إلى 8000.
- `nginx -t`.
- reload.
- Workflow يجري setup-demo + Auth login + membership smoke على `https://kfaah.sa`.

إذا فشل smoke:
- Workflow يستدعي `rollback-last` تلقائياً.

## المرحلة 7 — Rollback يدوي

Workflow:
`Kfaah Native Functions Rollback`

التأكيد:
`ROLLBACK-NATIVE-FUNCTIONS`

أو:

```bash
sudo -n /usr/local/bin/kfaah-backend-recovery rollback-last
```

## المرحلة 8 — اختبارات القبول الحية

لا تعتبر الاستعادة مكتملة قبل نجاح:
- تسجيل الدخول.
- org-scoped auth.
- إنشاء/تعديل/حذف موظف.
- رفع org-documents.
- رفع data-uploads.
- سجل `file_size_bytes`.
- AI analysis persistence.
- deep analysis.
- plan generation.
- tasks.
- marketing functions.
- reports.
- email flows.
- organization branding.
- storage read/write.
- system-admin routes.
- cross-org denial tests.

## المرحلة 9 — تدبر

بعد استقرار المنصة:

1. حدد المفتاح الخاص المطابق للبصمة الموثوقة، خارج project.
2. فك النسخة الموثوقة إلى مجلد معزول فقط:
   `restore-secure-backup.mjs`.
3. شغّل:
   `plan-tadabbur-reconcile.mjs`
   أولاً بدون current snapshot لاستخراج نطاق تدبر.
4. خذ Current Snapshot محدوداً بالمفاتيح الموثوقة:
   `export_tadabbur_current_snapshot.py`.
5. أعد reconcile مع `CURRENT_DATABASE_JSON`.
6. يجب أن تكون السياسة:
   - missing public rows: مرشحة فقط.
   - conflicts: preserve current + manual review.
   - unkeyed: manual review.
   - missing auth: manual only.
   - super_admin: never automatic.
   - storage: copy only if bucket/path absent.
7. أنشئ Rehearsal SQL:
   `generate-tadabbur-rehearsal-sql.mjs`.
   هذا SQL ينتهي دائماً بـROLLBACK ولا يملك COMMIT.
8. نفذ rehearsal على clone قبل أي تطبيق فعلي.
9. بعد نجاح rehearsal فقط تُبنى عملية apply منفصلة مع backup ومراجعة.

## الوضع الحالي

الإنتاج الحي لا يزال على Python compatibility gateway للمسار `/functions/v1/` على port 9001.
Native Supabase gateway على 8000 موجود، لكن لا يتم cutover قبل المراحل أعلاه.

هذه الوثيقة لا تعتبر أي خطوة production ناجحة إلا إذا أعطى الاختبار الحي نتيجة نجاح صريحة.
