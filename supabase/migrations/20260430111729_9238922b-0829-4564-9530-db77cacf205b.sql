CREATE TABLE IF NOT EXISTS public.task_generation_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID,
  requested_month INTEGER NOT NULL,
  requested_year INTEGER NOT NULL,
  employee_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  total_employees INTEGER NOT NULL DEFAULT 0,
  processed_employees INTEGER NOT NULL DEFAULT 0,
  generated_tasks_count INTEGER NOT NULL DEFAULT 0,
  days_covered INTEGER NOT NULL DEFAULT 0,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_generation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own task generation jobs" ON public.task_generation_jobs;
CREATE POLICY "Users can view their own task generation jobs"
ON public.task_generation_jobs
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'super_admin'::app_role])
  OR public.is_manager(auth.uid())
);

DROP POLICY IF EXISTS "Users can create their own task generation jobs" ON public.task_generation_jobs;
CREATE POLICY "Users can create their own task generation jobs"
ON public.task_generation_jobs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own task generation jobs" ON public.task_generation_jobs;
CREATE POLICY "Users can update their own task generation jobs"
ON public.task_generation_jobs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_task_generation_jobs_user_created ON public.task_generation_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_generation_jobs_org_period ON public.task_generation_jobs(organization_id, requested_year, requested_month, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_generation_jobs_status ON public.task_generation_jobs(status, created_at);

DROP TRIGGER IF EXISTS update_task_generation_jobs_updated_at ON public.task_generation_jobs;
CREATE TRIGGER update_task_generation_jobs_updated_at
BEFORE UPDATE ON public.task_generation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();