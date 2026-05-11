
-- 1. expense_categories
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('project','marketing','operational')),
  default_allocation_pct numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expense_categories_org ON public.expense_categories(organization_id);

-- 2. org_allocation_rules
CREATE TABLE public.org_allocation_rules (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_pct numeric(5,2) NOT NULL DEFAULT 50,
  marketing_pct numeric(5,2) NOT NULL DEFAULT 40,
  operational_pct numeric(5,2) NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  vendor text,
  attachment_url text,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('project','marketing','operational')),
  project_name text,
  project_id uuid REFERENCES public.projects_catalog(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  auto_classified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'allocated' CHECK (status IN ('pending','allocated','failed')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_org_date ON public.expenses(organization_id, expense_date DESC);
CREATE INDEX idx_expenses_kind ON public.expenses(organization_id, kind);
CREATE INDEX idx_expenses_project ON public.expenses(organization_id, project_name);

-- 4. expense_allocations
CREATE TABLE public.expense_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  donation_id uuid NOT NULL REFERENCES public.donations(id) ON DELETE CASCADE,
  donor_id uuid REFERENCES public.donors(id) ON DELETE SET NULL,
  amount_allocated numeric(12,2) NOT NULL CHECK (amount_allocated >= 0),
  allocation_type text NOT NULL CHECK (allocation_type IN ('direct','proportional')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_alloc_expense ON public.expense_allocations(expense_id);
CREATE INDEX idx_alloc_donation ON public.expense_allocations(donation_id);
CREATE INDEX idx_alloc_donor ON public.expense_allocations(donor_id);
CREATE INDEX idx_alloc_org ON public.expense_allocations(organization_id);

-- 5. donor_spend_summary
CREATE TABLE public.donor_spend_summary (
  donor_id uuid PRIMARY KEY REFERENCES public.donors(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  total_donated numeric(14,2) NOT NULL DEFAULT 0,
  total_allocated numeric(14,2) NOT NULL DEFAULT 0,
  total_spent_visible numeric(14,2) NOT NULL DEFAULT 0,
  projects_funded jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_updated timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dss_org ON public.donor_spend_summary(organization_id);

-- updated_at triggers
CREATE TRIGGER trg_expense_categories_updated BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_org_allocation_rules_updated BEFORE UPDATE ON public.org_allocation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_allocation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donor_spend_summary ENABLE ROW LEVEL SECURITY;

-- Policies: read for org members, write for org admins
CREATE POLICY "Org members view expense_categories" ON public.expense_categories FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Org admins manage expense_categories" ON public.expense_categories FOR ALL
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org members view allocation_rules" ON public.org_allocation_rules FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Org admins manage allocation_rules" ON public.org_allocation_rules FOR ALL
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org members view expenses" ON public.expenses FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Org admins manage expenses" ON public.expenses FOR ALL
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org members view allocations" ON public.expense_allocations FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Org admins manage allocations" ON public.expense_allocations FOR ALL
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org members view donor_spend_summary" ON public.donor_spend_summary FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Org admins manage donor_spend_summary" ON public.donor_spend_summary FOR ALL
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

-- Storage bucket for receipts (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('expense-receipts', 'expense-receipts', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Org members view receipts" ON storage.objects FOR SELECT
  USING (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);
CREATE POLICY "Org admins upload receipts" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);
CREATE POLICY "Org admins update receipts" ON storage.objects FOR UPDATE
  USING (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);
CREATE POLICY "Org admins delete receipts" ON storage.objects FOR DELETE
  USING (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);

-- Helper RPC: ensure default categories + rules exist for an org
CREATE OR REPLACE FUNCTION public.ensure_org_finance_defaults(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.org_allocation_rules (organization_id) VALUES (_org_id)
    ON CONFLICT (organization_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE organization_id = _org_id) THEN
    INSERT INTO public.expense_categories (organization_id, name, kind, default_allocation_pct) VALUES
      (_org_id, 'صرف على المشاريع', 'project', 50),
      (_org_id, 'تسويق وإعلان', 'marketing', 40),
      (_org_id, 'تشغيلي وإداري', 'operational', 10);
  END IF;
END;
$$;

-- Core allocation function
CREATE OR REPLACE FUNCTION public.allocate_expense(_expense_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _exp RECORD;
  _remaining numeric;
  _don RECORD;
  _take numeric;
  _alloc_type text;
BEGIN
  SELECT * INTO _exp FROM public.expenses WHERE id = _expense_id;
  IF _exp IS NULL THEN RETURN; END IF;

  -- Clear any prior allocations (re-run safe)
  DELETE FROM public.expense_allocations WHERE expense_id = _expense_id;

  _remaining := _exp.amount;

  IF _exp.kind = 'project' AND COALESCE(_exp.project_name, '') <> '' THEN
    _alloc_type := 'direct';
    -- Pull from donations matching this project, FIFO by donation_date
    FOR _don IN
      SELECT d.id, d.donor_id, d.amount,
             COALESCE(SUM(ea.amount_allocated), 0) AS already
      FROM public.donations d
      LEFT JOIN public.expense_allocations ea ON ea.donation_id = d.id
      WHERE d.organization_id = _exp.organization_id
        AND d.status = 'success'
        AND COALESCE(d.project_name, '') = _exp.project_name
      GROUP BY d.id
      HAVING d.amount > COALESCE(SUM(ea.amount_allocated), 0)
      ORDER BY d.donation_date ASC
    LOOP
      EXIT WHEN _remaining <= 0;
      _take := LEAST(_remaining, _don.amount - _don.already);
      IF _take > 0 THEN
        INSERT INTO public.expense_allocations
          (organization_id, expense_id, donation_id, donor_id, amount_allocated, allocation_type)
        VALUES (_exp.organization_id, _exp.id, _don.id, _don.donor_id, _take, _alloc_type);
        _remaining := _remaining - _take;
      END IF;
    END LOOP;
  ELSE
    -- proportional: spread across all donations with remaining capacity
    _alloc_type := 'proportional';
    DECLARE
      _total_capacity numeric := 0;
      _factor numeric;
    BEGIN
      SELECT COALESCE(SUM(d.amount - COALESCE(used.used, 0)), 0) INTO _total_capacity
      FROM public.donations d
      LEFT JOIN (
        SELECT donation_id, SUM(amount_allocated) AS used
        FROM public.expense_allocations
        GROUP BY donation_id
      ) used ON used.donation_id = d.id
      WHERE d.organization_id = _exp.organization_id AND d.status = 'success';

      IF _total_capacity <= 0 THEN
        UPDATE public.expenses SET status = 'failed' WHERE id = _expense_id;
        RETURN;
      END IF;

      _factor := LEAST(_remaining / _total_capacity, 1);

      FOR _don IN
        SELECT d.id, d.donor_id, d.amount,
               COALESCE(SUM(ea.amount_allocated), 0) AS already
        FROM public.donations d
        LEFT JOIN public.expense_allocations ea ON ea.donation_id = d.id
        WHERE d.organization_id = _exp.organization_id AND d.status = 'success'
        GROUP BY d.id
        HAVING d.amount > COALESCE(SUM(ea.amount_allocated), 0)
      LOOP
        EXIT WHEN _remaining <= 0;
        _take := LEAST(_remaining, ROUND((_don.amount - _don.already) * _factor, 2));
        IF _take > 0 THEN
          INSERT INTO public.expense_allocations
            (organization_id, expense_id, donation_id, donor_id, amount_allocated, allocation_type)
          VALUES (_exp.organization_id, _exp.id, _don.id, _don.donor_id, _take, _alloc_type);
          _remaining := _remaining - _take;
        END IF;
      END LOOP;
    END;
  END IF;

  UPDATE public.expenses SET status = CASE WHEN _remaining > 0.01 THEN 'failed' ELSE 'allocated' END
   WHERE id = _expense_id;

  -- Refresh donor summary for affected donors
  INSERT INTO public.donor_spend_summary (donor_id, organization_id, total_donated, total_allocated, total_spent_visible, projects_funded, last_updated)
  SELECT
    d.id,
    d.organization_id,
    COALESCE(SUM(don.amount), 0),
    COALESCE(SUM(ea.amount_allocated), 0),
    COALESCE(SUM(ea.amount_allocated), 0),
    COALESCE(jsonb_agg(DISTINCT exp.project_name) FILTER (WHERE exp.project_name IS NOT NULL), '[]'::jsonb),
    now()
  FROM public.donors d
  JOIN public.donations don ON don.donor_id = d.id
  LEFT JOIN public.expense_allocations ea ON ea.donor_id = d.id
  LEFT JOIN public.expenses exp ON exp.id = ea.expense_id
  WHERE d.id IN (SELECT donor_id FROM public.expense_allocations WHERE expense_id = _expense_id AND donor_id IS NOT NULL)
  GROUP BY d.id, d.organization_id
  ON CONFLICT (donor_id) DO UPDATE SET
    total_donated = EXCLUDED.total_donated,
    total_allocated = EXCLUDED.total_allocated,
    total_spent_visible = EXCLUDED.total_spent_visible,
    projects_funded = EXCLUDED.projects_funded,
    last_updated = now();
END;
$$;

-- Trigger: auto-allocate after insert
CREATE OR REPLACE FUNCTION public.tr_expense_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.allocate_expense(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_expense_after_insert
  AFTER INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.tr_expense_after_insert();
