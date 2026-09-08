-- 1) ai-plan-references: enforce per-user folder on upload
DROP POLICY IF EXISTS "Authenticated users can upload AI plan references" ON storage.objects;
CREATE POLICY "Authenticated users can upload AI plan references"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ai-plan-references'
  AND (is_super_admin(auth.uid()) OR (storage.foldername(name))[1] = (auth.uid())::text)
);

-- 2) internal-message-attachments: drop the permissive upload policy (stricter owner policy remains)
DROP POLICY IF EXISTS "internal msg attachments authed upload" ON storage.objects;

-- 3) conversations: guarantee creator is a participant
CREATE OR REPLACE FUNCTION public.add_conversation_creator_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (NEW.id, auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.add_conversation_creator_participant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_conversation_creator_participant() FROM anon;

DROP TRIGGER IF EXISTS trg_add_conversation_creator_participant ON public.conversations;
CREATE TRIGGER trg_add_conversation_creator_participant
AFTER INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.add_conversation_creator_participant();

-- restrict conversation creation to authenticated users only
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations"
ON public.conversations FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);