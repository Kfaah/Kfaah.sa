
-- 1) Helper: can the current user manage roles of a target user?
CREATE OR REPLACE FUNCTION public.can_manage_user_role(_target_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND _target_user IS NOT NULL
      AND _target_user <> auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.user_organizations me
        JOIN public.user_organizations target
          ON target.organization_id = me.organization_id
        WHERE me.user_id = auth.uid()
          AND me.approval_status = 'approved'
          AND target.user_id = _target_user
          AND target.approval_status = 'approved'
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_user_role(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.can_manage_user_role(user_id)
    AND role <> ALL (ARRAY['admin'::app_role, 'super_admin'::app_role])
  )
);

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.can_manage_user_role(user_id)
    AND role <> ALL (ARRAY['admin'::app_role, 'super_admin'::app_role])
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.can_manage_user_role(user_id)
    AND role <> ALL (ARRAY['admin'::app_role, 'super_admin'::app_role])
  )
);

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.can_manage_user_role(user_id)
    AND role <> ALL (ARRAY['admin'::app_role, 'super_admin'::app_role])
  )
);

-- 2) action-plan-files: org-scoped upload folder
DROP POLICY IF EXISTS "action_plan_files_auth_upload" ON storage.objects;
CREATE POLICY "action_plan_files_auth_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'action-plan-files'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

-- 3) task-attachments: uploader must own the folder AND be an approved org member
DROP POLICY IF EXISTS "Authenticated users can upload task attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload task attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.user_id = auth.uid()
        AND uo.approval_status = 'approved'
    )
  )
);
