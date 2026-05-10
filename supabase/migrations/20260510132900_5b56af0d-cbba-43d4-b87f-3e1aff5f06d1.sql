
ALTER TABLE public.internal_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO storage.buckets (id, name, public)
VALUES ('internal-message-attachments', 'internal-message-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "internal msg attachments public read" ON storage.objects;
CREATE POLICY "internal msg attachments public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'internal-message-attachments');

DROP POLICY IF EXISTS "internal msg attachments authed upload" ON storage.objects;
CREATE POLICY "internal msg attachments authed upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'internal-message-attachments');

DROP POLICY IF EXISTS "internal msg attachments owner delete" ON storage.objects;
CREATE POLICY "internal msg attachments owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'internal-message-attachments' AND owner = auth.uid());
