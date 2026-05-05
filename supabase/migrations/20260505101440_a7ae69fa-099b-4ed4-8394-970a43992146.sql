
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_spam boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_trashed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS labels text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_support_messages_flags
  ON public.support_messages (is_trashed, is_spam, is_archived, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS public.support_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id uuid NOT NULL,
  to_email text,
  to_name text,
  subject text,
  body text,
  reply_to_message_id uuid REFERENCES public.support_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage own drafts" ON public.support_drafts;
CREATE POLICY "Owners manage own drafts"
  ON public.support_drafts
  FOR ALL
  USING (auth.uid() = author_user_id AND public.is_super_admin(auth.uid()))
  WITH CHECK (auth.uid() = author_user_id AND public.is_super_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_support_drafts_updated ON public.support_drafts;
CREATE TRIGGER trg_support_drafts_updated
  BEFORE UPDATE ON public.support_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
