-- 1) Employee avatars: org-scoped admin write
DROP POLICY IF EXISTS "Admins can upload employee avatars" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update employee avatars" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete employee avatars" ON storage.objects;

CREATE POLICY "Org admins upload employee avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'employees'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND (
    is_super_admin(auth.uid())
    OR admin_can_access_org(((storage.foldername(name))[2])::uuid)
  )
);

CREATE POLICY "Org admins update employee avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'employees'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND (
    is_super_admin(auth.uid())
    OR admin_can_access_org(((storage.foldername(name))[2])::uuid)
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'employees'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND (
    is_super_admin(auth.uid())
    OR admin_can_access_org(((storage.foldername(name))[2])::uuid)
  )
);

CREATE POLICY "Org admins delete employee avatars"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'employees'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND (
    is_super_admin(auth.uid())
    OR admin_can_access_org(((storage.foldername(name))[2])::uuid)
  )
);

-- 2) staff-duties-files: org-scoped folder access
DROP POLICY IF EXISTS "Admins read staff duties files" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload staff duties files" ON storage.objects;
DROP POLICY IF EXISTS "Admins update staff duties files" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete staff duties files" ON storage.objects;

CREATE POLICY "Org admins read staff duties files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'staff-duties-files'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND admin_can_access_org(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Org admins upload staff duties files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'staff-duties-files'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND admin_can_access_org(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Org admins update staff duties files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'staff-duties-files'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND admin_can_access_org(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'staff-duties-files'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND admin_can_access_org(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Org admins delete staff duties files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'staff-duties-files'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND admin_can_access_org(((storage.foldername(name))[1])::uuid)
);

-- 3) platform email: super_admin only
DROP POLICY IF EXISTS "admins manage platform email messages" ON public.platform_email_messages;
DROP POLICY IF EXISTS "admins manage platform email threads" ON public.platform_email_threads;

CREATE POLICY "Super admins manage platform email messages"
ON public.platform_email_messages FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins manage platform email threads"
ON public.platform_email_threads FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));