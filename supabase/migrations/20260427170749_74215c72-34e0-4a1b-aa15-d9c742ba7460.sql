ALTER TABLE public.operational_plans
  ADD COLUMN IF NOT EXISTS plan_name TEXT NOT NULL DEFAULT 'الخطة الأولى',
  ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_operational_plans_plan_name ON public.operational_plans (year, plan_name);