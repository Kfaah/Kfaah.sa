UPDATE public.data_uploads_log l
SET file_path = o.name,
    storage_bucket = 'org-documents'
FROM storage.objects o
WHERE l.file_path IS NULL
  AND o.bucket_id = 'org-documents'
  AND o.name LIKE (l.organization_id::text || '/archive/%')
  AND o.name LIKE ('%_' || l.file_name);