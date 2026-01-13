-- جدول ربط الأهداف الاستراتيجية بالأقسام (متعدد المالكين)
CREATE TABLE public.strategic_goal_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  strategic_goal_id UUID NOT NULL REFERENCES public.strategic_goals(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(strategic_goal_id, department_id)
);

-- جدول ربط المبادرات بالأقسام (متعدد المالكين)
CREATE TABLE public.initiative_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  initiative_id UUID NOT NULL REFERENCES public.initiatives(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(initiative_id, department_id)
);

-- تفعيل RLS
ALTER TABLE public.strategic_goal_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.initiative_departments ENABLE ROW LEVEL SECURITY;

-- سياسات الأهداف الاستراتيجية
CREATE POLICY "Anyone can view strategic goal departments"
  ON public.strategic_goal_departments FOR SELECT USING (true);

CREATE POLICY "Admins can insert strategic goal departments"
  ON public.strategic_goal_departments FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update strategic goal departments"
  ON public.strategic_goal_departments FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete strategic goal departments"
  ON public.strategic_goal_departments FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- سياسات المبادرات
CREATE POLICY "Anyone can view initiative departments"
  ON public.initiative_departments FOR SELECT USING (true);

CREATE POLICY "Admins can insert initiative departments"
  ON public.initiative_departments FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update initiative departments"
  ON public.initiative_departments FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete initiative departments"
  ON public.initiative_departments FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- نقل البيانات الحالية (إذا وجدت)
INSERT INTO public.strategic_goal_departments (strategic_goal_id, department_id)
SELECT id, department_id FROM public.strategic_goals WHERE department_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.initiative_departments (initiative_id, department_id)
SELECT id, department_id FROM public.initiatives WHERE department_id IS NOT NULL
ON CONFLICT DO NOTHING;