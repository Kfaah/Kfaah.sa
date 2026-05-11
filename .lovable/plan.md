## الخطة

### ١. تنظيف شعارات الجمعيات (إبقاء الرمز فقط داخل الدائرة)

الجمعيات التي تحتاج معالجة (شعار + نص ملتصق):
- عطاء (`ataa-white-v1.png`)
- عطف (`atff-white-v1.png`)
- نجباء (`nujabaa-white-v1.png`)
- حرف (`harf-icon-bigger-v3.png`) — للتأكد
- نجاة (`najah-logo.png`)
- مآثر (`maather` من numo)
- سكينة (`sakinah` من sakinah.org.sa)
- القصبة (`d-alqasaba`)
- التنمية الأهلية (`tanmiah-alaridh-icon.png`)
- صواب (`sawab-logo-centered-v8.png`) — للتأكد
- عون الطبية (`awon-medical-icon.png`) — للتأكد
- النموذج/Demo

**الطريقة لكل شعار**:
1. تنزيل الأصل من Supabase Storage إلى `/tmp`.
2. تحليل الصورة بـ PIL: استخراج المكوّنات المتصلة (connected components) لتحديد الكتلة الأكبر/الأكثر تماسكاً = الرمز، والكتل النصية = نص.
3. اقتصاص الرمز فقط بـ bbox، إضافة هامش متساوٍ، توسيطه في كانفس مربع شفاف.
4. رفع نسخة جديدة `…-icon-only-v1.png` إلى bucket `avatars/org-logos/`.
5. ميجريشن واحد يحدّث `organizations.logo_url` و `organization_profiles.logo_url` لكل الجمعيات دفعة واحدة.

ملاحظة: في حال صورة لا تنفصل تلقائياً بشكل نظيف، سأعيد المعالجة يدوياً بـ crop محدّد لتلك الجمعية فقط.

### ٢. توحيد الهيدر في صفحات الجمعيات

الوضع الحالي: `PageHeader` موحّد بصرياً، لكن الارتفاع ومكان الإدراج مختلفان من صفحة لأخرى (`min-h-[112px]` احياناً، وأحياناً صفحات تستخدم رؤوس مخصصة بدون `PageHeader` أصلاً).

**الإجراءات**:
- تثبيت ارتفاع موحّد في `PageHeader` (مثلاً `h-[120px] sm:h-[140px]` بدل `min-h`).
- توحيد الـ padding الخارجي (`px-4 sm:px-6 py-4`) وموقعه (مباشرة في أعلى محتوى الصفحة، بدون margin top إضافي).
- مسح كل صفحة جمعية واستبدال الهيدر المخصص بـ `<PageHeader />` (Tasks, Plans, Donors, Members, Settings, Performance, Messages, Intelligence, OperationalPlans…).
- التأكد أن `OrgInternalDashboard` يلتزم بنفس النمط.

### ٣. تطبيق هوية الجمعية على مركز التبرعات

`DonorsHub` معروض داخل تبويب من `OrgInternalDashboard` بدون `PageHeader`، لذلك يبدو خارج الهوية البصرية.

**الإجراءات**:
- إضافة `<PageHeader>` في أعلى `DonorsHub` بعنوان "مركز التبرعات" + أيقونة `HandHeart` + subtitle حسب الجمعية النشطة.
- التأكد أن الـ tabs الفرعية داخل DonorsHub (overview/donors/donations/top/recurring…) تستخدم `hsl(var(--primary))` و `hsl(var(--accent))` بدلاً من اللون الثابت `#2f8e8c`.
- إزالة المتغير `brand` المثبّت يدوياً والاعتماد على CSS variables التي يحقنها `OrgBrandingContext`.

### تفاصيل تقنية

- معالجة الصور: Python + PIL (`getbbox`, `ImageChops`, optional connected components عبر `scipy.ndimage.label`).
- الميجريشن: `UPDATE` على جدولين فقط بدون تغيير schema.
- الكود: تعديلات على `PageHeader.tsx`، `DonorsHub.tsx`، وصفحات الجمعيات الفردية.

### نطاق غير مشمول

- لن أغير منطق صفحات admin (مثل AdminCompare) لأنها خارج نطاق "صفحات الجمعيات".
- لن أعيد تصميم محتوى DonorsHub، فقط الهيدر والألوان.
