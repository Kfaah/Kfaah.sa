-- Recovery guardrails for storage contracts used by the Kfaah frontend.
-- Idempotent: safe to apply after a database restore where some buckets already exist.

-- The Uploads page stores arbitrary organization documents here and advertises a 200 MB client limit.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('org-documents', 'org-documents', false, 209715200)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit;

-- Deep analysis screenshots are service-role writes and authenticated org-scoped reads.
-- Source code discards previews above 15 MB, so keep a small margin above that.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('analysis-previews', 'analysis-previews', false, 16777216, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "analysis_previews_org_read" ON storage.objects;
CREATE POLICY "analysis_previews_org_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'analysis-previews'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

-- Branding asset paths are "<organization_id>/...".
-- Earlier policy versions only checked a global role and allowed an elevated
-- user in one organization to write another organization's branding path.
DROP POLICY IF EXISTS "branding_assets_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "branding_assets_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "branding_assets_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "branding_assets_admin_upload" ON storage.objects;
DROP POLICY IF EXISTS "branding_assets_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "branding_assets_admin_delete" ON storage.objects;

CREATE POLICY "branding_assets_org_admin_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'branding-assets'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "branding_assets_org_admin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'branding-assets'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'branding-assets'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "branding_assets_org_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'branding-assets'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
