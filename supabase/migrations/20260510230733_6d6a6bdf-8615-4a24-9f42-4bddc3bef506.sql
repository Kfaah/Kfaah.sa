
-- 1) RLS policies for platform_email_sync_settings (super_admin only)
CREATE POLICY "super_admin_select_email_sync"
  ON public.platform_email_sync_settings FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "super_admin_insert_email_sync"
  ON public.platform_email_sync_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "super_admin_update_email_sync"
  ON public.platform_email_sync_settings FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "super_admin_delete_email_sync"
  ON public.platform_email_sync_settings FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 2) Tighten support_messages insert policy with content validation
DROP POLICY IF EXISTS anyone_can_send_support_message ON public.support_messages;

CREATE POLICY "anyone_can_send_support_message"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    message IS NOT NULL
    AND char_length(btrim(message)) BETWEEN 1 AND 5000
  );

-- 3) Add explicit search_path to the 4 SECURITY DEFINER functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
