-- Fix infinite recursion by removing self-referential RLS on conversation_participants
-- and moving “conversation lookup + participant expansion” to SECURITY DEFINER functions.

-- 1) Helper RPC: list conversations for a user with the other participant name (1:1)
CREATE OR REPLACE FUNCTION public.get_conversations_for_user(_user_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  updated_at timestamptz,
  other_user_id uuid,
  other_full_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    c.id AS conversation_id,
    c.updated_at,
    cp_other.user_id AS other_user_id,
    COALESCE(e.full_name, 'مستخدم') AS other_full_name
  FROM public.conversations c
  JOIN public.conversation_participants cp_self
    ON cp_self.conversation_id = c.id
   AND cp_self.user_id = _user_id
  JOIN public.conversation_participants cp_other
    ON cp_other.conversation_id = c.id
   AND cp_other.user_id <> _user_id
  LEFT JOIN public.employees e
    ON e.user_id = cp_other.user_id
  ORDER BY c.updated_at DESC;
$$;

-- 2) Helper RPC: create (or reuse) a direct conversation safely
CREATE OR REPLACE FUNCTION public.create_direct_conversation(_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  _conv_id uuid;
  _me uuid;
BEGIN
  _me := auth.uid();
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _other_user_id IS NULL OR _other_user_id = _me THEN
    RAISE EXCEPTION 'invalid_other_user';
  END IF;

  -- Reuse existing 1:1 conversation between _me and _other_user_id if present
  SELECT cp1.conversation_id
    INTO _conv_id
  FROM public.conversation_participants cp1
  JOIN public.conversation_participants cp2
    ON cp2.conversation_id = cp1.conversation_id
  WHERE cp1.user_id = _me
    AND cp2.user_id = _other_user_id
  LIMIT 1;

  IF _conv_id IS NOT NULL THEN
    RETURN _conv_id;
  END IF;

  INSERT INTO public.conversations DEFAULT VALUES
  RETURNING id INTO _conv_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (_conv_id, _me), (_conv_id, _other_user_id);

  RETURN _conv_id;
END;
$$;

-- 3) RLS: remove any policies that can recurse on conversation_participants

-- conversation_participants
DROP POLICY IF EXISTS "Users can view participants of own conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Participants can add others to conversation" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;

-- Keep update own participation policy (recreate to be explicit)
DROP POLICY IF EXISTS "Users can update own participation" ON public.conversation_participants;

CREATE POLICY "Users can view own participation"
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own participation"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own participation"
ON public.conversation_participants
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;

CREATE POLICY "Users can view own conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
  )
);

-- messages
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages in own conversations" ON public.messages;

CREATE POLICY "Users can view messages in own conversations"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages in own conversations"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
  )
);
