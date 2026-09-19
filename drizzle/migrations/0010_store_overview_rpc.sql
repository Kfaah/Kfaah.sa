create or replace function public.store_overview(p_org uuid, p_from date default null, p_to date default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with dkey as (
  select
    d.amount, d.project_name, d.donation_date,
    d.donor_name, d.donor_phone,
    case
      when length(regexp_replace(coalesce(d.donor_phone,''),'[^0-9]','','g')) >= 9
        then right(regexp_replace(d.donor_phone,'[^0-9]','','g'), 9)
      when btrim(coalesce(d.donor_name,'')) <> '' then 'nm:'||lower(btrim(d.donor_name))
      else null
    end as dk
  from public.donations d
  where d.organization_id = p_org
    and (p_from is null or d.donation_date >= p_from)
    and (p_to is null or d.donation_date <= p_to)
),
tot as (
  select count(*)::bigint c, coalesce(sum(amount),0) t from dkey
),
donors as (
  select coalesce(dk,'—') k,
         max(donor_name) nm, max(donor_phone) ph,
         count(*) cnt, coalesce(sum(amount),0) total
  from dkey group by 1
),
projects as (
  select coalesce(project_name,'غير محدد') name, count(*) cnt, coalesce(sum(amount),0) total
  from dkey group by 1 order by 3 desc limit 10
),
monthly as (
  select to_char(donation_date,'YYYY-MM') m, count(*) cnt, coalesce(sum(amount),0) total
  from dkey where donation_date is not null group by 1 order by 1
),
hourly as (
  select extract(hour from (donation_date at time zone 'UTC' at time zone 'Asia/Riyadh'))::int h,
         count(*) cnt, coalesce(sum(amount),0) total
  from dkey where donation_date is not null group by 1 order by 2 desc
),
weekday as (
  select extract(dow from (donation_date at time zone 'UTC' at time zone 'Asia/Riyadh'))::int dw,
         count(*) cnt, coalesce(sum(amount),0) total
  from dkey where donation_date is not null group by 1 order by 2 desc
),
reach as (
  select count(distinct k) n from (
    select dk k from dkey where dk is not null
    union
    select case
      when length(regexp_replace(coalesce(g.giver_phone,''),'[^0-9]','','g')) >= 9
        then right(regexp_replace(g.giver_phone,'[^0-9]','','g'), 9)
      when btrim(coalesce(g.giver_name,'')) <> '' then 'nm:'||lower(btrim(g.giver_name))
      else null end
    from public.gifts g
    where g.organization_id = p_org
      and (p_from is null or g.gift_date >= p_from) and (p_to is null or g.gift_date <= p_to)
    union
    select case
      when length(regexp_replace(coalesce(s.donor_phone,''),'[^0-9]','','g')) >= 9
        then right(regexp_replace(s.donor_phone,'[^0-9]','','g'), 9)
      when btrim(coalesce(s.donor_name,'')) <> '' then 'nm:'||lower(btrim(s.donor_name))
      else null end
    from public.subscriptions s
    where s.organization_id = p_org
      and (p_from is null or s.start_date >= p_from) and (p_to is null or s.start_date <= p_to)
    union
    select case
      when length(regexp_replace(coalesce(c.donor_phone,''),'[^0-9]','','g')) >= 9
        then right(regexp_replace(c.donor_phone,'[^0-9]','','g'), 9)
      when btrim(coalesce(c.donor_name,'')) <> '' then 'nm:'||lower(btrim(c.donor_name))
      else null end
    from public.abandoned_carts c
    where c.organization_id = p_org
      and (p_from is null or c.abandoned_at >= p_from::timestamptz)
      and (p_to is null or c.abandoned_at < (p_to + 1)::timestamptz)
  ) u where k is not null
),
camp as (
  select count(*) cnt, coalesce(sum(goal_amount),0) goal, coalesce(sum(collected_amount),0) collected
  from public.campaigns
  where organization_id = p_org
    and (p_from is null or start_date >= p_from) and (p_to is null or start_date <= p_to)
),
top_camp as (
  select name, coalesce(goal_amount,0) goal, coalesce(collected_amount,0) collected, status
  from public.campaigns
  where organization_id = p_org
    and (p_from is null or start_date >= p_from) and (p_to is null or start_date <= p_to)
  order by coalesce(collected_amount,0) desc limit 10
),
fd as (
  select count(*) cnt, coalesce(sum(amount),0) total
  from public.failed_donations
  where organization_id = p_org
    and (p_from is null or attempted_at >= p_from::timestamptz)
    and (p_to is null or attempted_at < (p_to + 1)::timestamptz)
),
fd_reasons as (
  select coalesce(failure_reason,'غير محدد') reason, count(*) cnt, coalesce(sum(amount),0) total
  from public.failed_donations
  where organization_id = p_org
    and (p_from is null or attempted_at >= p_from::timestamptz)
    and (p_to is null or attempted_at < (p_to + 1)::timestamptz)
  group by 1 order by 2 desc limit 8
),
carts as (
  select count(*) cnt, coalesce(sum(amount),0) total, count(*) filter (where recovered) rec
  from public.abandoned_carts
  where organization_id = p_org
    and (p_from is null or abandoned_at >= p_from::timestamptz)
    and (p_to is null or abandoned_at < (p_to + 1)::timestamptz)
),
subs as (
  select count(*) cnt,
         count(*) filter (where status = 'active') active,
         coalesce(sum(amount) filter (where status = 'active'),0) monthly
  from public.subscriptions
  where organization_id = p_org
    and (p_from is null or start_date >= p_from) and (p_to is null or start_date <= p_to)
),
gifts as (
  select count(*) cnt, coalesce(sum(amount),0) total,
         count(*) filter (where delivery_status = 'delivered') delivered
  from public.gifts
  where organization_id = p_org
    and (p_from is null or gift_date >= p_from) and (p_to is null or gift_date <= p_to)
)
select jsonb_build_object(
  'donations_count', (select c from tot),
  'donations_total', (select t from tot),
  'unique_donors', (select count(*) from donors),
  'repeat_donors', (select count(*) from donors where cnt > 1),
  'one_time_donors', (select count(*) from donors where cnt = 1),
  'reach_donors', (select n from reach),
  'top_projects', coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',cnt,'total',total)) from projects),'[]'::jsonb),
  'monthly', coalesce((select jsonb_agg(jsonb_build_object('month',m,'count',cnt,'total',total)) from monthly),'[]'::jsonb),
  'hourly', coalesce((select jsonb_agg(jsonb_build_object('hour',h,'count',cnt,'total',total)) from hourly),'[]'::jsonb),
  'weekday', coalesce((select jsonb_agg(jsonb_build_object('dow',dw,'count',cnt,'total',total)) from weekday),'[]'::jsonb),
  'top_donors', coalesce((select jsonb_agg(jsonb_build_object('name',nm,'phone',ph,'count',cnt,'total',total)) from (select * from donors order by total desc limit 10) x),'[]'::jsonb),
  'campaigns_count', (select cnt from camp),
  'campaigns_goal', (select goal from camp),
  'campaigns_collected', (select collected from camp),
  'top_campaigns', coalesce((select jsonb_agg(jsonb_build_object('name',name,'goal',goal,'collected',collected,'status',status)) from top_camp),'[]'::jsonb),
  'failed_count', (select cnt from fd),
  'failed_total', (select total from fd),
  'fail_reasons', coalesce((select jsonb_agg(jsonb_build_object('reason',reason,'count',cnt,'total',total)) from fd_reasons),'[]'::jsonb),
  'carts_count', (select cnt from carts),
  'carts_total', (select total from carts),
  'carts_recovered', (select rec from carts),
  'subs_count', (select cnt from subs),
  'subs_active', (select active from subs),
  'subs_monthly', (select monthly from subs),
  'gifts_count', (select cnt from gifts),
  'gifts_total', (select total from gifts),
  'gifts_delivered', (select delivered from gifts)
)
$$;

revoke all on function public.store_overview(uuid, date, date) from public, anon;
grant execute on function public.store_overview(uuid, date, date) to authenticated, service_role;