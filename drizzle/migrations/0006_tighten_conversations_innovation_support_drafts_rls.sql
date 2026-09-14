-- 1) conversations: explicit DELETE policy limited to participants
DROP POLICY IF EXISTS "Participants can delete own conversations" ON public.conversations;
CREATE POLICY "Participants can delete own conversations"
ON public.conversations
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.conversation_participants cp
  WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
));

-- 2) innovation suggestions/messages: management-only visibility
DROP POLICY IF EXISTS "Org members view suggestions" ON public.innovation_suggestions;
CREATE POLICY "Org admins view suggestions"
ON public.innovation_suggestions
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (user_belongs_to_org(auth.uid(), organization_id) AND is_org_admin(auth.uid(), organization_id))
);

DROP POLICY IF EXISTS "Org members view messages" ON public.innovation_messages;
CREATE POLICY "Org admins view messages"
ON public.innovation_messages
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.innovation_suggestions s
  WHERE s.id = innovation_messages.suggestion_id
    AND (
      is_super_admin(auth.uid())
      OR (user_belongs_to_org(auth.uid(), s.organization_id) AND is_org_admin(auth.uid(), s.organization_id))
    )
));

DROP POLICY IF EXISTS "Org members add messages" ON public.innovation_messages;
CREATE POLICY "Org admins add messages"
ON public.innovation_messages
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.innovation_suggestions s
  WHERE s.id = innovation_messages.suggestion_id
    AND (
      is_super_admin(auth.uid())
      OR (user_belongs_to_org(auth.uid(), s.organization_id) AND is_org_admin(auth.uid(), s.organization_id))
    )
));

-- 3) support_drafts: authors can manage their own drafts (OR super admin)
DROP POLICY IF EXISTS "Owners manage own drafts" ON public.support_drafts;
CREATE POLICY "Owners manage own drafts"
ON public.support_drafts
FOR ALL
TO authenticated
USING (auth.uid() = author_user_id OR is_super_admin(auth.uid()))
WITH CHECK (auth.uid() = author_user_id OR is_super_admin(auth.uid()));