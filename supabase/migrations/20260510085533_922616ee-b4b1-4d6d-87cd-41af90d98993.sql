
DROP POLICY IF EXISTS "super admin manages platform email threads" ON public.platform_email_threads;
DROP POLICY IF EXISTS "super admin manages platform email messages" ON public.platform_email_messages;

CREATE POLICY "admins manage platform email threads"
  ON public.platform_email_threads FOR ALL
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins manage platform email messages"
  ON public.platform_email_messages FOR ALL
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));
