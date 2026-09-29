-- Restore the intended upload contract:
-- - org-documents is the private arbitrary-document archive (up to 200 MB).
-- - data-uploads remains the structured Excel/CSV bucket.
-- All browser writes are constrained to the active organization folder.

DROP POLICY IF EXISTS "super admins write org-documents" ON storage.objects;
DROP POLICY IF EXISTS "org admins upload org-documents" ON storage.objects;

CREATE POLICY "org admins upload org-documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'org-documents'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND public.admin_can_access_org(
    ((storage.foldername(name))[1])::uuid
  )
);

DROP POLICY IF EXISTS "Org members can upload data files" ON storage.objects;
DROP POLICY IF EXISTS "Org admins can delete data files" ON storage.objects;

CREATE POLICY "Org admins can upload data files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'data-uploads'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND public.admin_can_access_org(
    ((storage.foldername(name))[1])::uuid
  )
);

CREATE POLICY "Org admins can delete data files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'data-uploads'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND public.admin_can_access_org(
    ((storage.foldername(name))[1])::uuid
  )
);

-- Keep the archive limit aligned with the Uploads page.
UPDATE storage.buckets
SET file_size_limit = 209715200,
    public = false
WHERE id = 'org-documents';
