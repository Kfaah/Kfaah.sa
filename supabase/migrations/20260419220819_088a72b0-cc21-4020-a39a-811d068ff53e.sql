-- Create private storage bucket for uploaded Excel files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'data-uploads',
  'data-uploads',
  false,
  52428800, -- 50MB
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Files are organized by: {organization_id}/{upload_id}_{filename}
-- RLS: members of an org can upload/view their org's files
CREATE POLICY "Org members can upload data files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'data-uploads'
  AND (storage.foldername(name))[1] = public.get_user_organization_id(auth.uid())::text
);

CREATE POLICY "Org members can view data files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'data-uploads'
  AND (
    (storage.foldername(name))[1] = public.get_user_organization_id(auth.uid())::text
    OR public.is_super_admin(auth.uid())
  )
);

CREATE POLICY "Org admins can delete data files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'data-uploads'
  AND (
    (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      AND (storage.foldername(name))[1] = public.get_user_organization_id(auth.uid())::text
    )
    OR public.is_super_admin(auth.uid())
  )
);