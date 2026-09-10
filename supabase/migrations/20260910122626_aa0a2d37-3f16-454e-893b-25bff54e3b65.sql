-- 1) abandoned_carts: remove non-admin update path
DROP POLICY IF EXISTS "Org members update carts" ON public.abandoned_carts;

-- 2) task_messages: enforce task/organization consistency for org-admin inserts
DROP POLICY IF EXISTS "Org admins can insert org task messages" ON public.task_messages;
CREATE POLICY "Org admins can insert org task messages"
ON public.task_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND organization_id IS NOT NULL
  AND admin_can_access_org(organization_id)
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_messages.task_id
      AND t.organization_id = task_messages.organization_id
  )
);

-- 3) internal message attachments: no public read
DROP POLICY IF EXISTS "internal msg attachments public read" ON storage.objects;
CREATE POLICY "internal msg attachments scoped read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'internal-message-attachments'
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.internal_threads t
      WHERE t.id::text = (storage.foldername(name))[2]
        AND t.member_user_id = auth.uid()
    )
  )
);