CREATE OR REPLACE FUNCTION public.rebuild_donor_profiles(p_org uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_org IS NULL THEN
    RAISE EXCEPTION 'organization required';
  END IF;

  IF NOT (
    public.is_super_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'admin'::app_role) AND public.admin_can_access_org(p_org))
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF public.is_demo_org(p_org) OR public.is_demo_user(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH agg AS (
    SELECT
      COALESCE(NULLIF(btrim(d.donor_phone), ''), 'name:' || COALESCE(NULLIF(btrim(d.donor_name), ''), 'متبرع غير معروف')) AS external_id,
      NULLIF(btrim(d.donor_phone), '') AS phone,
      COALESCE(NULLIF(btrim(max(d.donor_name)), ''), 'متبرع غير معروف') AS full_name,
      round(sum(COALESCE(d.amount, 0))::numeric, 2) AS total_donated,
      count(*)::integer AS donations_count,
      min(d.donation_date) AS first_donation_at,
      max(d.donation_date) AS last_donation_at
    FROM public.donations d
    WHERE d.organization_id = p_org
    GROUP BY 1, 2
  )
  INSERT INTO public.donors (
    organization_id, external_id, full_name, phone, segment,
    total_donated, donations_count, first_donation_at, last_donation_at
  )
  SELECT
    p_org, a.external_id, a.full_name, a.phone,
    CASE WHEN a.total_donated >= 5000 THEN 'متبرع كبير'
         WHEN a.donations_count >= 2 THEN 'متكرر'
         ELSE 'جديد' END,
    a.total_donated, a.donations_count, a.first_donation_at, a.last_donation_at
  FROM agg a
  ON CONFLICT (organization_id, external_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    segment = EXCLUDED.segment,
    total_donated = EXCLUDED.total_donated,
    donations_count = EXCLUDED.donations_count,
    first_donation_at = EXCLUDED.first_donation_at,
    last_donation_at = EXCLUDED.last_donation_at;

  SELECT count(*) INTO v_count FROM public.donors WHERE organization_id = p_org;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_donor_profiles(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rebuild_donor_profiles(uuid) TO authenticated, service_role;