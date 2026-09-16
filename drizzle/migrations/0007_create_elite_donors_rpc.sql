create or replace function public.elite_donors(p_org uuid)
returns table(
  pkey text,
  name text,
  phone text,
  activities text[],
  donations_count bigint,
  donations_total numeric,
  subs_count bigint,
  gifts_count bigint,
  campaigns_count bigint,
  abandoned_count bigint,
  projects_count bigint,
  last_activity timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
with base as (
  select 'donations'::text src,
         coalesce(nullif(right(regexp_replace(coalesce(donor_phone,''),'\D','','g'),9),''), 'nm:'||lower(btrim(coalesce(donor_name,'')))) k,
         donor_name nm, donor_phone ph, project_name pj, amount amt, donation_date dt
  from donations where organization_id = p_org
  union all
  select 'gifts',
         coalesce(nullif(right(regexp_replace(coalesce(giver_phone,''),'\D','','g'),9),''), 'nm:'||lower(btrim(coalesce(giver_name,'')))),
         giver_name, giver_phone, project_name, 0, gift_date
  from gifts where organization_id = p_org
  union all
  select 'subscriptions',
         coalesce(nullif(right(regexp_replace(coalesce(donor_phone,''),'\D','','g'),9),''), 'nm:'||lower(btrim(coalesce(donor_name,'')))),
         donor_name, donor_phone, project_name, 0, coalesce(created_at, start_date::timestamptz)
  from subscriptions where organization_id = p_org
  union all
  select 'abandoned',
         coalesce(nullif(right(regexp_replace(coalesce(donor_phone,''),'\D','','g'),9),''), 'nm:'||lower(btrim(coalesce(donor_name,'')))),
         donor_name, donor_phone, project_name, 0, abandoned_at
  from abandoned_carts where organization_id = p_org
),
f as (select * from base where k is not null and k <> '' and k <> 'nm:')
select
  k,
  (array_agg(nm order by (nm is null), length(coalesce(nm,'')) desc))[1],
  (array_agg(ph order by (ph is null)))[1],
  array_agg(distinct src),
  count(*) filter (where src='donations'),
  coalesce(sum(amt) filter (where src='donations'), 0),
  count(*) filter (where src='subscriptions'),
  count(*) filter (where src='gifts'),
  0::bigint,
  count(*) filter (where src='abandoned'),
  count(distinct pj),
  max(dt)
from f
group by k
having count(distinct src) >= 2
order by count(distinct src) desc, coalesce(sum(amt) filter (where src='donations'),0) desc
limit 3000;
$$;

revoke all on function public.elite_donors(uuid) from public, anon;
grant execute on function public.elite_donors(uuid) to authenticated, service_role;