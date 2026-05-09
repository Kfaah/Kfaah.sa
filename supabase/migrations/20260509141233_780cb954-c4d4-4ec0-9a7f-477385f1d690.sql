-- Drop org-admin access; keep only member + super_admin
DROP POLICY IF EXISTS "org admins can view threads in their org" ON public.internal_threads;
DROP POLICY IF EXISTS "member or admin can update thread" ON public.internal_threads;
DROP POLICY IF EXISTS "view messages in accessible threads" ON public.internal_messages;
DROP POLICY IF EXISTS "admin sends in org thread" ON public.internal_messages;

CREATE POLICY "super admin views all threads"
  ON public.internal_threads FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "member or super admin updates thread"
  ON public.internal_threads FOR UPDATE
  USING (member_user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "view messages: member or super admin"
  ON public.internal_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.internal_threads t
      WHERE t.id = thread_id
        AND (t.member_user_id = auth.uid() OR public.is_super_admin(auth.uid()))
    )
  );

CREATE POLICY "super admin replies in any thread"
  ON public.internal_messages FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    AND from_admin = true
    AND public.is_super_admin(auth.uid())
  );

-- Allow any authenticated user (not just approved-in-org) to start a thread
DROP POLICY IF EXISTS "member can create own thread" ON public.internal_threads;
CREATE POLICY "any authenticated user can create own thread"
  ON public.internal_threads FOR INSERT
  WITH CHECK (member_user_id = auth.uid());