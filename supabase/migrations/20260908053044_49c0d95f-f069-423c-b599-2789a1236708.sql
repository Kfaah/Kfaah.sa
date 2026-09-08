CREATE OR REPLACE FUNCTION public.get_org_member_roles(_org_id uuid DEFAULT NULL)
RETURNS TABLE(
  user_id uuid,
  employee_id uuid,
  full_name text,
  username text,
  job_role text,
  organization_id uuid,
  role_level employee_role_level,
  app_roles app_role[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target uuid;
BEGIN
  _target := COALESCE(_org_id, public.get_user_organization_id(auth.uid()));
  IF _target IS NULL THEN
    RETURN;
  END IF;

  IF NOT (public.is_super_admin(auth.uid())
          OR (public.has_role(auth.uid(), 'admin') AND public.user_belongs_to_org(auth.uid(), _target))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT e.user_id,
         e.id,
         e.full_name,
         e.username,
         e.job_role,
         e.organization_id,
         e.role_level,
         COALESCE(ARRAY(SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = e.user_id ORDER BY ur.role), '{}'::app_role[])
  FROM public.employees e
  WHERE e.organization_id = _target
    AND e.user_id IS NOT NULL
  ORDER BY e.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_member_roles(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_org_member_roles(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_org_member_roles(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_org_member_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid;
BEGIN
  IF public.is_demo_user(auth.uid()) THEN
    RAISE EXCEPTION 'demo_readonly';
  END IF;

  SELECT e.organization_id INTO _org
  FROM public.employees e
  WHERE e.user_id = _user_id
  LIMIT 1;

  IF _org IS NULL THEN
    RAISE EXCEPTION 'member_not_found';
  END IF;

  IF public.is_super_admin(auth.uid()) THEN
    NULL;
  ELSIF public.has_role(auth.uid(), 'admin') AND public.user_belongs_to_org(auth.uid(), _org) THEN
    IF _role IN ('admin', 'super_admin') THEN
      RAISE EXCEPTION 'insufficient_privileges';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _user_id AND ur.role IN ('admin', 'super_admin')
    ) THEN
      RAISE EXCEPTION 'insufficient_privileges';
    END IF;
  ELSE
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.employees
  SET role_level = CASE
        WHEN _role IN ('admin', 'super_admin') THEN 'admin'::employee_role_level
        WHEN _role IN ('moderator', 'hr_manager', 'finance_manager') THEN 'manager'::employee_role_level
        ELSE 'employee'::employee_role_level
      END
  WHERE user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_org_member_role(uuid, app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_org_member_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_org_member_role(uuid, app_role) TO authenticated, service_role;