REVOKE ALL ON FUNCTION public.can_manage_user_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_user_role(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_manage_user_role(uuid) TO authenticated, service_role;