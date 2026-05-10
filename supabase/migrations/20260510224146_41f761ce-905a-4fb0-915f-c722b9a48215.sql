ALTER TABLE public.task_quality_evaluations
  ADD COLUMN IF NOT EXISTS time_efficiency_score numeric CHECK (time_efficiency_score >= 0 AND time_efficiency_score <= 100),
  ADD COLUMN IF NOT EXISTS expected_minutes numeric,
  ADD COLUMN IF NOT EXISTS actual_minutes numeric,
  ADD COLUMN IF NOT EXISTS time_ratio numeric,
  ADD COLUMN IF NOT EXISTS efficiency_notes text;