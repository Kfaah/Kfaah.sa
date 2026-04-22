
-- Bucket for action plan deliverables (donor lists CSVs) and employee reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('action-plan-files', 'action-plan-files', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for the bucket
CREATE POLICY "Public read action plan files"
ON storage.objects FOR SELECT
USING (bucket_id = 'action-plan-files');

-- Authenticated users can upload to bucket
CREATE POLICY "Authenticated upload action plan files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'action-plan-files');

-- Authenticated users can update/delete their own files
CREATE POLICY "Authenticated update action plan files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'action-plan-files');

CREATE POLICY "Authenticated delete action plan files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'action-plan-files');
