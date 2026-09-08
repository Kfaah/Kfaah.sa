DROP POLICY IF EXISTS "Authenticated users can view task attachments" ON storage.objects;

CREATE POLICY "Owners and org admins can view task attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.can_manage_employee_file(((storage.foldername(name))[1])::uuid)
);