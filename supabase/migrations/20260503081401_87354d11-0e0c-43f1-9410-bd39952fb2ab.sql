
-- 1) Demo organization
INSERT INTO public.organizations (id, name, slug, is_active, subscription_tier, allow_self_signup, contact_email)
VALUES (
  '00000000-0000-0000-0000-0000000000de'::uuid,
  'جمعية النموذج الخيرية (عرض تجريبي)',
  'demo',
  true,
  'demo',
  false,
  'demo@charity-crm.org'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  is_active = true,
  allow_self_signup = false;

-- 2) Helper: is the org the demo org?
CREATE OR REPLACE FUNCTION public.is_demo_org(_org_id uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _org_id = '00000000-0000-0000-0000-0000000000de'::uuid;
$$;

-- 3) Helper: is the user the demo viewer (any user belonging only to demo org with viewer role)
CREATE OR REPLACE FUNCTION public.is_demo_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = _user_id
      AND uo.organization_id = '00000000-0000-0000-0000-0000000000de'::uuid
      AND uo.approval_status = 'approved'
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = 'viewer'::app_role
  );
$$;

-- 4) Global write-block policies for demo org data.
-- Strategy: for every public table that has organization_id, add a RESTRICTIVE policy
-- that blocks INSERT/UPDATE/DELETE when organization_id = demo_org_id (so absolutely
-- no one — not even super admins via the SDK — can mutate demo data).
-- Also add a RESTRICTIVE policy that blocks ALL writes by demo users on every public table.

DO $$
DECLARE
  r RECORD;
  has_org_col boolean;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.tables c
    WHERE c.table_schema = 'public' AND c.table_type = 'BASE TABLE'
  LOOP
    -- Block writes BY demo user on every table (no exceptions)
    EXECUTE format($f$
      DROP POLICY IF EXISTS "demo_user_no_write_ins" ON public.%I;
      CREATE POLICY "demo_user_no_write_ins" ON public.%I
        AS RESTRICTIVE FOR INSERT TO authenticated
        WITH CHECK (NOT public.is_demo_user(auth.uid()));
      DROP POLICY IF EXISTS "demo_user_no_write_upd" ON public.%I;
      CREATE POLICY "demo_user_no_write_upd" ON public.%I
        AS RESTRICTIVE FOR UPDATE TO authenticated
        USING (NOT public.is_demo_user(auth.uid()))
        WITH CHECK (NOT public.is_demo_user(auth.uid()));
      DROP POLICY IF EXISTS "demo_user_no_write_del" ON public.%I;
      CREATE POLICY "demo_user_no_write_del" ON public.%I
        AS RESTRICTIVE FOR DELETE TO authenticated
        USING (NOT public.is_demo_user(auth.uid()));
    $f$, r.table_name, r.table_name, r.table_name, r.table_name, r.table_name, r.table_name);

    -- If table has organization_id, also block writes ON demo org rows by anyone
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name = r.table_name AND column_name='organization_id'
    ) INTO has_org_col;

    IF has_org_col THEN
      EXECUTE format($f$
        DROP POLICY IF EXISTS "demo_org_immutable_ins" ON public.%I;
        CREATE POLICY "demo_org_immutable_ins" ON public.%I
          AS RESTRICTIVE FOR INSERT TO authenticated
          WITH CHECK (organization_id IS NULL OR NOT public.is_demo_org(organization_id));
        DROP POLICY IF EXISTS "demo_org_immutable_upd" ON public.%I;
        CREATE POLICY "demo_org_immutable_upd" ON public.%I
          AS RESTRICTIVE FOR UPDATE TO authenticated
          USING (organization_id IS NULL OR NOT public.is_demo_org(organization_id))
          WITH CHECK (organization_id IS NULL OR NOT public.is_demo_org(organization_id));
        DROP POLICY IF EXISTS "demo_org_immutable_del" ON public.%I;
        CREATE POLICY "demo_org_immutable_del" ON public.%I
          AS RESTRICTIVE FOR DELETE TO authenticated
          USING (organization_id IS NULL OR NOT public.is_demo_org(organization_id));
      $f$, r.table_name, r.table_name, r.table_name, r.table_name, r.table_name, r.table_name);
    END IF;
  END LOOP;
END $$;

-- Also lock the demo organization row itself
DROP POLICY IF EXISTS "demo_org_row_immutable_upd" ON public.organizations;
CREATE POLICY "demo_org_row_immutable_upd" ON public.organizations
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_org(id))
  WITH CHECK (NOT public.is_demo_org(id));

DROP POLICY IF EXISTS "demo_org_row_immutable_del" ON public.organizations;
CREATE POLICY "demo_org_row_immutable_del" ON public.organizations
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_org(id));
