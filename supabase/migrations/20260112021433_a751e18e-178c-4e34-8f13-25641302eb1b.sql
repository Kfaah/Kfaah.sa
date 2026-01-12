-- إضافة سياسات للسماح بالتوقيعات في bucket avatars

-- السماح للمستخدمين برفع توقيعاتهم
CREATE POLICY "Users can upload own signature"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = 'signatures'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- السماح للمستخدمين بتحديث توقيعاتهم
CREATE POLICY "Users can update own signature"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = 'signatures'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- السماح للمستخدمين بحذف توقيعاتهم
CREATE POLICY "Users can delete own signature"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = 'signatures'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- السماح للجميع بعرض التوقيعات (لأن الـ bucket عام)
CREATE POLICY "Anyone can view signatures"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = 'signatures'
);