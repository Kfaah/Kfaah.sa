CREATE OR REPLACE FUNCTION public.donations_overview(p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric := 0;
  v_count bigint := 0;
  v_projects int := 0;
  v_gifts_total numeric := 0;
  v_gifts_count bigint := 0;
  v_years jsonb := '[]'::jsonb;
  v_by_project jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_org(auth.uid(), p_org)
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT COALESCE(SUM(amount), 0), COUNT(*), COUNT(DISTINCT project_name)
    INTO v_total, v_count, v_projects
  FROM public.donations
  WHERE organization_id = p_org;

  SELECT COALESCE(SUM(amount), 0), COUNT(*)
    INTO v_gifts_total, v_gifts_count
  FROM public.gifts
  WHERE organization_id = p_org;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('year', y, 'total', t) ORDER BY y DESC), '[]'::jsonb)
    INTO v_years
  FROM (
    SELECT EXTRACT(YEAR FROM donation_date)::int AS y, SUM(amount) AS t
    FROM public.donations
    WHERE organization_id = p_org
    GROUP BY 1
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('project', p, 'total', t) ORDER BY t DESC), '[]'::jsonb)
    INTO v_by_project
  FROM (
    SELECT COALESCE(project_name, 'غير محدد') AS p, SUM(amount) AS t
    FROM public.donations
    WHERE organization_id = p_org
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 20
  ) s;

  RETURN jsonb_build_object(
    'total', v_total,
    'count', v_count,
    'projects_count', v_projects,
    'gifts_total', v_gifts_total,
    'gifts_count', v_gifts_count,
    'by_year', v_years,
    'by_project', v_by_project
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.donations_overview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.donations_overview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.donations_overview(uuid) TO service_role;