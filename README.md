# منصة كفاءة

منصة كفاءة لإدارة التسويق الإلكتروني للجمعيات. المصدر في هذا المستودع هو المصدر المعتمد للواجهة والتطوير.

## التشغيل الحالي

- الموقع العام: https://kfaah.sa
- الاستضافة: Hetzner
- الواجهة: React + TypeScript + Vite
- قاعدة البيانات والمصادقة والتخزين: البنية الذاتية الخاصة بكفاءة
- البريد: Zoho عبر خدمة كفاءة المستقلة
- الذكاء الاصطناعي: وظائف كفاءة تستخدم إعدادات `KFAAH_AI_*` ولا تعتمد على بوابة Lovable

## التطوير المحلي

يتطلب Node.js 22 وnpm:

```sh
npm ci
npm run dev
```

لبناء نسخة إنتاج:

```sh
npm run build
```

## إعداد الواجهة

يجب أن تشير الواجهة إلى بوابة كفاءة نفسها:

```env
VITE_SUPABASE_URL=https://kfaah.sa
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

لا تضع مفاتيح خاصة أو كلمات مرور داخل المستودع.

## الذكاء الاصطناعي

وظائف الذكاء تستخدم متغيرات كفاءة المحايدة:

```env
KFAAH_AI_CHAT_URL=...
KFAAH_AI_RESPONSES_URL=...
KFAAH_AI_API_KEY=...
```

يمكن توجيهها إلى خدمة OpenAI-compatible محلية أو مستقلة. لا توجد حاجة إلى بوابة Lovable في المصدر الحالي.

## البريد

البريد التشغيلي يستخدم Zoho/خدمة كفاءة. الإعدادات الحساسة تحفظ كأسرار على الخادم ولا تحفظ في GitHub. من متغيرات التوافق في المصدر:

```env
ZOHO_MAIL_USER=info@kfaah.sa
ZOHO_MAIL_APP_PASSWORD=...
KFAAH_EMAIL_SEND_URL=...
KFAAH_EMAIL_API_KEY=...
KFAAH_EMAIL_WEBHOOK_SECRET=...
```

## النشر

المسار المعتمد:

1. تعديل المصدر في GitHub.
2. نجاح فحص `Kfaah source check`.
3. تشغيل `.github/workflows/deploy-kfaah.yml` إلى staging.
4. مراجعة staging.
5. الترقية الصريحة إلى الموقع الحي فقط بعد الاعتماد.

النشر لا يستخدم Docker لإعادة بناء الخادم ولا يغيّر قاعدة البيانات.

## فحوص الاستقلال

بناء الإنتاج يرفض وجود روابط تشغيلية إلى:

- `lovable.app`
- `lovable.dev`
- `ai.gateway.lovable.dev`
- نطاقات Supabase السحابية القديمة

الملفات الموجودة تحت `docs/legacy-plans` هي أرشيف تاريخي فقط وليست جزءًا من التشغيل.
