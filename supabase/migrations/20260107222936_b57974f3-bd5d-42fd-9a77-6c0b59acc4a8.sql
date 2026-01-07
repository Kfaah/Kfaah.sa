-- Add RLS policy for employees folder in avatars bucket
CREATE POLICY "Admins can upload employee avatars"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = 'employees'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Anyone can view employee avatars"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = 'employees'
);

CREATE POLICY "Admins can update employee avatars"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = 'employees'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete employee avatars"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = 'employees'
  AND public.has_role(auth.uid(), 'admin')
);