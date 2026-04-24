-- 1) accountability_questions: extra fields for employee answer flow
ALTER TABLE public.accountability_questions
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_check_score NUMERIC,
  ADD COLUMN IF NOT EXISTS last_check_verdict TEXT;

CREATE INDEX IF NOT EXISTS idx_acc_q_target_employee
  ON public.accountability_questions(target_employee_id, status);

CREATE INDEX IF NOT EXISTS idx_acc_q_org
  ON public.accountability_questions(organization_id, status);

-- 2) accountability_tasks: link task back to its source question + reason
ALTER TABLE public.accountability_tasks
  ADD COLUMN IF NOT EXISTS parent_question_id UUID,
  ADD COLUMN IF NOT EXISTS gap_reason TEXT,
  ADD COLUMN IF NOT EXISTS evidence_score_when_generated NUMERIC;

CREATE INDEX IF NOT EXISTS idx_acc_tasks_parent_q
  ON public.accountability_tasks(parent_question_id);

CREATE INDEX IF NOT EXISTS idx_acc_tasks_assignee
  ON public.accountability_tasks(assigned_employee_id, status);

-- 3) evidence_checks: more granular findings
ALTER TABLE public.evidence_checks
  ADD COLUMN IF NOT EXISTS sub_checks JSONB,
  ADD COLUMN IF NOT EXISTS missing_items JSONB,
  ADD COLUMN IF NOT EXISTS strict_mode BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_evidence_question
  ON public.evidence_checks(accountability_question_id, created_at DESC);
