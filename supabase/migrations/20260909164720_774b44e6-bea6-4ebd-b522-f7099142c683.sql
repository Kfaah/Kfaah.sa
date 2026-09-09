CREATE OR REPLACE FUNCTION public.set_org_member_role(_user_id uuid, _role app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- Org admins may never change their own role assignment.
    IF _user_id = auth.uid() THEN
      RAISE EXCEPTION 'insufficient_privileges';
    END IF;
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
$function$;