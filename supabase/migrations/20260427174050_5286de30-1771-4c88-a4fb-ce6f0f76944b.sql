CREATE TABLE public.excel_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID,
  user_id UUID,
  plan_name TEXT NOT NULL DEFAULT 'الخطة الأولى',
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int,
  sheet_name TEXT,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  use_for_ai BOOLEAN NOT NULL DEFAULT false,
  source_filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.excel_plans ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER excel_plans_set_org
  BEFORE INSERT ON public.excel_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();

CREATE TRIGGER excel_plans_updated_at
  BEFORE UPDATE ON public.excel_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "org members can view excel plans"
  ON public.excel_plans FOR SELECT TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "org members can insert excel plans"
  ON public.excel_plans FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id) OR organization_id IS NULL);

CREATE POLICY "org members can update excel plans"
  ON public.excel_plans FOR UPDATE TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "org members can delete excel plans"
  ON public.excel_plans FOR DELETE TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE INDEX idx_excel_plans_org_year ON public.excel_plans(organization_id, year DESC);