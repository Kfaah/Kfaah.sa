-- Internal messaging system: member ↔ org admins (account-to-account, no email)
CREATE TABLE public.internal_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL,
  subject text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  unread_for_admin boolean NOT NULL DEFAULT true,
  unread_for_member boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_internal_threads_org ON public.internal_threads(organization_id, last_message_at DESC);
CREATE INDEX idx_internal_threads_member ON public.internal_threads(member_user_id, last_message_at DESC);

CREATE TABLE public.internal_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.internal_threads(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  from_admin boolean NOT NULL DEFAULT false,
  body text NOT NULL CHECK (char_length(body) <= 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_internal_messages_thread ON public.internal_messages(thread_id, created_at);

ALTER TABLE public.internal_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin of the given org?
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id) OR (
    public.is_user_approved_in_org(_user_id, _org_id)
    AND public.has_any_role(_user_id, ARRAY['admin','hr_manager','moderator']::app_role[])
  );
$$;

-- THREADS policies
CREATE POLICY "member can view own threads"
  ON public.internal_threads FOR SELECT
  USING (member_user_id = auth.uid());

CREATE POLICY "org admins can view threads in their org"
  ON public.internal_threads FOR SELECT
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "member can create own thread"
  ON public.internal_threads FOR INSERT
  WITH CHECK (
    member_user_id = auth.uid()
    AND public.is_user_approved_in_org(auth.uid(), organization_id)
  );

CREATE POLICY "member or admin can update thread"
  ON public.internal_threads FOR UPDATE
  USING (
    member_user_id = auth.uid()
    OR public.is_org_admin(auth.uid(), organization_id)
  );

-- MESSAGES policies
CREATE POLICY "view messages in accessible threads"
  ON public.internal_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.internal_threads t
      WHERE t.id = thread_id
        AND (
          t.member_user_id = auth.uid()
          OR public.is_org_admin(auth.uid(), t.organization_id)
        )
    )
  );

CREATE POLICY "member sends in own thread"
  ON public.internal_messages FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    AND from_admin = false
    AND EXISTS (
      SELECT 1 FROM public.internal_threads t
      WHERE t.id = thread_id AND t.member_user_id = auth.uid()
    )
  );

CREATE POLICY "admin sends in org thread"
  ON public.internal_messages FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    AND from_admin = true
    AND EXISTS (
      SELECT 1 FROM public.internal_threads t
      WHERE t.id = thread_id AND public.is_org_admin(auth.uid(), t.organization_id)
    )
  );

-- Trigger: bump thread last_message_at and unread flags on new message
CREATE OR REPLACE FUNCTION public.bump_internal_thread_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.internal_threads
  SET last_message_at = NEW.created_at,
      updated_at = now(),
      unread_for_admin = CASE WHEN NEW.from_admin THEN unread_for_admin ELSE true END,
      unread_for_member = CASE WHEN NEW.from_admin THEN true ELSE unread_for_member END
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bump_internal_thread
AFTER INSERT ON public.internal_messages
FOR EACH ROW EXECUTE FUNCTION public.bump_internal_thread_on_message();

-- updated_at trigger for threads
CREATE TRIGGER trg_internal_threads_updated_at
BEFORE UPDATE ON public.internal_threads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;