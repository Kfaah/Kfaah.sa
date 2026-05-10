## الهدف
ترقية موزّع المهام ليصبح **ذكاء تكيُّفي** يتعلم من الزمن الفعلي للموظف، ويتولّد منه:
1. **تعبئة تلقائية للوقت المتبقي** عند إنجاز مبكّر.
2. **تقدير ذكي يتعلّم** للمدة المتوقّعة لكل نوع مهمة بناءً على سجل الإنجاز السابق.
3. **تقييم تلقائي للجودة** عند كل إكمال (يستخدم `evaluate-task-quality` الموجود).

## التغييرات

### 1) جدول تعلّم الزمن `task_time_baselines`
- (organization_id, key=source/category/channel) → avg_minutes, samples, last_updated.
- يُحدَّث عند إكمال أي مهمة (DB trigger يحدّث المتوسط المتحرك EWMA: `new = old*0.7 + actual*0.3`، مع سقف samples).
- موزّع المهام يستعلم منه أولًا قبل اللجوء إلى الافتراضي حسب القناة.

### 2) Edge function جديدة `top-up-employee-tasks`
تستدعى:
- يدويًا من زر في "موزّع المهام الذكي".
- مجدولة كل ساعة من `pg_cron` بين 8 ص و2 م.
- تلقائيًا داخل `notify-task-message` أو endpoint إكمال المهمة (سنضيف استدعاء بسيط بعد UPDATE status='completed').

المنطق لكل موظف نشط:
1. اجمع المهام لليوم: مفتوحة (estimated) + مكتملة (actual).
2. احسب الوقت المتبقي = `300 - usedMinutes` والعدد المتبقي = `7 - openTasksCount`.
3. اذا الوقت المتبقي ≥ 30 دقيقة والعدد < 7:
   - اسحب من بنك الاقتراحات `smart_tasks` المعلّقة (التي لم تتحوّل إلى tasks).
   - مرّرها عبر `smart-task-dispatcher` مع `start_date=today` فقط لهذا الموظف.
4. إن لم يتوفر بنك كافٍ، استدعِ `daily-donor-intelligence` بـ `trigger=top_up`.

سيتم تمديد `smart-task-dispatcher` بقبول `target_user_id` اختياري لتركيز التوزيع على موظف واحد.

### 3) ربط الإكمال بالتعلّم والتقييم (DB trigger)
- Trigger AFTER UPDATE على `tasks` عند تحوّل status إلى completed/executed:
  - يحدّث `task_time_baselines` (EWMA من actual_time_minutes إن وُجد).
  - عبر `pg_net` يستدعي `evaluate-task-quality` (موجودة) و`top-up-employee-tasks` للموظف نفسه.

### 4) موزّع المهام يستخدم baselines
- في `smart-task-dispatcher`: قبل استخدام `CHANNEL_MINUTES`، استعلم `task_time_baselines` بمفتاح `source` ثم `category` ثم `channel`، استخدم أول قيمة موجودة.

### 5) عرض في لوحة الإدارة
- في بطاقة "موزّع المهام الذكي":
  - زر إضافي "تعبئة الوقت المتبقي للموظفين" (يستدعي `top-up-employee-tasks`).
  - عمود إضافي صغير يعرض: متوسط الإنجاز الفعلي vs المقدّر للموظف (من baselines).

## ملفات
**جديد:**
- `supabase/functions/top-up-employee-tasks/index.ts`

**تعديل:**
- `supabase/functions/smart-task-dispatcher/index.ts` (دعم `target_user_id` + قراءة baselines)
- `src/components/admin/DonorsHub.tsx` (زر التعبئة)
- هجرة SQL: جدول `task_time_baselines` + trigger التحديث + trigger pg_net للتقييم والتعبئة.

## ما لن يتغيّر
- لا تعديل على واجهة الموظف ولا منطق العرض الحالي للمهام.
- لا تعديل على إنشاء مهام بقية المسارات.
