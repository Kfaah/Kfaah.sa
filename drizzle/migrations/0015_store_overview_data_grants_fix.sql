GRANT EXECUTE ON FUNCTION public.store_overview_data(uuid, date, date) TO postgres;
GRANT EXECUTE ON FUNCTION public.store_overview_data(uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_overview(uuid, date, date) TO authenticated, service_role, postgres;