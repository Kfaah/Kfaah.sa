alter function public.store_overview(uuid, date, date) rename to store_overview_data;
revoke all on function public.store_overview_data(uuid, date, date) from public, anon, authenticated;
grant execute on function public.store_overview_data(uuid, date, date) to service_role;

create or replace function public.store_overview(p_org uuid, p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.store_overview_guard(p_org);
  return public.store_overview_data(p_org, p_from, p_to);
end;
$$;

revoke all on function public.store_overview(uuid, date, date) from public, anon;
grant execute on function public.store_overview(uuid, date, date) to authenticated, service_role;