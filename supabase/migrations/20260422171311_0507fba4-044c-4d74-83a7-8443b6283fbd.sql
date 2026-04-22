-- Innovation suggestions
CREATE TABLE IF NOT EXISTS public.innovation_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text NOT NULL,
  category text NOT NULL DEFAULT 'feature',
  area text,
  priority text NOT NULL DEFAULT 'medium',
  impact text,
  effort text,
  status text NOT NULL DEFAULT 'new',
  data_basis jsonb,
  ai_model text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_innovation_suggestions_org ON public.innovation_suggestions(organization_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS public.innovation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.innovation_suggestions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_innovation_messages_sugg ON public.innovation_messages(suggestion_id, created_at ASC);

ALTER TABLE public.innovation_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innovation_messages ENABLE ROW LEVEL SECURITY;

-- Suggestions policies
CREATE POLICY "Super admins manage all suggestions"
ON public.innovation_suggestions FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Org members view suggestions"
ON public.innovation_suggestions FOR SELECT
TO authenticated
USING (public.user_belongs_to_org(auth.uid(), organization_id));

-- Messages policies
CREATE POLICY "Super admins manage all messages"
ON public.innovation_messages FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Org members view messages"
ON public.innovation_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.innovation_suggestions s
    WHERE s.id = suggestion_id
      AND public.user_belongs_to_org(auth.uid(), s.organization_id)
  )
);

CREATE POLICY "Org members add messages"
ON public.innovation_messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.innovation_suggestions s
    WHERE s.id = suggestion_id
      AND public.user_belongs_to_org(auth.uid(), s.organization_id)
  )
);

CREATE TRIGGER trg_innovation_suggestions_updated_at
BEFORE UPDATE ON public.innovation_suggestions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();