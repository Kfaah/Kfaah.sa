ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS idx_tasks_org_dedupe_status
  ON public.tasks (organization_id, dedupe_key, status)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_org_user_status_due
  ON public.tasks (organization_id, user_id, status, due_date);