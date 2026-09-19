create or replace function public.store_overview_guard(p_org uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not (public.is_super_admin(auth.uid()) or public.user_belongs_to_org(auth.uid(), p_org)) then
    raise exception 'not allowed';
  end if;
  return true;
end;
$$;

revoke all on function public.store_overview_guard(uuid) from public, anon;
grant execute on function public.store_overview_guard(uuid) to authenticated, service_role;