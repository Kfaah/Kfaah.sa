-- إصلاح نهائي لمشكلة recursion: جعل الدالة تتجاوز RLS داخلها
-- (هذا النمط يمنع Postgres من الدخول في تكرار سياسات الصفوف)

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
  )
$$;