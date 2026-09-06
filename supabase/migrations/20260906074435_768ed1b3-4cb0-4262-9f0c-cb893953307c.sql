
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- Public (unauthenticated) organization landing/login needs
GRANT EXECUTE ON FUNCTION public.get_organization_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_branding(uuid) TO anon, authenticated;

-- Signed-in app usage
GRANT EXECUTE ON FUNCTION public.ensure_org_finance_defaults(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subordinate_employee_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subordinate_user_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_account_email(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_organization_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_demo_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_viewer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_org(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_organization_by_slug(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_membership_requests(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_membership_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_direct_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversations_for_user(uuid) TO authenticated;
