DROP POLICY IF EXISTS "Anyone can view task attachments" ON storage.objects;

CREATE POLICY "Authenticated users can view task attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'task-attachments');

DROP POLICY IF EXISTS "Authenticated users can upload task attachments" ON storage.objects;

CREATE POLICY "Authenticated users can upload task attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own task attachments" ON storage.objects;

CREATE POLICY "Users can delete own task attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);