-- إعادة إنشاء الدالة بحيث تتجاوز RLS (الدوال SECURITY DEFINER تعمل بصلاحيات المالك)
-- لكن المشكلة أن الاستعلام داخل الدالة يخضع لـ RLS أيضاً
-- الحل: استخدام جدول مساعد بدون RLS أو تبسيط المنطق

-- حذف السياسات الحالية
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages in own conversations" ON public.messages;

-- حذف الدالة القديمة
DROP FUNCTION IF EXISTS public.is_conversation_participant;

-- إنشاء دالة جديدة تستخدم استعلام مباشر بدون الخضوع لـ RLS
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result boolean;
BEGIN
  -- استخدام search_path فارغ يمنع استدعاء RLS
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = _conversation_id
      AND cp.user_id = _user_id
  ) INTO result;
  RETURN result;
END;
$$;

-- إعادة إنشاء السياسات باستخدام الدالة الجديدة
CREATE POLICY "Users can view conversation participants"
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (public.is_conversation_participant(conversation_id, auth.uid()));

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

CREATE POLICY "Users can view own conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (public.is_conversation_participant(id, auth.uid()));

CREATE POLICY "Users can update own conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (public.is_conversation_participant(id, auth.uid()));

CREATE POLICY "Users can view messages in own conversations"
ON public.messages
FOR SELECT
TO authenticated
USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Users can send messages in own conversations"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  public.is_conversation_participant(conversation_id, auth.uid())
);