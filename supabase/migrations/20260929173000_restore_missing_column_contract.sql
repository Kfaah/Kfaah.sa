-- Port the remaining application-column contract that existed in Drizzle
-- and runtime code but was absent from the Supabase recovery history.

ALTER TABLE public.deep_analyses
  ADD COLUMN IF NOT EXISTS analysis_evidence jsonb,
  ADD COLUMN IF NOT EXISTS document_insights jsonb,
  ADD COLUMN IF NOT EXISTS gap_evidence jsonb,
  ADD COLUMN IF NOT EXISTS source_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS source_previews jsonb;

COMMENT ON COLUMN public.deep_analyses.analysis_evidence IS
  'Evidence-backed findings produced by organization analysis.';
COMMENT ON COLUMN public.deep_analyses.document_insights IS
  'Structured insights extracted from uploaded organization documents.';
COMMENT ON COLUMN public.deep_analyses.gap_evidence IS
  'Evidence supporting identified organizational gaps.';
COMMENT ON COLUMN public.deep_analyses.source_breakdown IS
  'Per-source analysis breakdown used by the deep-analysis UI.';
COMMENT ON COLUMN public.deep_analyses.source_previews IS
  'Structured previews and metadata for analyzed sources.';

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_employee_id uuid
  REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_employee_id
  ON public.tasks(assigned_employee_id);
