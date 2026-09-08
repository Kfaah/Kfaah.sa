DROP POLICY IF EXISTS "super admins write org-documents" ON storage.objects;
CREATE POLICY "super admins write org-documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'org-documents'
  AND public.is_super_admin(auth.uid())
  AND COALESCE((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
);