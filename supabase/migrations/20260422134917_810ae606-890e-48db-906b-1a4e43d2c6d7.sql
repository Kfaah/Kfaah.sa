
-- Cache the latest AI insight per organization (for stable, reproducible analysis + plan generation)
CREATE TABLE public.admin_ai_insights_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  period_from TIMESTAMPTZ,
  period_to TIMESTAMPTZ,
  insight JSONB NOT NULL,
  metrics_snapshot JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_ai_insights_org_generated ON public.admin_ai_insights_cache (organization_id, generated_at DESC);

ALTER TABLE public.admin_ai_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access_insights_cache" ON public.admin_ai_insights_cache
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Action plans generated from AI recommendations
CREATE TABLE public.action_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'ai_insight',
  source_insight_id UUID REFERENCES public.admin_ai_insights_cache(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  progress NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_plans_org ON public.action_plans (organization_id, created_at DESC);

ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_action_plans_all" ON public.action_plans
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.user_belongs_to_org(auth.uid(), organization_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.user_belongs_to_org(auth.uid(), organization_id));

-- Each task inside an action plan
CREATE TABLE public.action_plan_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_plan_id UUID NOT NULL REFERENCES public.action_plans(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  impact TEXT NOT NULL DEFAULT 'medium',
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  start_date DATE,
  due_date DATE,
  assigned_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ai_suggested_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ai_suggestion_reason TEXT,
  completion_notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_plan_tasks_plan ON public.action_plan_tasks (action_plan_id, priority);
CREATE INDEX idx_action_plan_tasks_employee ON public.action_plan_tasks (assigned_employee_id);

ALTER TABLE public.action_plan_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "action_plan_tasks_access" ON public.action_plan_tasks
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.user_belongs_to_org(auth.uid(), organization_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.user_belongs_to_org(auth.uid(), organization_id));

-- Auto update updated_at
CREATE TRIGGER update_action_plans_updated_at BEFORE UPDATE ON public.action_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_action_plan_tasks_updated_at BEFORE UPDATE ON public.action_plan_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
