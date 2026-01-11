-- إعادة إنشاء سياسات الرسائل/المحادثات مع استدعاء الدالة بشكل مُؤهل بالمخطط لتجنب أي التباس

-- conversation_participants
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;

CREATE POLICY "Users can view conversation participants"
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (
  public.is_conversation_participant(conversation_id, auth.uid())
);

CREATE POLICY "Users can add participants"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    user_id = auth.uid() OR
    public.is_conversation_participant(conversation_id, auth.uid())
  )
);

-- conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;

CREATE POLICY "Users can view own conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  public.is_conversation_participant(id, auth.uid())
);

CREATE POLICY "Users can update own conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  public.is_conversation_participant(id, auth.uid())
);

-- messages
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages in own conversations" ON public.messages;

CREATE POLICY "Users can view messages in own conversations"
ON public.messages
FOR SELECT
TO authenticated
USING (
  public.is_conversation_participant(conversation_id, auth.uid())
);

CREATE POLICY "Users can send messages in own conversations"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  public.is_conversation_participant(conversation_id, auth.uid())
);
