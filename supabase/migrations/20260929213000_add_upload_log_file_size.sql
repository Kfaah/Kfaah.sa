ALTER TABLE public.data_uploads_log
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint;

COMMENT ON COLUMN public.data_uploads_log.file_size_bytes IS
  'Original uploaded file size in bytes; used for AI-analysis safety limits.';
