-- Ensure storage buckets that the Kfaah frontend and AI pipelines depend on
-- are created by source-controlled migrations instead of manual hosted-project state.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('org-documents', 'org-documents', false, 52428800),
  ('analysis-previews', 'analysis-previews', false, 20971520)
ON CONFLICT (id) DO NOTHING;

-- These buckets contain organization-scoped/private material.
UPDATE storage.buckets
SET public = false
WHERE id IN ('org-documents', 'analysis-previews');

-- Source previews are written by service-role Edge Functions and read by
-- authenticated users only when they belong to the organization encoded in
-- the first path segment, or are platform super admins.
DROP POLICY IF EXISTS "analysis_previews_org_read" ON storage.objects;
CREATE POLICY "analysis_previews_org_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'analysis-previews'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_org(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  )
);
