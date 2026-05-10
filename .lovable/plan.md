## خطة: مركز التقارير الذكي + إعادة ترتيب الواجهة

### 1) إعادة ترتيب التبويبات
- في `OrgInternalDashboard.tsx` و `Sidebar.tsx`: نقل **مركز التبرعات** ليكون مباشرة بعد **النظرة العامة** (قبل بقية التبويبات).

### 2) تبويب جديد: "التقارير" (Reports Hub)
يُضاف تبويب جديد داخل `OrgInternalDashboard.tsx` باسم **"التقارير"** ورابط في الشريط الجانبي. يحتوي على شبكة بطاقات لكل نوع تقرير، وعند فتح أي بطاقة تظهر صفحة تقرير كاملة بفلاتر (التاريخ، الفئة، المبلغ، الحالة) + جدول تفصيلي + KPIs + زر تصدير CSV/Excel + زر "اقتراحات ذكية" يُولّد توصيات وينزّلها كمهام.

#### بطاقات التقارير (8 تقارير):
1. **تقرير المتبرعين حسب الفئة المالية** — شرائح (≥5000، 1000–5000، 500–1000، <500). أعمدة: الاسم، الجوال، إجمالي التبرعات، آخر تبرع، نوع التواصل المقترح (خطاب/اتصال/واتساب/رسالة).
2. **تقرير الحملات** — لكل حملة: الهدف، المُحصَّل، نسبة الإنجاز، عدد المتبرعين، هل أُرسل تقرير ختامي؟ هل أُرسل شكر للمتبرعين؟
3. **تقرير التبرعات الفاشلة** — العدد حسب الفلتر، تم التواصل/لم يتم، أعادوا التبرع، نسبة الاسترجاع.
4. **تقرير السلال المتروكة** — العدد، تم التواصل، استُردت، نسبة الاسترداد، متوسط قيمة السلة.
5. **تقرير المستقطعين (المتكررين)** — العدد النشط/المتوقف، متوسط الاستقطاع، حالات التذبذب، من يحتاج تجديد.
6. **تقرير المتبرعين المتكررين** — تكرار، انتظام، مشاريع مفضلة، تاريخ آخر شكر.
7. **تقرير الإهداءات** — أكثر المُهدين، نسبة التسليم، حالات لم تُسلَّم.
8. **تقرير متبرعي المشاريع** — لكل مشروع/فئة (زكاة، إفطار، …): قائمة المتبرعين + هل أُرسل تقرير ربع سنوي؟

### 3) "اقتراحات ذكية" داخل كل تقرير
- زر داخل كل تقرير يستدعي edge function جديدة `report-suggestions` تستقبل (`report_type`, `filters`, `aggregates`) وتعيد:
  - `summary` نص قصير
  - `actions[]` كل عنصر: عنوان، شريحة مستهدفة، قناة (خطاب/اتصال/واتساب/SMS)، نص رسالة جاهز، أولوية.
- زر "تنزيل كمهام" يحوّل الاقتراحات إلى صفوف في جدول `tasks` مع `metadata.source='report_suggestion'` ويعيّنها (round-robin) على موظفي الجمعية.

### تفاصيل تقنية
- **ملفات جديدة:**
  - `src/components/admin/reports/ReportsHub.tsx` — شبكة البطاقات + Router داخلي.
  - `src/components/admin/reports/DonorTiersReport.tsx`
  - `src/components/admin/reports/CampaignsReport.tsx`
  - `src/components/admin/reports/FailedDonationsReport.tsx`
  - `src/components/admin/reports/AbandonedCartsReport.tsx`
  - `src/components/admin/reports/SubscriptionsReport.tsx`
  - `src/components/admin/reports/RecurringDonorsReport.tsx`
  - `src/components/admin/reports/GiftsReport.tsx`
  - `src/components/admin/reports/ProjectDonorsReport.tsx`
  - `src/components/admin/reports/ReportShell.tsx` — هيكل موحّد (Header + Filters + KPIs + Table + AI panel + Export).
  - `supabase/functions/report-suggestions/index.ts` — يستخدم `google/gemini-2.5-pro` عبر Lovable AI Gateway.
- **ملفات تُعدَّل:**
  - `src/pages/admin/OrgInternalDashboard.tsx` — إعادة الترتيب + إضافة تبويب "التقارير".
  - `src/components/layout/Sidebar.tsx` — إعادة ترتيب + رابط `?tab=reports`.
  - `src/components/admin/DonorsHub.tsx` — لا تعديل جوهري (مجرد إعادة ترتيب الترتيب الخارجي).
- **بدون تغييرات على قاعدة البيانات** — كل التقارير تقرأ من الجداول الحالية (`donations`, `donors`, `campaigns`, `failed_donations`, `abandoned_carts`, `subscriptions`, `gifts`, `tasks`).
- التصدير CSV عبر دالة مساعدة بسيطة (Blob + a.click).

### نطاق هذه الجولة
سأنفذ كل ما سبق دفعة واحدة. لاحقًا تستطيع تعديل الفلاتر والشرائح وقوائم الأعمدة كما تريد.
