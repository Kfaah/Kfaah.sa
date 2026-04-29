
-- 1) Activity related employees (extra employees beyond the responsible one)
CREATE TABLE public.activity_related_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executive_plan_id UUID NOT NULL REFERENCES public.executive_plans(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role_in_activity TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ai')),
  notes TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (executive_plan_id, employee_id)
);

CREATE INDEX idx_are_plan ON public.activity_related_employees(executive_plan_id);
CREATE INDEX idx_are_emp ON public.activity_related_employees(employee_id);
CREATE INDEX idx_are_org ON public.activity_related_employees(organization_id);

ALTER TABLE public.activity_related_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view related employees"
  ON public.activity_related_employees FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins manage related employees"
  ON public.activity_related_employees FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

CREATE TRIGGER trg_are_set_org
  BEFORE INSERT ON public.activity_related_employees
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();

CREATE TRIGGER trg_are_updated
  BEFORE UPDATE ON public.activity_related_employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2) Activity related tasks template (before/during/after per employee)
CREATE TABLE public.activity_related_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executive_plan_id UUID NOT NULL REFERENCES public.executive_plans(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('before','during','after')),
  title TEXT NOT NULL,
  description TEXT,
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  day_offset INTEGER NOT NULL DEFAULT 0, -- negative = days before, 0 = same day, positive = days after
  display_order INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ai')),
  is_dispatched BOOLEAN NOT NULL DEFAULT false,
  dispatched_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_art_plan ON public.activity_related_tasks(executive_plan_id);
CREATE INDEX idx_art_emp ON public.activity_related_tasks(employee_id);
CREATE INDEX idx_art_phase ON public.activity_related_tasks(executive_plan_id, phase);
CREATE INDEX idx_art_org ON public.activity_related_tasks(organization_id);

ALTER TABLE public.activity_related_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view related tasks"
  ON public.activity_related_tasks FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins manage related tasks"
  ON public.activity_related_tasks FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

CREATE TRIGGER trg_art_set_org
  BEFORE INSERT ON public.activity_related_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();

CREATE TRIGGER trg_art_updated
  BEFORE UPDATE ON public.activity_related_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3) Add tracking columns on tasks for dispatched related tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS source_activity_id UUID REFERENCES public.executive_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phase TEXT CHECK (phase IS NULL OR phase IN ('before','during','after'));

CREATE INDEX IF NOT EXISTS idx_tasks_source_activity ON public.tasks(source_activity_id);
