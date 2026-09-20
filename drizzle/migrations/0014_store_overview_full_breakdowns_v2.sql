CREATE OR REPLACE FUNCTION public.store_overview_data(p_org uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with dkey as (
  select
    d.amount, d.project_name, d.donation_date, d.payment_method, d.source, d.status,
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
         count(*) cnt, coalesce(sum(amount),0) total,
         max(donation_date) last_at, min(donation_date) first_at
  from dkey group by 1
),
donor_bands as (
  select case
           when total >= 5000 then 'كبار (5000+ ر.س)'
           when total >= 1000 then 'متوسط مرتفع (1000–4999)'
           when total >= 300 then 'متوسط (300–999)'
           when total >= 100 then 'صغير (100–299)'
           else 'أقل من 100'
         end band,
         count(*) cnt, coalesce(sum(total),0) total, round(avg(cnt)::numeric,2) avg_freq
  from donors group by 1
),
donor_recency as (
  select case
           when last_at >= now() - interval '30 days' then 'نشط (آخر 30 يوماً)'
           when last_at >= now() - interval '90 days' then 'فاتر (31–90 يوماً)'
           when last_at >= now() - interval '180 days' then 'خامل (91–180 يوماً)'
           else 'منقطع (أكثر من 180 يوماً)'
         end bucket,
         count(*) cnt, coalesce(sum(total),0) total
  from donors where last_at is not null group by 1
),
donor_freq as (
  select case when cnt = 1 then 'مرة واحدة' when cnt between 2 and 3 then '2–3 مرات'
              when cnt between 4 and 9 then '4–9 مرات' else '10+ مرات' end bucket,
         count(*) cnt, coalesce(sum(total),0) total
  from donors group by 1
),
amount_bands as (
  select case when amount < 50 then 'أقل من 50' when amount < 100 then '50–99'
              when amount < 300 then '100–299' when amount < 1000 then '300–999'
              else '1000+' end band,
         count(*) cnt, coalesce(sum(amount),0) total
  from dkey group by 1
),
pay as (
  select coalesce(nullif(btrim(payment_method),''),'غير محدد') name, count(*) cnt, coalesce(sum(amount),0) total
  from dkey group by 1 order by 3 desc limit 12
),
srcs as (
  select coalesce(nullif(btrim(source),''),'غير محدد') name, count(*) cnt, coalesce(sum(amount),0) total
  from dkey group by 1 order by 3 desc limit 12
),
dstat as (
  select coalesce(nullif(btrim(status),''),'غير محدد') name, count(*) cnt, coalesce(sum(amount),0) total
  from dkey group by 1 order by 2 desc limit 10
),
projects as (
  select coalesce(project_name,'غير محدد') name, count(*) cnt, coalesce(sum(amount),0) total
  from dkey group by 1 order by 3 desc limit 25
),
monthly as (
  select to_char(donation_date,'YYYY-MM') m, count(*) cnt, coalesce(sum(amount),0) total,
         count(distinct dk) dn
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
gift_rows as (
  select g.* from public.gifts g
  where g.organization_id = p_org
    and (p_from is null or g.gift_date >= p_from) and (p_to is null or g.gift_date <= p_to)
),
cart_rows as (
  select c.* from public.abandoned_carts c
  where c.organization_id = p_org
    and (p_from is null or c.abandoned_at >= p_from::timestamptz)
    and (p_to is null or c.abandoned_at < (p_to + 1)::timestamptz)
),
sub_rows as (
  select s.* from public.subscriptions s
  where s.organization_id = p_org
    and (p_from is null or s.start_date >= p_from) and (p_to is null or s.start_date <= p_to)
),
camp_rows as (
  select c.* from public.campaigns c
  where c.organization_id = p_org
    and (p_from is null or c.start_date >= p_from) and (p_to is null or c.start_date <= p_to)
),
fd_rows as (
  select f.* from public.failed_donations f
  where f.organization_id = p_org
    and (p_from is null or f.attempted_at >= p_from::timestamptz)
    and (p_to is null or f.attempted_at < (p_to + 1)::timestamptz)
),
reach as (
  select count(distinct k) n from (
    select dk k from dkey where dk is not null
    union
    select case
      when length(regexp_replace(coalesce(giver_phone,''),'[^0-9]','','g')) >= 9
        then right(regexp_replace(giver_phone,'[^0-9]','','g'), 9)
      when btrim(coalesce(giver_name,'')) <> '' then 'nm:'||lower(btrim(giver_name))
      else null end
    from gift_rows
    union
    select case
      when length(regexp_replace(coalesce(donor_phone,''),'[^0-9]','','g')) >= 9
        then right(regexp_replace(donor_phone,'[^0-9]','','g'), 9)
      when btrim(coalesce(donor_name,'')) <> '' then 'nm:'||lower(btrim(donor_name))
      else null end
    from sub_rows
    union
    select case
      when length(regexp_replace(coalesce(donor_phone,''),'[^0-9]','','g')) >= 9
        then right(regexp_replace(donor_phone,'[^0-9]','','g'), 9)
      when btrim(coalesce(donor_name,'')) <> '' then 'nm:'||lower(btrim(donor_name))
      else null end
    from cart_rows
  ) u where k is not null
),
camp as (
  select count(*) cnt, coalesce(sum(goal_amount),0) goal, coalesce(sum(collected_amount),0) collected
  from camp_rows
),
camp_status as (
  select coalesce(nullif(btrim(status),''),'غير محدد') name, count(*) cnt,
         coalesce(sum(goal_amount),0) goal, coalesce(sum(collected_amount),0) collected
  from camp_rows group by 1 order by 2 desc limit 10
),
top_camp as (
  select name, coalesce(goal_amount,0) goal, coalesce(collected_amount,0) collected, status
  from camp_rows order by coalesce(collected_amount,0) desc limit 15
),
fd as (
  select count(*) cnt, coalesce(sum(amount),0) total from fd_rows
),
fd_reasons as (
  select coalesce(failure_reason,'غير محدد') reason, count(*) cnt, coalesce(sum(amount),0) total
  from fd_rows group by 1 order by 2 desc limit 10
),
carts as (
  select count(*) cnt, coalesce(sum(amount),0) total, count(*) filter (where recovered) rec,
         coalesce(avg(amount),0) avg_amount
  from cart_rows
),
carts_status as (
  select coalesce(nullif(btrim(follow_up_status),''),'بلا متابعة') name, count(*) cnt, coalesce(sum(amount),0) total
  from cart_rows group by 1 order by 2 desc limit 10
),
carts_projects as (
  select coalesce(nullif(btrim(project_name),''),'غير محدد') name, count(*) cnt, coalesce(sum(amount),0) total
  from cart_rows group by 1 order by 3 desc limit 10
),
carts_monthly as (
  select to_char(abandoned_at at time zone 'UTC' at time zone 'Asia/Riyadh','YYYY-MM') m,
         count(*) cnt, coalesce(sum(amount),0) total
  from cart_rows where abandoned_at is not null group by 1 order by 1
),
subs as (
  select count(*) cnt,
         count(*) filter (where status = 'active') active,
         coalesce(sum(amount) filter (where status = 'active'),0) monthly,
         coalesce(avg(amount),0) avg_amount
  from sub_rows
),
subs_status as (
  select coalesce(nullif(btrim(status),''),'غير محدد') name, count(*) cnt, coalesce(sum(amount),0) total
  from sub_rows group by 1 order by 2 desc limit 10
),
subs_projects as (
  select coalesce(nullif(btrim(project_name),''),'غير محدد') name, count(*) cnt, coalesce(sum(amount),0) total
  from sub_rows group by 1 order by 3 desc limit 10
),
subs_cancel as (
  select coalesce(nullif(btrim(cancellation_reason),''),'غير مذكور') reason, count(*) cnt
  from sub_rows where status is distinct from 'active' group by 1 order by 2 desc limit 8
),
gifts as (
  select count(*) cnt, coalesce(sum(amount),0) total,
         count(*) filter (where delivery_status = 'delivered') delivered,
         coalesce(avg(amount),0) avg_amount,
         count(distinct case
           when length(regexp_replace(coalesce(giver_phone,''),'[^0-9]','','g')) >= 9
             then right(regexp_replace(giver_phone,'[^0-9]','','g'), 9)
           else nullif(lower(btrim(coalesce(giver_name,''))),'') end) givers
  from gift_rows
),
gifts_occasions as (
  select coalesce(nullif(btrim(occasion),''),'غير محدد') name, count(*) cnt, coalesce(sum(amount),0) total
  from gift_rows group by 1 order by 2 desc limit 12
),
gifts_projects as (
  select coalesce(nullif(btrim(project_name),''),'غير محدد') name, count(*) cnt, coalesce(sum(amount),0) total
  from gift_rows group by 1 order by 3 desc limit 12
),
gifts_monthly as (
  select to_char(gift_date,'YYYY-MM') m, count(*) cnt, coalesce(sum(amount),0) total
  from gift_rows where gift_date is not null group by 1 order by 1
),
gifts_status as (
  select coalesce(nullif(btrim(delivery_status),''),'غير محدد') name, count(*) cnt
  from gift_rows group by 1 order by 2 desc limit 8
),
gifts_hourly as (
  select extract(hour from (gift_date at time zone 'UTC' at time zone 'Asia/Riyadh'))::int h,
         count(*) cnt, coalesce(sum(amount),0) total
  from gift_rows where gift_date is not null group by 1 order by 2 desc limit 6
),
top_givers as (
  select coalesce(nullif(btrim(giver_name),''),'—') nm, max(giver_phone) ph,
         count(*) cnt, coalesce(sum(amount),0) total
  from gift_rows group by 1 order by 4 desc limit 10
),
crm as (
  select count(*) cnt,
         count(*) filter (where coalesce(donations_count,0) > 1) repeat_cnt,
         coalesce(sum(total_donated),0) total
  from public.donors where organization_id = p_org
),
crm_segments as (
  select coalesce(nullif(btrim(segment),''),'غير مصنّف') name, count(*) cnt, coalesce(sum(total_donated),0) total
  from public.donors where organization_id = p_org group by 1 order by 2 desc limit 12
),
crm_cities as (
  select coalesce(nullif(btrim(city),''),'غير محدد') name, count(*) cnt, coalesce(sum(total_donated),0) total
  from public.donors where organization_id = p_org group by 1 order by 2 desc limit 12
),
crm_gender as (
  select coalesce(nullif(btrim(gender),''),'غير محدد') name, count(*) cnt, coalesce(sum(total_donated),0) total
  from public.donors where organization_id = p_org group by 1 order by 2 desc limit 6
),
coverage as (
  select
    (select count(*) from public.donors where organization_id = p_org and nullif(btrim(coalesce(phone,'')),'') is not null) donors_with_phone,
    (select count(*) from public.donors where organization_id = p_org and nullif(btrim(coalesce(email,'')),'') is not null) donors_with_email,
    (select count(*) from public.donors where organization_id = p_org and nullif(btrim(coalesce(city,'')),'') is not null) donors_with_city,
    (select count(*) from dkey where nullif(btrim(coalesce(donor_phone,'')),'') is null) donations_without_phone
)
select
jsonb_build_object(
  'donations_count', (select c from tot),
  'donations_total', (select t from tot),
  'unique_donors', (select count(*) from donors),
  'repeat_donors', (select count(*) from donors where cnt > 1),
  'one_time_donors', (select count(*) from donors where cnt = 1),
  'reach_donors', (select n from reach),
  'top_projects', coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',cnt,'total',total)) from projects),'[]'::jsonb),
  'monthly', coalesce((select jsonb_agg(jsonb_build_object('month',m,'count',cnt,'total',total,'donors',dn)) from monthly),'[]'::jsonb),
  'hourly', coalesce((select jsonb_agg(jsonb_build_object('hour',h,'count',cnt,'total',total)) from hourly),'[]'::jsonb),
  'weekday', coalesce((select jsonb_agg(jsonb_build_object('dow',dw,'count',cnt,'total',total)) from weekday),'[]'::jsonb),
  'top_donors', coalesce((select jsonb_agg(jsonb_build_object('name',nm,'phone',ph,'count',cnt,'total',total)) from (select * from donors order by total desc limit 20) x),'[]'::jsonb),
  'payment_methods', coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',cnt,'total',total)) from pay),'[]'::jsonb),
  'donation_sources', coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',cnt,'total',total)) from srcs),'[]'::jsonb),
  'donation_statuses', coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',cnt,'total',total)) from dstat),'[]'::jsonb),
  'amount_bands', coalesce((select jsonb_agg(jsonb_build_object('band',band,'count',cnt,'total',total)) from amount_bands),'[]'::jsonb),
  'donor_value_bands', coalesce((select jsonb_agg(jsonb_build_object('band',band,'donors',cnt,'total',total,'avg_frequency',avg_freq)) from donor_bands),'[]'::jsonb),
  'donor_recency', coalesce((select jsonb_agg(jsonb_build_object('bucket',bucket,'donors',cnt,'total',total)) from donor_recency),'[]'::jsonb),
  'donor_frequency', coalesce((select jsonb_agg(jsonb_build_object('bucket',bucket,'donors',cnt,'total',total)) from donor_freq),'[]'::jsonb)
)
||
jsonb_build_object(
  'campaigns_count', (select cnt from camp),
  'campaigns_goal', (select goal from camp),
  'campaigns_collected', (select collected from camp),
  'top_campaigns', coalesce((select jsonb_agg(jsonb_build_object('name',name,'goal',goal,'collected',collected,'status',status)) from top_camp),'[]'::jsonb),
  'campaigns_by_status', coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',cnt,'goal',goal,'collected',collected)) from camp_status),'[]'::jsonb),
  'failed_count', (select cnt from fd),
  'failed_total', (select total from fd),
  'fail_reasons', coalesce((select jsonb_agg(jsonb_build_object('reason',reason,'count',cnt,'total',total)) from fd_reasons),'[]'::jsonb),
  'carts_count', (select cnt from carts),
  'carts_total', (select total from carts),
  'carts_recovered', (select rec from carts),
  'carts_avg', (select round(avg_amount::numeric,2) from carts),
  'carts_by_status', coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',cnt,'total',total)) from carts_status),'[]'::jsonb),
  'carts_projects', coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',cnt,'total',total)) from carts_projects),'[]'::jsonb),
  'carts_monthly', coalesce((select jsonb_agg(jsonb_build_object('month',m,'count',cnt,'total',total)) from carts_monthly),'[]'::jsonb),
  'subs_count', (select cnt from subs),
  'subs_active', (select active from subs),
  'subs_monthly', (select monthly from subs),
  'subs_avg', (select round(avg_amount::numeric,2) from subs),
  'subs_by_status', coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',cnt,'total',total)) from subs_status),'[]'::jsonb),
  'subs_projects', coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',cnt,'total',total)) from subs_projects),'[]'::jsonb),
  'subs_cancel_reasons', coalesce((select jsonb_agg(jsonb_build_object('reason',reason,'count',cnt)) from subs_cancel),'[]'::jsonb)
)
||
jsonb_build_object(
  'gifts_count', (select cnt from gifts),
  'gifts_total', (select total from gifts),
  'gifts_delivered', (select delivered from gifts),
  'gifts_avg', (select round(avg_amount::numeric,2) from gifts),
  'gifts_givers', (select givers from gifts),
  'gifts_occasions', coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',cnt,'total',total)) from gifts_occasions),'[]'::jsonb),
  'gifts_projects', coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',cnt,'total',total)) from gifts_projects),'[]'::jsonb),
  'gifts_monthly', coalesce((select jsonb_agg(jsonb_build_object('month',m,'count',cnt,'total',total)) from gifts_monthly),'[]'::jsonb),
  'gifts_statuses', coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',cnt)) from gifts_status),'[]'::jsonb),
  'gifts_hourly', coalesce((select jsonb_agg(jsonb_build_object('hour',h,'count',cnt,'total',total)) from gifts_hourly),'[]'::jsonb),
  'top_givers', coalesce((select jsonb_agg(jsonb_build_object('name',nm,'phone',ph,'count',cnt,'total',total)) from top_givers),'[]'::jsonb),
  'crm_donors_count', (select cnt from crm),
  'crm_repeat_donors', (select repeat_cnt from crm),
  'crm_total_donated', (select total from crm),
  'crm_segments', coalesce((select jsonb_agg(jsonb_build_object('name',name,'donors',cnt,'total',total)) from crm_segments),'[]'::jsonb),
  'crm_cities', coalesce((select jsonb_agg(jsonb_build_object('name',name,'donors',cnt,'total',total)) from crm_cities),'[]'::jsonb),
  'crm_gender', coalesce((select jsonb_agg(jsonb_build_object('name',name,'donors',cnt,'total',total)) from crm_gender),'[]'::jsonb),
  'data_coverage', (select to_jsonb(c) from coverage c)
)
$function$;

REVOKE ALL ON FUNCTION public.store_overview_data(uuid, date, date) FROM public;
REVOKE ALL ON FUNCTION public.store_overview_data(uuid, date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.store_overview_data(uuid, date, date) TO authenticated, service_role;