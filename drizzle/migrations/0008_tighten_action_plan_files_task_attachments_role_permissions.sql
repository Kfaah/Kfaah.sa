CREATE OR REPLACE FUNCTION public.can_read_action_plan_file(_folder text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
     AND _folder IS NOT NULL
     AND (
       public.is_super_admin(auth.uid())
       OR (
         _folder ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
         AND public.user_belongs_to_org(auth.uid(), _folder::uuid)
       )
       OR (
         _folder !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
         AND EXISTS (
           SELECT 1 FROM public.user_organizations uo
           WHERE uo.user_id = auth.uid() AND uo.approval_status = 'approved'
         )
       )
     );
$$;

DROP POLICY IF EXISTS "Public read action plan files" ON storage.objects;
DROP POLICY IF EXISTS "Action plan files read for org members" ON storage.objects;
CREATE POLICY "Action plan files read for org members"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'action-plan-files'
  AND public.can_read_action_plan_file((storage.foldername(name))[1])
);

CREATE OR REPLACE FUNCTION public.can_read_task_attachment(_owner text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
     AND _owner IS NOT NULL
     AND (
       _owner = auth.uid()::text
       OR public.is_super_admin(auth.uid())
       OR EXISTS (
         SELECT 1 FROM public.user_organizations uo
         WHERE uo.user_id::text = _owner
           AND uo.approval_status = 'approved'
           AND public.admin_can_access_org(uo.organization_id)
       )
     );
$$;

DROP POLICY IF EXISTS "Task attachments select owner or verified org admin" ON storage.objects;
CREATE POLICY "Task attachments select owner or verified org admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND public.can_read_task_attachment((storage.foldername(name))[1])
);

DROP POLICY IF EXISTS role_perm_read_for_org_or_global ON public.role_permissions;
CREATE POLICY role_perm_read_for_org_or_global
ON public.role_permissions FOR SELECT TO authenticated
USING (
  (organization_id IS NOT NULL AND public.user_belongs_to_org(auth.uid(), organization_id))
  OR (
    organization_id IS NULL
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_organizations uo
        WHERE uo.user_id = auth.uid() AND uo.approval_status = 'approved'
      )
    )
  )
);

REVOKE ALL ON public.role_permissions FROM anon;