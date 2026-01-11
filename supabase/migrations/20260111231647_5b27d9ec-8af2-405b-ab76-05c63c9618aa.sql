-- تحديث سياسة إنشاء المحادثات لتكون أكثر أماناً
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- تحديث سياسة إضافة المشاركين
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;
CREATE POLICY "Participants can add others to conversation"
ON public.conversation_participants FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    -- المستخدم يضيف نفسه
    user_id = auth.uid() OR
    -- أو المستخدم مشارك بالفعل في المحادثة
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  )
);