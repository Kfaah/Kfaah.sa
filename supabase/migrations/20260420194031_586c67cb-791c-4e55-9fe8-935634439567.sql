-- منح super_admin صلاحية رؤية كل البيانات في كل الجمعيات

-- employees
DROP POLICY IF EXISTS "Super admin view all employees" ON public.employees;
CREATE POLICY "Super admin view all employees" ON public.employees
  FOR SELECT USING (public.is_super_admin(auth.uid()));

-- tasks
DROP POLICY IF EXISTS "Super admin view all tasks" ON public.tasks;
CREATE POLICY "Super admin view all tasks" ON public.tasks
  FOR SELECT USING (public.is_super_admin(auth.uid()));

-- operational_plans
DROP POLICY IF EXISTS "Super admin view all operational plans" ON public.operational_plans;
CREATE POLICY "Super admin view all operational plans" ON public.operational_plans
  FOR SELECT USING (public.is_super_admin(auth.uid()));

-- operational_plan_months
DROP POLICY IF EXISTS "Super admin view all operational plan months" ON public.operational_plan_months;
CREATE POLICY "Super admin view all operational plan months" ON public.operational_plan_months
  FOR SELECT USING (public.is_super_admin(auth.uid()));

-- executive_plans
DROP POLICY IF EXISTS "Super admin view all executive plans" ON public.executive_plans;
CREATE POLICY "Super admin view all executive plans" ON public.executive_plans
  FOR SELECT USING (public.is_super_admin(auth.uid()));

-- strategic_goals
DROP POLICY IF EXISTS "Super admin view all strategic goals" ON public.strategic_goals;
CREATE POLICY "Super admin view all strategic goals" ON public.strategic_goals
  FOR SELECT USING (public.is_super_admin(auth.uid()));

-- initiatives
DROP POLICY IF EXISTS "Super admin view all initiatives" ON public.initiatives;
CREATE POLICY "Super admin view all initiatives" ON public.initiatives
  FOR SELECT USING (public.is_super_admin(auth.uid()));

-- notifications
DROP POLICY IF EXISTS "Super admin view all notifications" ON public.notifications;
CREATE POLICY "Super admin view all notifications" ON public.notifications
  FOR SELECT USING (public.is_super_admin(auth.uid()));

-- departments
DROP POLICY IF EXISTS "Super admin view all departments" ON public.departments;
CREATE POLICY "Super admin view all departments" ON public.departments
  FOR SELECT USING (public.is_super_admin(auth.uid()));

-- job_roles
DROP POLICY IF EXISTS "Super admin view all job roles" ON public.job_roles;
CREATE POLICY "Super admin view all job roles" ON public.job_roles
  FOR SELECT USING (public.is_super_admin(auth.uid()));

-- operational_plan_custom_columns
DROP POLICY IF EXISTS "Super admin view all custom columns" ON public.operational_plan_custom_columns;
CREATE POLICY "Super admin view all custom columns" ON public.operational_plan_custom_columns
  FOR SELECT USING (public.is_super_admin(auth.uid()));

-- operational_plan_custom_values
DROP POLICY IF EXISTS "Super admin view all custom values" ON public.operational_plan_custom_values;
CREATE POLICY "Super admin view all custom values" ON public.operational_plan_custom_values
  FOR SELECT USING (public.is_super_admin(auth.uid()));

-- تعديل دالة get_user_organization_id: لو super_admin بدون جمعية، رجّع جمعية افتراضية (الأولى)
-- هذا يحلّ صفحات تعتمد على get_user_organization_id() للفلترة الإجبارية
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT organization_id FROM public.user_organizations
     WHERE user_id = _user_id
     ORDER BY is_default DESC, created_at ASC LIMIT 1),
    -- fallback لـ super_admin: أول جمعية نشطة
    CASE WHEN public.is_super_admin(_user_id)
         THEN (SELECT id FROM public.organizations WHERE is_active = true ORDER BY created_at ASC LIMIT 1)
         ELSE NULL
    END
  )
$function$;