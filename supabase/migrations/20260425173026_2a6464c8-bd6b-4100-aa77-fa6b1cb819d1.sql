-- Job duties table — central place for each employee's job tasks/duties
CREATE TABLE public.employee_job_duties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  employee_id UUID,
  organization_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  frequency TEXT, -- daily | weekly | monthly | adhoc
  priority TEXT NOT NULL DEFAULT 'medium', -- low | medium | high
  estimated_time_minutes INTEGER,
  source TEXT NOT NULL DEFAULT 'self_declared', -- self_declared | job_description | manager_assigned | ai_inferred
  tags JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_job_duties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own job duties"
ON public.employee_job_duties FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own job duties"
ON public.employee_job_duties FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own job duties"
ON public.employee_job_duties FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users view own job duties"
ON public.employee_job_duties FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins view org job duties"
ON public.employee_job_duties FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins manage org job duties"
ON public.employee_job_duties FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Super admin all job duties"
ON public.employee_job_duties FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER update_employee_job_duties_updated_at
BEFORE UPDATE ON public.employee_job_duties
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_employee_job_duties_user ON public.employee_job_duties(user_id);
CREATE INDEX idx_employee_job_duties_org ON public.employee_job_duties(organization_id);