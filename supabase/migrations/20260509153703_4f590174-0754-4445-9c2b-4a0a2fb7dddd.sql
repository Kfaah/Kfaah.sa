CREATE TABLE IF NOT EXISTS public.platform_email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid,
  recipient_email text NOT NULL,
  recipient_name text,
  subject text NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  unread_for_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.platform_email_threads(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  sender_email text NOT NULL,
  recipient_email text,
  subject text,
  body text NOT NULL CHECK (char_length(body) <= 10000),
  provider_message_id text UNIQUE,
  in_reply_to text,
  raw_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_email_threads_last ON public.platform_email_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_email_threads_unread ON public.platform_email_threads(unread_for_owner, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_email_messages_thread ON public.platform_email_messages(thread_id, received_at);
CREATE INDEX IF NOT EXISTS idx_platform_email_messages_reply ON public.platform_email_messages(in_reply_to) WHERE in_reply_to IS NOT NULL;

ALTER TABLE public.platform_email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_email_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admin manages platform email threads" ON public.platform_email_threads;
CREATE POLICY "super admin manages platform email threads"
  ON public.platform_email_threads
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "super admin manages platform email messages" ON public.platform_email_messages;
CREATE POLICY "super admin manages platform email messages"
  ON public.platform_email_messages
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.bump_platform_email_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.platform_email_threads
  SET last_message_at = COALESCE(NEW.received_at, NEW.created_at),
      updated_at = now(),
      unread_for_owner = CASE WHEN NEW.direction = 'inbound' THEN true ELSE unread_for_owner END
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_platform_email_thread ON public.platform_email_messages;
CREATE TRIGGER trg_bump_platform_email_thread
AFTER INSERT ON public.platform_email_messages
FOR EACH ROW EXECUTE FUNCTION public.bump_platform_email_thread();

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_email_threads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_email_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;