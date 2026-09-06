CREATE OR REPLACE FUNCTION public.admin_can_access_org(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.is_super_admin(auth.uid())
      OR (public.has_role(auth.uid(), 'admin'::public.app_role)
          AND (_org IS NULL OR _org = public.get_user_organization_id(auth.uid())));
$$;

CREATE OR REPLACE FUNCTION public.manager_can_access_org(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.admin_can_access_org(_org)
      OR (public.is_manager(auth.uid())
          AND (_org IS NULL OR _org = public.get_user_organization_id(auth.uid())));
$$;

REVOKE ALL ON FUNCTION public.admin_can_access_org(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.manager_can_access_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_can_access_org(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.manager_can_access_org(uuid) TO authenticated, service_role;