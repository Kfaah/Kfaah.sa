
-- إنشاء جدول المبادرات الفرعية
CREATE TABLE IF NOT EXISTS public.sub_initiatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  initiative_id UUID NOT NULL REFERENCES public.initiatives(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sub_initiatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view sub_initiatives"
ON public.sub_initiatives FOR SELECT
USING (
  organization_id IS NULL
  OR public.user_belongs_to_org(auth.uid(), organization_id)
);

CREATE POLICY "Org members can insert sub_initiatives"
ON public.sub_initiatives FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    organization_id IS NULL
    OR public.user_belongs_to_org(auth.uid(), organization_id)
  )
);

CREATE POLICY "Org members can update sub_initiatives"
ON public.sub_initiatives FOR UPDATE
USING (
  organization_id IS NULL
  OR public.user_belongs_to_org(auth.uid(), organization_id)
);

CREATE POLICY "Org members can delete sub_initiatives"
ON public.sub_initiatives FOR DELETE
USING (
  organization_id IS NULL
  OR public.user_belongs_to_org(auth.uid(), organization_id)
);

CREATE TRIGGER set_org_id_sub_initiatives
BEFORE INSERT ON public.sub_initiatives
FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();

CREATE TRIGGER update_sub_initiatives_updated_at
BEFORE UPDATE ON public.sub_initiatives
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- إضافة حقول المبادرة الفرعية إلى operational_plans
ALTER TABLE public.operational_plans
  ADD COLUMN IF NOT EXISTS sub_initiative TEXT,
  ADD COLUMN IF NOT EXISTS sub_initiative_id UUID REFERENCES public.sub_initiatives(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_operational_plans_sub_initiative_id
  ON public.operational_plans(sub_initiative_id);
CREATE INDEX IF NOT EXISTS idx_sub_initiatives_initiative_id
  ON public.sub_initiatives(initiative_id);
