
-- Allow authenticated users to see and continue their own conversations with admin
CREATE POLICY "user_read_own_messages" ON public.support_messages
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_insert_own_message" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_read_own_replies" ON public.support_replies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_messages m
      WHERE m.id = support_replies.message_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "user_insert_own_reply" ON public.support_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    from_owner = false
    AND author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_messages m
      WHERE m.id = support_replies.message_id
        AND m.user_id = auth.uid()
    )
  );

-- Allow admin to mark replies as read by user (for unread badges later)
ALTER TABLE public.support_replies ADD COLUMN IF NOT EXISTS read_by_user boolean NOT NULL DEFAULT false;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS last_user_activity_at timestamptz NOT NULL DEFAULT now();

CREATE POLICY "user_update_own_message_read" ON public.support_messages
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_support_messages_user ON public.support_messages(user_id, created_at DESC);
