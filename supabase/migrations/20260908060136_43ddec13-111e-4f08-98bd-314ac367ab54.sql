-- active_task: scope admin SELECT to admin's own organization
DROP POLICY IF EXISTS "Admins can view all active tasks" ON public.active_task;
CREATE POLICY "Org admins can view org active tasks"
ON public.active_task FOR SELECT TO authenticated
USING (organization_id IS NOT NULL AND public.admin_can_access_org(organization_id));

-- employee_files: scope admin SELECT to admin's own organization
DROP POLICY IF EXISTS "Admins can view all files" ON public.employee_files;
CREATE POLICY "Org admins can view org employee files"
ON public.employee_files FOR SELECT TO authenticated
USING (organization_id IS NOT NULL AND public.admin_can_access_org(organization_id));

-- task_messages: scope admin SELECT/INSERT to admin's own organization
DROP POLICY IF EXISTS "Admins can view all messages" ON public.task_messages;
CREATE POLICY "Org admins can view org task messages"
ON public.task_messages FOR SELECT TO authenticated
USING (organization_id IS NOT NULL AND public.admin_can_access_org(organization_id));

DROP POLICY IF EXISTS "Admins can insert messages" ON public.task_messages;
CREATE POLICY "Org admins can insert org task messages"
ON public.task_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND organization_id IS NOT NULL
  AND public.admin_can_access_org(organization_id)
);

-- task_generation_jobs: validate organization membership on insert
DROP POLICY IF EXISTS "Users can create their own task generation jobs" ON public.task_generation_jobs;
CREATE POLICY "Users can create their own task generation jobs"
ON public.task_generation_jobs FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND organization_id IS NOT NULL
  AND public.user_belongs_to_org(auth.uid(), organization_id)
);

-- welcome_backgrounds / welcome_quotes: global content managed by super_admin only
DROP POLICY IF EXISTS "Admins can manage backgrounds" ON public.welcome_backgrounds;
CREATE POLICY "Super admins can manage backgrounds"
ON public.welcome_backgrounds FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage quotes" ON public.welcome_quotes;
CREATE POLICY "Super admins can manage quotes"
ON public.welcome_quotes FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));