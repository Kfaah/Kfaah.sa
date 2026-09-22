ALTER TABLE public.deep_analyses
  ADD COLUMN IF NOT EXISTS analysis_evidence jsonb;

COMMENT ON COLUMN public.deep_analyses.analysis_evidence IS 'Detailed evidence-backed findings from organization analysis, including source previews.';