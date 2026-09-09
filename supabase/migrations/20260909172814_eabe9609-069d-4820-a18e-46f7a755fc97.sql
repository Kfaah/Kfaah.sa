create or replace function public.donations_overview(p_org uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with d as (
    select amount, donation_date, project_name
    from public.donations
    where organization_id = p_org
  )
  select jsonb_build_object(
    'total', coalesce((select sum(amount) from d), 0),
    'count', (select count(*) from d),
    'projects_count', (select count(distinct project_name) from d where project_name is not null),
    'by_year', coalesce((
      select jsonb_agg(jsonb_build_object('year', y, 'total', t) order by y desc)
      from (
        select extract(year from donation_date)::int y, sum(amount) t
        from d group by 1
      ) a
    ), '[]'::jsonb),
    'by_project', coalesce((
      select jsonb_agg(jsonb_build_object('project', p, 'total', t) order by t desc)
      from (
        select coalesce(project_name, 'غير محدد') p, sum(amount) t
        from d group by 1 order by 2 desc limit 12
      ) b
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.donations_overview(uuid) from public, anon;
grant execute on function public.donations_overview(uuid) to authenticated, service_role;