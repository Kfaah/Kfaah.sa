-- إنشاء جدول الأهداف الاستراتيجية
CREATE TABLE public.strategic_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  year INTEGER NOT NULL DEFAULT EXTRACT(year FROM CURRENT_DATE),
  color TEXT DEFAULT 'bg-blue-500',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- إنشاء جدول المبادرات
CREATE TABLE public.initiatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  strategic_goal_id UUID NOT NULL REFERENCES public.strategic_goals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.strategic_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.initiatives ENABLE ROW LEVEL SECURITY;

-- سياسات الأهداف الاستراتيجية
CREATE POLICY "Anyone can view strategic goals"
ON public.strategic_goals FOR SELECT
USING (true);

CREATE POLICY "Admins can insert strategic goals"
ON public.strategic_goals FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update strategic goals"
ON public.strategic_goals FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete strategic goals"
ON public.strategic_goals FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- سياسات المبادرات
CREATE POLICY "Anyone can view initiatives"
ON public.initiatives FOR SELECT
USING (true);

CREATE POLICY "Admins can insert initiatives"
ON public.initiatives FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update initiatives"
ON public.initiatives FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete initiatives"
ON public.initiatives FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- إضافة أعمدة الربط في جدول الخطط التشغيلية
ALTER TABLE public.operational_plans 
ADD COLUMN strategic_goal_id UUID REFERENCES public.strategic_goals(id) ON DELETE SET NULL,
ADD COLUMN initiative_id UUID REFERENCES public.initiatives(id) ON DELETE SET NULL;