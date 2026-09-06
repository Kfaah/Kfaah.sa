CREATE POLICY "super admins read org-documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'org-documents' AND public.is_super_admin(auth.uid()));