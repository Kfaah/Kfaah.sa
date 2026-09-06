ALTER TABLE public.data_uploads_log
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS storage_bucket text;