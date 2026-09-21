ALTER TABLE public.deep_analyses
  ADD COLUMN IF NOT EXISTS document_insights jsonb;