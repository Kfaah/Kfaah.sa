-- REVIEW ONLY. Do not apply to production without separate authorization.
-- New objects only; no changes to existing data, roles or policies.
BEGIN;
CREATE TABLE public.employee_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  attendance_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent')),
  check_in_at timestamptz,
  check_out_at timestamptz,
  UNIQUE (employee_id, attendance_date),
  CHECK ((status = 'absent' AND check_in_at IS NULL AND check_out_at IS NULL)
    OR (status = 'present' AND check_in_at IS NOT NULL
      AND (check_out_at IS NULL OR check_out_at >= check_in_at)))
);
CREATE INDEX employee_attendance_org_date ON public.employee_attendance(organization_id, attendance_date);
ALTER TABLE public.employee_attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_attendance FROM anon, authenticated;

CREATE FUNCTION public.attendance_manager(_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT auth.uid() IS NOT NULL AND (
   public.is_super_admin(auth.uid()) OR
   public.has_role_in_org(auth.uid(), 'admin'::public.app_role, _org) OR
   public.has_role_in_org(auth.uid(), 'hr_manager'::public.app_role, _org)
 );
$$;
REVOKE ALL ON FUNCTION public.attendance_manager(uuid) FROM PUBLIC;

CREATE FUNCTION public.get_employee_attendance(_org uuid, _day date, _self_only boolean DEFAULT false)
RETURNS TABLE(employee_id uuid, full_name text, status text, check_in_at timestamptz, check_out_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.organizations o WHERE o.id = _org AND o.is_active
 ) THEN RAISE EXCEPTION 'Attendance access denied' USING ERRCODE = '42501'; END IF;
 IF NOT public.attendance_manager(_org) AND NOT EXISTS (
   SELECT 1 FROM public.user_organizations m WHERE m.user_id = auth.uid()
     AND m.organization_id = _org AND m.approval_status = 'approved'
 ) THEN RAISE EXCEPTION 'Attendance access denied' USING ERRCODE = '42501'; END IF;
 RETURN QUERY
 SELECT e.id, e.full_name::text, COALESCE(a.status, 'unrecorded'), a.check_in_at, a.check_out_at
 FROM public.employees e LEFT JOIN public.employee_attendance a
   ON a.employee_id = e.id AND a.organization_id = e.organization_id AND a.attendance_date = _day
 WHERE e.organization_id = _org AND COALESCE(e.is_viewer_account, false) = false
   AND (e.user_id = auth.uid() OR (NOT _self_only AND public.attendance_manager(_org)))
 ORDER BY e.full_name;
END;
$$;

CREATE FUNCTION public.record_employee_attendance(_org uuid, _action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 emp uuid;
 day date := (statement_timestamp() AT TIME ZONE 'Asia/Riyadh')::date;
 affected integer;
BEGIN
 IF auth.uid() IS NULL OR _action NOT IN ('check_in', 'check_out', 'absent') OR _action IS NULL THEN
   RAISE EXCEPTION 'Invalid attendance request' USING ERRCODE = '42501';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = _org AND o.is_active)
   OR NOT EXISTS (SELECT 1 FROM public.user_organizations m WHERE m.user_id = auth.uid()
     AND m.organization_id = _org AND m.approval_status = 'approved')
   OR NOT public.organization_member_can_write(auth.uid(), _org) THEN
   RAISE EXCEPTION 'Attendance access denied' USING ERRCODE = '42501';
 END IF;
 SELECT e.id INTO STRICT emp FROM public.employees e WHERE e.organization_id = _org
   AND e.user_id = auth.uid() AND e.status = 'active' AND COALESCE(e.is_viewer_account, false) = false;
 IF _action = 'check_out' THEN
   UPDATE public.employee_attendance SET check_out_at = statement_timestamp()
     WHERE employee_id = emp AND organization_id = _org AND attendance_date = day
       AND status = 'present' AND check_out_at IS NULL;
   GET DIAGNOSTICS affected = ROW_COUNT;
   IF affected <> 1 THEN RAISE EXCEPTION 'No open attendance today'; END IF;
 ELSE
   INSERT INTO public.employee_attendance(organization_id, employee_id, attendance_date, status, check_in_at)
     VALUES (_org, emp, day, CASE WHEN _action = 'absent' THEN 'absent' ELSE 'present' END,
       CASE WHEN _action = 'check_in' THEN statement_timestamp() ELSE NULL END);
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.get_employee_attendance(uuid, date, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_employee_attendance(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_attendance(uuid, date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_employee_attendance(uuid, text) TO authenticated;
COMMIT;
