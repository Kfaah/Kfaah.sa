
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-plan-references', 'ai-plan-references', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload AI plan references"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ai-plan-references');

CREATE POLICY "Authenticated users can read AI plan references"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ai-plan-references');

CREATE POLICY "Authenticated users can delete their AI plan references"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ai-plan-references' AND owner = auth.uid());
