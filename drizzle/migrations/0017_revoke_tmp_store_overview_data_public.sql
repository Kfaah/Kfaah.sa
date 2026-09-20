REVOKE ALL ON FUNCTION public.store_overview_data(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_overview_data(uuid, date, date) TO authenticated, service_role, postgres;