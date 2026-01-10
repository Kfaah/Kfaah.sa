-- إضافة أعمدة التقييم للمهام
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS completion_percentage integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS quality_percentage integer DEFAULT 0;

-- إضافة قيود للتأكد من أن النسب بين 0 و 100
ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_completion_percentage_check CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
ADD CONSTRAINT tasks_quality_percentage_check CHECK (quality_percentage >= 0 AND quality_percentage <= 100);