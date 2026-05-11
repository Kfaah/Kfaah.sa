
-- Add fully_spent fields to existing summary
ALTER TABLE public.donor_spend_summary
  ADD COLUMN IF NOT EXISTS fully_spent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fully_spent_message text,
  ADD COLUMN IF NOT EXISTS primary_project text;

-- Update allocate_expense to set fully_spent flags after summary refresh
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

  DELETE FROM public.expense_allocations WHERE expense_id = _expense_id;
  _remaining := _exp.amount;

  IF _exp.kind = 'project' AND COALESCE(_exp.project_name, '') <> '' THEN
    _alloc_type := 'direct';
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

  -- Refresh donor summaries with fully_spent + primary_project + message
  WITH donor_ids AS (
    SELECT DISTINCT donor_id FROM public.expense_allocations
    WHERE expense_id = _expense_id AND donor_id IS NOT NULL
  ),
  agg AS (
    SELECT
      d.id AS donor_id,
      d.organization_id,
      COALESCE(SUM(don.amount), 0) AS total_donated,
      COALESCE((SELECT SUM(ea.amount_allocated) FROM public.expense_allocations ea WHERE ea.donor_id = d.id), 0) AS total_allocated,
      (
        SELECT exp2.project_name
        FROM public.expense_allocations ea2
        JOIN public.expenses exp2 ON exp2.id = ea2.expense_id
        WHERE ea2.donor_id = d.id AND exp2.project_name IS NOT NULL
        GROUP BY exp2.project_name
        ORDER BY SUM(ea2.amount_allocated) DESC
        LIMIT 1
      ) AS primary_project,
      (
        SELECT COALESCE(jsonb_agg(DISTINCT exp3.project_name) FILTER (WHERE exp3.project_name IS NOT NULL), '[]'::jsonb)
        FROM public.expense_allocations ea3
        JOIN public.expenses exp3 ON exp3.id = ea3.expense_id
        WHERE ea3.donor_id = d.id
      ) AS projects_funded
    FROM public.donors d
    JOIN donor_ids di ON di.donor_id = d.id
    LEFT JOIN public.donations don ON don.donor_id = d.id
    GROUP BY d.id, d.organization_id
  )
  INSERT INTO public.donor_spend_summary
    (donor_id, organization_id, total_donated, total_allocated, total_spent_visible,
     projects_funded, primary_project, fully_spent, fully_spent_message, last_updated)
  SELECT
    a.donor_id,
    a.organization_id,
    a.total_donated,
    a.total_allocated,
    LEAST(a.total_donated, a.total_allocated * 2),
    a.projects_funded,
    a.primary_project,
    (a.total_donated > 0 AND (a.total_allocated / a.total_donated) >= 0.5),
    CASE
      WHEN a.total_donated > 0 AND (a.total_allocated / a.total_donated) >= 0.5
        THEN 'تم صرف كامل تبرعك لصالح ' || COALESCE(a.primary_project, 'مشاريع الجمعية') || '. شكراً لكرمك.'
      ELSE 'جارٍ توجيه تبرعك إلى المشاريع المستحقة.'
    END,
    now()
  FROM agg a
  ON CONFLICT (donor_id) DO UPDATE SET
    total_donated = EXCLUDED.total_donated,
    total_allocated = EXCLUDED.total_allocated,
    total_spent_visible = EXCLUDED.total_spent_visible,
    projects_funded = EXCLUDED.projects_funded,
    primary_project = EXCLUDED.primary_project,
    fully_spent = EXCLUDED.fully_spent,
    fully_spent_message = EXCLUDED.fully_spent_message,
    last_updated = now();
END;
$$;

-- External sources
CREATE TABLE IF NOT EXISTS public.org_external_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('website','twitter','instagram','facebook','linkedin','youtube','tiktok')),
  url text NOT NULL,
  label text,
  last_synced_at timestamptz,
  last_status text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oes_org ON public.org_external_sources(organization_id);

CREATE TABLE IF NOT EXISTS public.org_external_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.org_external_sources(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('news','event','statistic','program','general')),
  title text NOT NULL,
  description text,
  url text,
  occurred_at date,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oei_org ON public.org_external_insights(organization_id);

CREATE TABLE IF NOT EXISTS public.smart_report_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  audience text,
  benefit text,
  category text,
  priority int DEFAULT 5,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_srs_org ON public.smart_report_suggestions(organization_id);

CREATE TABLE IF NOT EXISTS public.donor_letters_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  donor_id uuid REFERENCES public.donors(id) ON DELETE SET NULL,
  letter_type text NOT NULL CHECK (letter_type IN ('thank_you','transparency_report','annual_report')),
  format text NOT NULL CHECK (format IN ('pdf','docx')),
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dll_org ON public.donor_letters_log(organization_id);

CREATE TRIGGER trg_oes_updated BEFORE UPDATE ON public.org_external_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.org_external_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_external_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_report_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donor_letters_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view sources" ON public.org_external_sources FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Org admins manage sources" ON public.org_external_sources FOR ALL
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org members view insights" ON public.org_external_insights FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Org admins manage insights" ON public.org_external_insights FOR ALL
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org members view report suggestions" ON public.smart_report_suggestions FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Org admins manage report suggestions" ON public.smart_report_suggestions FOR ALL
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org members view donor letters" ON public.donor_letters_log FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Org admins log donor letters" ON public.donor_letters_log FOR ALL
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));
