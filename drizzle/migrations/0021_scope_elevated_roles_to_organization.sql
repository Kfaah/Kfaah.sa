-- 1) Make elevated roles organization-scoped
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill elevated roles with the member's single approved organization
UPDATE public.user_roles ur
SET organization_id = uo.organization_id
FROM public.user_organizations uo
WHERE ur.organization_id IS NULL
  AND ur.role IN ('admin','hr_manager','moderator','finance_manager')
  AND uo.user_id = ur.user_id
  AND uo.approval_status = 'approved';

CREATE INDEX IF NOT EXISTS user_roles_user_org_idx ON public.user_roles (user_id, organization_id);

-- 2) Guard role rows: elevated roles must be bound to an organization
CREATE OR REPLACE FUNCTION public.guard_user_role_org_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('admin','hr_manager','moderator','finance_manager') THEN
    IF NEW.organization_id IS NULL THEN
      -- bind to the target member's approved organization when unambiguous
      SELECT uo.organization_id INTO NEW.organization_id
      FROM public.user_organizations uo
      WHERE uo.user_id = NEW.user_id
        AND uo.approval_status = 'approved'
      ORDER BY uo.created_at ASC
      LIMIT 1;
    END IF;
    IF NEW.organization_id IS NULL THEN
      RAISE EXCEPTION 'elevated roles require an organization';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.user_id = NEW.user_id
        AND uo.organization_id = NEW.organization_id
        AND uo.approval_status = 'approved'
    ) THEN
      RAISE EXCEPTION 'member is not approved in that organization';
    END IF;
  ELSIF NEW.role = 'super_admin' THEN
    NEW.organization_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_role_org_scope_trg ON public.user_roles;
CREATE TRIGGER guard_user_role_org_scope_trg
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_user_role_org_scope();

-- 3) Organization-scoped role check
CREATE OR REPLACE FUNCTION public.has_role_in_org(_user_id uuid, _role app_role, _org uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _org IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = _user_id
         AND ur.role = _role
         AND ur.organization_id = _org
     )
     AND EXISTS (
       SELECT 1 FROM public.user_organizations uo
       WHERE uo.user_id = _user_id
         AND uo.organization_id = _org
         AND uo.approval_status = 'approved'
     );
$$;

CREATE OR REPLACE FUNCTION public.has_any_role_in_org(_user_id uuid, _roles app_role[], _org uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _org IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = _user_id
         AND ur.role = ANY(_roles)
         AND ur.organization_id = _org
     )
     AND EXISTS (
       SELECT 1 FROM public.user_organizations uo
       WHERE uo.user_id = _user_id
         AND uo.organization_id = _org
         AND uo.approval_status = 'approved'
     );
$$;

-- 4) Re-derive org access strictly from approved membership + org-scoped role
CREATE OR REPLACE FUNCTION public.admin_can_access_org(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.is_super_admin(auth.uid())
      OR (_org IS NOT NULL AND public.has_role_in_org(auth.uid(), 'admin'::public.app_role, _org));
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
      OR public.has_any_role_in_org(_user_id, ARRAY['admin','hr_manager','moderator']::public.app_role[], _org_id);
$$;

CREATE OR REPLACE FUNCTION public.manager_can_access_org(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.admin_can_access_org(_org)
      OR (_org IS NOT NULL
          AND public.is_manager(auth.uid())
          AND public.is_user_approved_in_org(auth.uid(), _org));
$$;

CREATE OR REPLACE FUNCTION public.can_manage_user_role(_target_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
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
          AND public.has_role_in_org(auth.uid(), 'admin'::public.app_role, target.organization_id)
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_intelligence_profile(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
      OR public.has_any_role_in_org(_user_id, ARRAY['admin','hr_manager','moderator']::public.app_role[], _org_id);
$$;

-- 5) Stop users from steering their own "default" organization
DROP POLICY IF EXISTS users_self_request_membership ON public.user_organizations;
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

DROP POLICY IF EXISTS "Org admins can view org memberships" ON public.user_organizations;
CREATE POLICY "Org admins can view org memberships"
ON public.user_organizations
FOR SELECT
TO authenticated
USING (public.admin_can_access_org(organization_id));

DROP POLICY IF EXISTS "Org admins can update memberships in their org" ON public.user_organizations;
CREATE POLICY "Org admins can update memberships in their org"
ON public.user_organizations
FOR UPDATE
TO authenticated
USING (public.admin_can_access_org(organization_id))
WITH CHECK (public.admin_can_access_org(organization_id));