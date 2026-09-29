-- Require an explicit organization when changing a member's organization role.
-- The legacy two-argument function remains for compatibility, while the UI
-- uses this overload to avoid choosing an arbitrary employee row for users
-- who belong to more than one organization.

CREATE OR REPLACE FUNCTION public.set_org_member_role(
  _user_id uuid,
  _role public.app_role,
  _org_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_is_super boolean;
BEGIN
  IF _user_id IS NULL OR _org_id IS NULL THEN
    RAISE EXCEPTION 'member_not_found';
  END IF;

  IF public.is_demo_user(auth.uid()) THEN
    RAISE EXCEPTION 'demo_readonly';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.user_id = _user_id
      AND e.organization_id = _org_id
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = _user_id
      AND uo.organization_id = _org_id
      AND uo.approval_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'member_not_found';
  END IF;

  _caller_is_super := public.is_super_admin(auth.uid());

  IF _caller_is_super THEN
    NULL;
  ELSIF public.has_role_in_org(
    auth.uid(),
    'admin'::public.app_role,
    _org_id
  ) THEN
    IF _user_id = auth.uid() THEN
      RAISE EXCEPTION 'insufficient_privileges';
    END IF;

    IF _role IN (
      'admin'::public.app_role,
      'super_admin'::public.app_role
    ) THEN
      RAISE EXCEPTION 'insufficient_privileges';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND (
          ur.role = 'super_admin'::public.app_role
          OR (
            ur.role = 'admin'::public.app_role
            AND ur.organization_id = _org_id
          )
        )
    ) THEN
      RAISE EXCEPTION 'insufficient_privileges';
    END IF;
  ELSE
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _role = 'super_admin'::public.app_role THEN
    IF NOT _caller_is_super THEN
      RAISE EXCEPTION 'insufficient_privileges';
    END IF;

    DELETE FROM public.user_roles
    WHERE user_id = _user_id;

    INSERT INTO public.user_roles (
      user_id,
      role,
      organization_id
    )
    VALUES (
      _user_id,
      'super_admin'::public.app_role,
      NULL
    )
    ON CONFLICT (user_id, role)
    DO UPDATE SET organization_id = NULL;

  ELSIF _role IN (
    'admin'::public.app_role,
    'moderator'::public.app_role,
    'hr_manager'::public.app_role,
    'finance_manager'::public.app_role
  ) THEN
    -- The existing legacy unique constraint is (user_id, role). Do not
    -- silently move the same elevated role from another organization.
    IF EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role = _role
        AND ur.organization_id IS DISTINCT FROM _org_id
    ) THEN
      RAISE EXCEPTION 'role_scoped_elsewhere';
    END IF;

    DELETE FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role <> 'super_admin'::public.app_role;

    INSERT INTO public.user_roles (
      user_id,
      role,
      organization_id
    )
    VALUES (
      _user_id,
      _role,
      _org_id
    )
    ON CONFLICT (user_id, role)
    DO UPDATE SET organization_id = EXCLUDED.organization_id;

  ELSE
    -- Basic roles remain global under the legacy schema. Remove only
    -- organization-scoped elevated roles for the organization being edited,
    -- then replace the user's global basic role without touching elevated
    -- roles held in any other organization.
    DELETE FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role IN (
        'admin'::public.app_role,
        'moderator'::public.app_role,
        'hr_manager'::public.app_role,
        'finance_manager'::public.app_role
      );

    DELETE FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id IS NULL
      AND role NOT IN ('super_admin'::public.app_role);

    INSERT INTO public.user_roles (
      user_id,
      role,
      organization_id
    )
    VALUES (
      _user_id,
      _role,
      NULL
    )
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  UPDATE public.employees
  SET role_level = CASE
        WHEN _role IN (
          'admin'::public.app_role,
          'super_admin'::public.app_role
        ) THEN 'admin'::public.employee_role_level
        WHEN _role IN (
          'moderator'::public.app_role,
          'hr_manager'::public.app_role,
          'finance_manager'::public.app_role
        ) THEN 'manager'::public.employee_role_level
        ELSE 'employee'::public.employee_role_level
      END
  WHERE user_id = _user_id
    AND organization_id = _org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_org_member_role(
  uuid,
  public.app_role,
  uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_org_member_role(
  uuid,
  public.app_role,
  uuid
) TO authenticated, service_role;
