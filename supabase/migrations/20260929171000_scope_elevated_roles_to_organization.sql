-- Scope elevated application roles to the organization they govern.
-- This ports the organization-scoping contract into the Supabase migration
-- history so a clean recovery reproduces the schema represented by types.ts.

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS organization_id uuid
  REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Super admins are platform-wide by definition.
UPDATE public.user_roles
SET organization_id = NULL
WHERE role = 'super_admin'::public.app_role;

-- Deterministically backfill elevated roles. Prefer the employee's actual
-- organization; fall back to the member's default/oldest approved membership.
WITH scoped AS (
  SELECT
    ur.id,
    COALESCE(
      (
        SELECT e.organization_id
        FROM public.employees e
        WHERE e.user_id = ur.user_id
          AND e.organization_id IS NOT NULL
        ORDER BY e.created_at ASC NULLS LAST, e.id ASC
        LIMIT 1
      ),
      (
        SELECT uo.organization_id
        FROM public.user_organizations uo
        WHERE uo.user_id = ur.user_id
          AND uo.approval_status = 'approved'
        ORDER BY uo.is_default DESC, uo.created_at ASC, uo.id ASC
        LIMIT 1
      )
    ) AS organization_id
  FROM public.user_roles ur
  WHERE ur.organization_id IS NULL
    AND ur.role IN (
      'admin'::public.app_role,
      'moderator'::public.app_role,
      'hr_manager'::public.app_role,
      'finance_manager'::public.app_role
    )
)
UPDATE public.user_roles ur
SET organization_id = scoped.organization_id
FROM scoped
WHERE ur.id = scoped.id
  AND scoped.organization_id IS NOT NULL;

-- Do not silently leave a platform-wide elevated role behind.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE organization_id IS NULL
      AND role IN (
        'admin'::public.app_role,
        'moderator'::public.app_role,
        'hr_manager'::public.app_role,
        'finance_manager'::public.app_role
      )
  ) THEN
    RAISE EXCEPTION
      'Cannot scope one or more elevated roles: approved organization membership is missing';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS user_roles_user_org_idx
  ON public.user_roles (user_id, organization_id);

CREATE OR REPLACE FUNCTION public.guard_user_role_org_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN (
    'admin'::public.app_role,
    'moderator'::public.app_role,
    'hr_manager'::public.app_role,
    'finance_manager'::public.app_role
  ) THEN
    IF NEW.organization_id IS NULL THEN
      SELECT COALESCE(
        (
          SELECT e.organization_id
          FROM public.employees e
          WHERE e.user_id = NEW.user_id
            AND e.organization_id IS NOT NULL
          ORDER BY e.created_at ASC NULLS LAST, e.id ASC
          LIMIT 1
        ),
        (
          SELECT uo.organization_id
          FROM public.user_organizations uo
          WHERE uo.user_id = NEW.user_id
            AND uo.approval_status = 'approved'
          ORDER BY uo.is_default DESC, uo.created_at ASC, uo.id ASC
          LIMIT 1
        )
      )
      INTO NEW.organization_id;
    END IF;

    IF NEW.organization_id IS NULL THEN
      RAISE EXCEPTION 'elevated roles require an organization';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.user_organizations uo
      WHERE uo.user_id = NEW.user_id
        AND uo.organization_id = NEW.organization_id
        AND uo.approval_status = 'approved'
    ) THEN
      RAISE EXCEPTION 'member is not approved in that organization';
    END IF;
  ELSIF NEW.role = 'super_admin'::public.app_role THEN
    NEW.organization_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_role_org_scope_trg ON public.user_roles;
CREATE TRIGGER guard_user_role_org_scope_trg
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_user_role_org_scope();

CREATE OR REPLACE FUNCTION public.has_role_in_org(
  _user_id uuid,
  _role public.app_role,
  _org uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _org IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.user_roles ur
       WHERE ur.user_id = _user_id
         AND ur.role = _role
         AND ur.organization_id = _org
     )
     AND EXISTS (
       SELECT 1
       FROM public.user_organizations uo
       WHERE uo.user_id = _user_id
         AND uo.organization_id = _org
         AND uo.approval_status = 'approved'
     );
$$;

CREATE OR REPLACE FUNCTION public.has_any_role_in_org(
  _user_id uuid,
  _roles public.app_role[],
  _org uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _org IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.user_roles ur
       WHERE ur.user_id = _user_id
         AND ur.role = ANY(_roles)
         AND ur.organization_id = _org
     )
     AND EXISTS (
       SELECT 1
       FROM public.user_organizations uo
       WHERE uo.user_id = _user_id
         AND uo.organization_id = _org
         AND uo.approval_status = 'approved'
     );
$$;

CREATE OR REPLACE FUNCTION public.admin_can_access_org(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(auth.uid())
      OR (
        _org IS NOT NULL
        AND public.has_role_in_org(
          auth.uid(),
          'admin'::public.app_role,
          _org
        )
      );
$$;

CREATE OR REPLACE FUNCTION public.manager_can_access_org(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.admin_can_access_org(_org)
      OR (
        _org IS NOT NULL
        AND public.is_user_approved_in_org(auth.uid(), _org)
        AND EXISTS (
          SELECT 1
          FROM public.employees e
          WHERE e.user_id = auth.uid()
            AND e.organization_id = _org
            AND e.role_level IN (
              'manager'::public.employee_role_level,
              'admin'::public.employee_role_level
            )
        )
      );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
      OR public.has_any_role_in_org(
        _user_id,
        ARRAY[
          'admin'::public.app_role,
          'hr_manager'::public.app_role,
          'moderator'::public.app_role
        ],
        _org_id
      );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_user_role(_target_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(auth.uid())
    OR (
      _target_user IS NOT NULL
      AND _target_user <> auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.user_organizations target
        WHERE target.user_id = _target_user
          AND target.approval_status = 'approved'
          AND public.has_role_in_org(
            auth.uid(),
            'admin'::public.app_role,
            target.organization_id
          )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_intelligence_profile(
  _user_id uuid,
  _org_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
      OR public.has_any_role_in_org(
        _user_id,
        ARRAY[
          'admin'::public.app_role,
          'hr_manager'::public.app_role,
          'moderator'::public.app_role
        ],
        _org_id
      );
$$;

-- Keep the member-role UI scoped to the requested organization.
CREATE OR REPLACE FUNCTION public.get_org_member_roles(_org_id uuid DEFAULT NULL)
RETURNS TABLE(
  user_id uuid,
  employee_id uuid,
  full_name text,
  username text,
  job_role text,
  organization_id uuid,
  role_level public.employee_role_level,
  app_roles public.app_role[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target uuid;
BEGIN
  _target := COALESCE(
    _org_id,
    public.get_user_organization_id(auth.uid())
  );

  IF _target IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    public.is_super_admin(auth.uid())
    OR public.has_role_in_org(
      auth.uid(),
      'admin'::public.app_role,
      _target
    )
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    e.user_id,
    e.id,
    e.full_name,
    e.username,
    e.job_role,
    e.organization_id,
    e.role_level,
    COALESCE(
      ARRAY(
        SELECT ur.role
        FROM public.user_roles ur
        WHERE ur.user_id = e.user_id
          AND (
            ur.role = 'super_admin'::public.app_role
            OR ur.organization_id = _target
            OR ur.organization_id IS NULL
          )
        ORDER BY ur.role
      ),
      '{}'::public.app_role[]
    )
  FROM public.employees e
  WHERE e.organization_id = _target
    AND e.user_id IS NOT NULL
  ORDER BY e.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_org_member_role(
  _user_id uuid,
  _role public.app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid;
  _caller_is_super boolean;
BEGIN
  IF public.is_demo_user(auth.uid()) THEN
    RAISE EXCEPTION 'demo_readonly';
  END IF;

  SELECT e.organization_id
  INTO _org
  FROM public.employees e
  WHERE e.user_id = _user_id
  ORDER BY e.created_at ASC NULLS LAST, e.id ASC
  LIMIT 1;

  IF _org IS NULL THEN
    RAISE EXCEPTION 'member_not_found';
  END IF;

  _caller_is_super := public.is_super_admin(auth.uid());

  IF _caller_is_super THEN
    NULL;
  ELSIF public.has_role_in_org(
    auth.uid(),
    'admin'::public.app_role,
    _org
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
            AND ur.organization_id = _org
          )
        )
    ) THEN
      RAISE EXCEPTION 'insufficient_privileges';
    END IF;
  ELSE
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _role = 'super_admin'::public.app_role THEN
    DELETE FROM public.user_roles
    WHERE user_id = _user_id
      AND role <> 'super_admin'::public.app_role;

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
    DELETE FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id = _org
      AND role <> 'super_admin'::public.app_role;

    INSERT INTO public.user_roles (
      user_id,
      role,
      organization_id
    )
    VALUES (
      _user_id,
      _role,
      _org
    )
    ON CONFLICT (user_id, role)
    DO UPDATE SET organization_id = EXCLUDED.organization_id;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id = _org;

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
    AND organization_id = _org;
END;
$$;

-- Tighten membership self-request behavior and admin membership visibility.
DROP POLICY IF EXISTS users_self_request_membership
  ON public.user_organizations;
CREATE POLICY users_self_request_membership
ON public.user_organizations
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND approval_status = 'pending'
  AND approved_by IS NULL
  AND approved_at IS NULL
  AND is_default = false
);

DROP POLICY IF EXISTS "Org admins can view org memberships"
  ON public.user_organizations;
CREATE POLICY "Org admins can view org memberships"
ON public.user_organizations
FOR SELECT
TO authenticated
USING (public.admin_can_access_org(organization_id));

DROP POLICY IF EXISTS "Org admins can update memberships in their org"
  ON public.user_organizations;
CREATE POLICY "Org admins can update memberships in their org"
ON public.user_organizations
FOR UPDATE
TO authenticated
USING (public.admin_can_access_org(organization_id))
WITH CHECK (public.admin_can_access_org(organization_id));

-- Recreate user-role policies so the row's organization cannot be steered to
-- another organization by an administrator who merely shares some membership.
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.can_manage_user_role(user_id)
    AND role <> ALL (
      ARRAY[
        'admin'::public.app_role,
        'super_admin'::public.app_role
      ]
    )
    AND (
      organization_id IS NULL
      OR public.admin_can_access_org(organization_id)
    )
  )
);

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.can_manage_user_role(user_id)
    AND role <> ALL (
      ARRAY[
        'admin'::public.app_role,
        'super_admin'::public.app_role
      ]
    )
    AND (
      organization_id IS NULL
      OR public.admin_can_access_org(organization_id)
    )
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.can_manage_user_role(user_id)
    AND role <> ALL (
      ARRAY[
        'admin'::public.app_role,
        'super_admin'::public.app_role
      ]
    )
    AND (
      organization_id IS NULL
      OR public.admin_can_access_org(organization_id)
    )
  )
);

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.can_manage_user_role(user_id)
    AND role <> ALL (
      ARRAY[
        'admin'::public.app_role,
        'super_admin'::public.app_role
      ]
    )
    AND (
      organization_id IS NULL
      OR public.admin_can_access_org(organization_id)
    )
  )
);

REVOKE ALL ON FUNCTION public.guard_user_role_org_scope() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role_in_org(uuid, public.app_role, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_any_role_in_org(uuid, public.app_role[], uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_can_access_org(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.manager_can_access_org(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_org_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_user_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_intelligence_profile(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_org_member_roles(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_org_member_role(uuid, public.app_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role_in_org(uuid, public.app_role, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_role_in_org(uuid, public.app_role[], uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_can_access_org(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.manager_can_access_org(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_user_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_intelligence_profile(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_org_member_roles(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_org_member_role(uuid, public.app_role) TO authenticated, service_role;
