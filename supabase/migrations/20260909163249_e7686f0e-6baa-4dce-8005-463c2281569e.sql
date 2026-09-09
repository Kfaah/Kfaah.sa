-- 1) employee_files: explicit org scoping alongside the helper function
DROP POLICY IF EXISTS "Org admins can insert org employee files" ON public.employee_files;
CREATE POLICY "Org admins can insert org employee files"
ON public.employee_files FOR INSERT TO authenticated
WITH CHECK (
  public.can_manage_employee_file(user_id)
  AND organization_id IS NOT NULL
  AND public.admin_can_access_org(organization_id)
);

DROP POLICY IF EXISTS "Org admins can delete org employee files" ON public.employee_files;
CREATE POLICY "Org admins can delete org employee files"
ON public.employee_files FOR DELETE TO authenticated
USING (
  public.can_manage_employee_file(user_id)
  AND organization_id IS NOT NULL
  AND public.admin_can_access_org(organization_id)
);

-- 2) intelligence_profile_questions: only platform super admins may write global (null-org) rows
DROP POLICY IF EXISTS "Managers insert questions" ON public.intelligence_profile_questions;
CREATE POLICY "Managers insert questions"
ON public.intelligence_profile_questions FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (organization_id IS NOT NULL AND public.can_manage_intelligence_profile(auth.uid(), organization_id))
);

DROP POLICY IF EXISTS "Managers update questions" ON public.intelligence_profile_questions;
CREATE POLICY "Managers update questions"
ON public.intelligence_profile_questions FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (organization_id IS NOT NULL AND public.can_manage_intelligence_profile(auth.uid(), organization_id))
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (organization_id IS NOT NULL AND public.can_manage_intelligence_profile(auth.uid(), organization_id))
);

DROP POLICY IF EXISTS "Managers delete questions" ON public.intelligence_profile_questions;
CREATE POLICY "Managers delete questions"
ON public.intelligence_profile_questions FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (organization_id IS NOT NULL AND public.can_manage_intelligence_profile(auth.uid(), organization_id))
);

-- 3) task_messages: organization linkage is mandatory (trigger already populates it)
ALTER TABLE public.task_messages ALTER COLUMN organization_id SET NOT NULL;
