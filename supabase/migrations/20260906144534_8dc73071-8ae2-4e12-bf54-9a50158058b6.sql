REVOKE ALL ON FUNCTION public.admin_can_access_org(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.manager_can_access_org(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_can_access_org(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.manager_can_access_org(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_can_access_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_can_access_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_can_access_org(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.manager_can_access_org(uuid) TO service_role;