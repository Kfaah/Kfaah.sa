-- إضافة أعمدة الهدف الاستراتيجي والمبادرات للخطط التشغيلية
ALTER TABLE public.operational_plans 
ADD COLUMN strategic_goal TEXT,
ADD COLUMN initiative TEXT;