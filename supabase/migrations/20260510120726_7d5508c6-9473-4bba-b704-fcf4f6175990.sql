ALTER TABLE public.platform_email_threads
ADD COLUMN IF NOT EXISTS is_trashed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS trashed_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_platform_email_threads_is_trashed
ON public.platform_email_threads (is_trashed, last_message_at DESC);