-- حذف الخطة التشغيلية "تفعيل المتطوعين" وكل ما يرتبط بها
WITH target AS (
  SELECT id FROM public.operational_plans
  WHERE organization_id = 'a8a8aa31-3247-4cbe-b9e3-489e066fc941'
    AND plan_name = 'تفعيل المتطوعين'
),
target_months AS (
  SELECT id FROM public.operational_plan_months
  WHERE operational_plan_id IN (SELECT id FROM target)
),
target_execs AS (
  SELECT id FROM public.executive_plans
  WHERE operational_plan_month_id IN (SELECT id FROM target_months)
),
del_tasks AS (
  DELETE FROM public.tasks WHERE executive_plan_id IN (SELECT id FROM target_execs) RETURNING 1
),
del_execs AS (
  DELETE FROM public.executive_plans WHERE id IN (SELECT id FROM target_execs) RETURNING 1
),
del_months AS (
  DELETE FROM public.operational_plan_months WHERE id IN (SELECT id FROM target_months) RETURNING 1
)
DELETE FROM public.operational_plans WHERE id IN (SELECT id FROM target);