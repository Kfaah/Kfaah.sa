
CREATE TABLE public.evaluation_criteria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  weight NUMERIC NOT NULL DEFAULT 1 CHECK (weight > 0),
  is_automatic BOOLEAN NOT NULL DEFAULT false,
  metric_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.evaluation_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view criteria"
  ON public.evaluation_criteria FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Admins can insert criteria"
  ON public.evaluation_criteria FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()));

CREATE POLICY "Admins can update criteria"
  ON public.evaluation_criteria FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()));

CREATE POLICY "Admins can delete criteria"
  ON public.evaluation_criteria FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_evaluation_criteria_updated
  BEFORE UPDATE ON public.evaluation_criteria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.employee_evaluation_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_user_id UUID NOT NULL,
  criterion_id UUID NOT NULL REFERENCES public.evaluation_criteria(id) ON DELETE CASCADE,
  organization_id UUID,
  score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 100),
  period TEXT NOT NULL DEFAULT 'month',
  period_start DATE,
  period_end DATE,
  notes TEXT,
  evaluated_by UUID,
  is_automatic BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eval_scores_user ON public.employee_evaluation_scores(employee_user_id);
CREATE INDEX idx_eval_scores_criterion ON public.employee_evaluation_scores(criterion_id);

ALTER TABLE public.employee_evaluation_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view scores"
  ON public.employee_evaluation_scores FOR SELECT TO authenticated
  USING (
    employee_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_super_admin(auth.uid())
    OR public.is_manager(auth.uid())
  );

CREATE POLICY "Admins can insert scores"
  ON public.employee_evaluation_scores FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()));

CREATE POLICY "Admins can update scores"
  ON public.employee_evaluation_scores FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()) OR public.is_manager(auth.uid()));

CREATE POLICY "Admins can delete scores"
  ON public.employee_evaluation_scores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_eval_scores_updated
  BEFORE UPDATE ON public.employee_evaluation_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.evaluation_criteria (name, description, weight, is_automatic, metric_key, display_order)
VALUES
  ('إنجاز المهام', 'نسبة المهام المنجزة من المهام المسندة', 30, true, 'task_completion', 1),
  ('جودة الإنجاز', 'تقييم AI لجودة كل مهمة منجزة', 30, true, 'task_quality', 2),
  ('كفاءة استثمار الوقت', 'مقارنة الوقت المقدر بالوقت الفعلي للإنجاز', 20, true, 'time_efficiency', 3),
  ('استخدام الذكاء الاصطناعي في العمل', 'مدى توظيف الموظف للذكاء الاصطناعي وأتمتة الأعمال والإبداع فيها', 20, true, 'ai_usage', 4);
