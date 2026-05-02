REVOKE EXECUTE ON FUNCTION public.get_org_membership_requests(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.review_membership_request(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_org_membership_requests(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_membership_request(uuid, text) TO authenticated;