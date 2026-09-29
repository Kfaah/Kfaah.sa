-- Align upload-log RLS with the explicit organization used by the upload UI.

DROP POLICY IF EXISTS "Org admin manage uploads" ON public.data_uploads_log;
DROP POLICY IF EXISTS "Org members view uploads" ON public.data_uploads_log;
DROP POLICY IF EXISTS "Authenticated users can create uploads" ON public.data_uploads_log;

CREATE POLICY "Org admin manage uploads"
ON public.data_uploads_log
FOR ALL
TO authenticated
USING (
  public.admin_can_access_org(organization_id)
)
WITH CHECK (
  public.admin_can_access_org(organization_id)
);

CREATE POLICY "Org members view uploads"
ON public.data_uploads_log
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id = data_uploads_log.organization_id
      AND uo.approval_status = 'approved'
  )
);

CREATE POLICY "Authenticated org admins can create uploads"
ON public.data_uploads_log
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by
  AND public.admin_can_access_org(organization_id)
);
