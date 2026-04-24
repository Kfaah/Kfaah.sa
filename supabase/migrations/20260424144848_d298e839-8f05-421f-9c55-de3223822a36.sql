CREATE TABLE IF NOT EXISTS public.deep_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  trigger_source text NOT NULL DEFAULT 'manual',
  upload_id uuid,
  status text NOT NULL DEFAULT 'pending',
  sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  donations_summary jsonb,
  donors_segmentation jsonb,
  campaigns_analysis jsonb,
  website_insights jsonb,
  store_insights jsonb,
  social_insights jsonb,
  overall_assessment text,
  strengths jsonb,
  gaps jsonb,
  recommendations jsonb,
  questions_generated int NOT NULL DEFAULT 0,
  tasks_generated int NOT NULL DEFAULT 0,
  ai_model text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deep_analyses_org ON public.deep_analyses(organization_id, created_at DESC);
ALTER TABLE public.deep_analyses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.accountability_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  deep_analysis_id uuid,
  target_employee_id uuid,
  target_job_role text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  question_text text NOT NULL,
  context text,
  expected_evidence text,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  answer text,
  answer_yes_no text,
  evidence_url text,
  evidence_notes text,
  answered_at timestamptz,
  answered_by uuid,
  evidence_check_id uuid,
  evidence_verdict text,
  evidence_score numeric,
  evidence_findings jsonb,
  generated_task_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acc_q_org ON public.accountability_questions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_acc_q_employee ON public.accountability_questions(target_employee_id, status);
ALTER TABLE public.accountability_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.evidence_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  accountability_question_id uuid,
  evidence_url text NOT NULL,
  scrape_status text NOT NULL DEFAULT 'pending',
  scrape_content_excerpt text,
  scrape_metadata jsonb,
  verdict text,
  score numeric,
  findings jsonb,
  recommendations text,
  ai_model text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evidence_org ON public.evidence_checks(organization_id, created_at DESC);
ALTER TABLE public.evidence_checks ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.accountability_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'accountability',
  source_id uuid,
  assigned_employee_id uuid,
  target_job_role text,
  title text NOT NULL,
  description text,
  detailed_instructions text,
  category text,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  due_date date,
  completed_at timestamptz,
  completion_notes text,
  ai_generated boolean NOT NULL DEFAULT true,
  ai_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acc_tasks_org ON public.accountability_tasks(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_acc_tasks_employee ON public.accountability_tasks(assigned_employee_id, status);
ALTER TABLE public.accountability_tasks ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_deep_analyses_updated ON public.deep_analyses;
CREATE TRIGGER trg_deep_analyses_updated BEFORE UPDATE ON public.deep_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_acc_q_updated ON public.accountability_questions;
CREATE TRIGGER trg_acc_q_updated BEFORE UPDATE ON public.accountability_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_acc_tasks_updated ON public.accountability_tasks;
CREATE TRIGGER trg_acc_tasks_updated BEFORE UPDATE ON public.accountability_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "deep_analyses_select" ON public.deep_analyses
  FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "deep_analyses_admin_all" ON public.deep_analyses
  FOR ALL USING ((has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "acc_q_select" ON public.accountability_questions
  FOR SELECT USING (
    organization_id = get_user_organization_id(auth.uid())
    OR target_employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR is_super_admin(auth.uid())
  );
CREATE POLICY "acc_q_employee_update" ON public.accountability_questions
  FOR UPDATE USING (
    target_employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );
CREATE POLICY "acc_q_admin_all" ON public.accountability_questions
  FOR ALL USING ((has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "evidence_select" ON public.evidence_checks
  FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "evidence_admin_all" ON public.evidence_checks
  FOR ALL USING ((has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "acc_tasks_select" ON public.accountability_tasks
  FOR SELECT USING (
    organization_id = get_user_organization_id(auth.uid())
    OR assigned_employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR is_super_admin(auth.uid())
  );
CREATE POLICY "acc_tasks_employee_update" ON public.accountability_tasks
  FOR UPDATE USING (
    assigned_employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );
CREATE POLICY "acc_tasks_admin_all" ON public.accountability_tasks
  FOR ALL USING ((has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())) OR is_super_admin(auth.uid()));