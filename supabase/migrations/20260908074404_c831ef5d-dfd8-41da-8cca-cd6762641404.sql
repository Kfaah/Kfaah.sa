CREATE OR REPLACE FUNCTION public.can_manage_employee_file(_owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = _owner_user_id
      OR public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.user_id = _owner_user_id
          AND e.organization_id IS NOT NULL
          AND public.admin_can_access_org(e.organization_id)
      );
$$;

DROP POLICY IF EXISTS "Org admins manage employee files insert" ON storage.objects;
CREATE POLICY "Org admins manage employee files insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-files'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.can_manage_employee_file(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Org admins manage employee files select" ON storage.objects;
CREATE POLICY "Org admins manage employee files select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-files'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.can_manage_employee_file(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Org admins manage employee files update" ON storage.objects;
CREATE POLICY "Org admins manage employee files update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'employee-files'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.can_manage_employee_file(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'employee-files'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.can_manage_employee_file(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Org admins manage employee files delete" ON storage.objects;
CREATE POLICY "Org admins manage employee files delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-files'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.can_manage_employee_file(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Admins can view all files in storage" ON storage.objects;