
-- Helpers: org-scoped admin / manager checks
CREATE OR REPLACE FUNCTION public.admin_can_access_org(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(auth.uid())
      OR (public.has_role(auth.uid(), 'admin'::app_role)
          AND (_org IS NULL OR _org = public.get_user_organization_id(auth.uid())));
$$;

CREATE OR REPLACE FUNCTION public.manager_can_access_org(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.admin_can_access_org(_org)
      OR (public.is_manager(auth.uid())
          AND (_org IS NULL OR _org = public.get_user_organization_id(auth.uid())));
$$;

REVOKE EXECUTE ON FUNCTION public.admin_can_access_org(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.manager_can_access_org(uuid) FROM anon;

-- 1) employee_evaluation_scores
DROP POLICY IF EXISTS "Admins can delete scores" ON public.employee_evaluation_scores;
CREATE POLICY "Admins can delete scores" ON public.employee_evaluation_scores FOR DELETE TO authenticated
  USING (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can insert scores" ON public.employee_evaluation_scores;
CREATE POLICY "Admins can insert scores" ON public.employee_evaluation_scores FOR INSERT TO authenticated
  WITH CHECK (public.manager_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can update scores" ON public.employee_evaluation_scores;
CREATE POLICY "Admins can update scores" ON public.employee_evaluation_scores FOR UPDATE TO authenticated
  USING (public.manager_can_access_org(organization_id))
  WITH CHECK (public.manager_can_access_org(organization_id));
DROP POLICY IF EXISTS "Members can view scores" ON public.employee_evaluation_scores;
CREATE POLICY "Members can view scores" ON public.employee_evaluation_scores FOR SELECT TO authenticated
  USING (employee_user_id = auth.uid() OR public.manager_can_access_org(organization_id));

-- 2) evaluation_criteria
DROP POLICY IF EXISTS "Admins can delete criteria" ON public.evaluation_criteria;
CREATE POLICY "Admins can delete criteria" ON public.evaluation_criteria FOR DELETE TO authenticated
  USING (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can insert criteria" ON public.evaluation_criteria;
CREATE POLICY "Admins can insert criteria" ON public.evaluation_criteria FOR INSERT TO authenticated
  WITH CHECK (public.manager_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can update criteria" ON public.evaluation_criteria;
CREATE POLICY "Admins can update criteria" ON public.evaluation_criteria FOR UPDATE TO authenticated
  USING (public.manager_can_access_org(organization_id))
  WITH CHECK (public.manager_can_access_org(organization_id));

-- 3) task_generation_jobs
DROP POLICY IF EXISTS "Users can view their own task generation jobs" ON public.task_generation_jobs;
CREATE POLICY "Users can view their own task generation jobs" ON public.task_generation_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.manager_can_access_org(organization_id));

-- 4) user_roles privilege escalation
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'admin'::app_role)
        AND role NOT IN ('admin'::app_role, 'super_admin'::app_role))
  );
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'admin'::app_role)
        AND role NOT IN ('admin'::app_role, 'super_admin'::app_role))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'admin'::app_role)
        AND role NOT IN ('admin'::app_role, 'super_admin'::app_role))
  );
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'admin'::app_role)
        AND role NOT IN ('admin'::app_role, 'super_admin'::app_role))
  );

-- 5) core org-scoped tables: replace unscoped admin checks
DROP POLICY IF EXISTS "Admins can delete departments" ON public.departments;
CREATE POLICY "Admins can delete departments" ON public.departments FOR DELETE TO authenticated USING (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can insert departments" ON public.departments;
CREATE POLICY "Admins can insert departments" ON public.departments FOR INSERT TO authenticated WITH CHECK (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can update departments" ON public.departments;
CREATE POLICY "Admins can update departments" ON public.departments FOR UPDATE TO authenticated USING (public.admin_can_access_org(organization_id)) WITH CHECK (public.admin_can_access_org(organization_id));

DROP POLICY IF EXISTS "Admins can delete employees" ON public.employees;
CREATE POLICY "Admins can delete employees" ON public.employees FOR DELETE TO authenticated USING (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can insert employees" ON public.employees;
CREATE POLICY "Admins can insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can update employees" ON public.employees;
CREATE POLICY "Admins can update employees" ON public.employees FOR UPDATE TO authenticated USING (public.admin_can_access_org(organization_id)) WITH CHECK (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can view all employees" ON public.employees;
CREATE POLICY "Admins can view all employees" ON public.employees FOR SELECT TO authenticated USING (public.admin_can_access_org(organization_id));

DROP POLICY IF EXISTS "Admins can delete all tasks" ON public.tasks;
CREATE POLICY "Admins can delete all tasks" ON public.tasks FOR DELETE TO authenticated USING (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can insert tasks" ON public.tasks;
CREATE POLICY "Admins can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can update all tasks" ON public.tasks;
CREATE POLICY "Admins can update all tasks" ON public.tasks FOR UPDATE TO authenticated USING (public.admin_can_access_org(organization_id)) WITH CHECK (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can view all tasks" ON public.tasks;
CREATE POLICY "Admins can view all tasks" ON public.tasks FOR SELECT TO authenticated USING (public.admin_can_access_org(organization_id));

DROP POLICY IF EXISTS "Admins can delete job_roles" ON public.job_roles;
CREATE POLICY "Admins can delete job_roles" ON public.job_roles FOR DELETE TO authenticated USING (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can insert job_roles" ON public.job_roles;
CREATE POLICY "Admins can insert job_roles" ON public.job_roles FOR INSERT TO authenticated WITH CHECK (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can update job_roles" ON public.job_roles;
CREATE POLICY "Admins can update job_roles" ON public.job_roles FOR UPDATE TO authenticated USING (public.admin_can_access_org(organization_id)) WITH CHECK (public.admin_can_access_org(organization_id));

DROP POLICY IF EXISTS "Admins can delete initiatives" ON public.initiatives;
CREATE POLICY "Admins can delete initiatives" ON public.initiatives FOR DELETE TO authenticated USING (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can insert initiatives" ON public.initiatives;
CREATE POLICY "Admins can insert initiatives" ON public.initiatives FOR INSERT TO authenticated WITH CHECK (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can update initiatives" ON public.initiatives;
CREATE POLICY "Admins can update initiatives" ON public.initiatives FOR UPDATE TO authenticated USING (public.admin_can_access_org(organization_id)) WITH CHECK (public.admin_can_access_org(organization_id));

DROP POLICY IF EXISTS "Admins can delete initiative departments" ON public.initiative_departments;
CREATE POLICY "Admins can delete initiative departments" ON public.initiative_departments FOR DELETE TO authenticated USING (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can insert initiative departments" ON public.initiative_departments;
CREATE POLICY "Admins can insert initiative departments" ON public.initiative_departments FOR INSERT TO authenticated WITH CHECK (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can update initiative departments" ON public.initiative_departments;
CREATE POLICY "Admins can update initiative departments" ON public.initiative_departments FOR UPDATE TO authenticated USING (public.admin_can_access_org(organization_id)) WITH CHECK (public.admin_can_access_org(organization_id));

DROP POLICY IF EXISTS "Admins can delete strategic goals" ON public.strategic_goals;
CREATE POLICY "Admins can delete strategic goals" ON public.strategic_goals FOR DELETE TO authenticated USING (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can insert strategic goals" ON public.strategic_goals;
CREATE POLICY "Admins can insert strategic goals" ON public.strategic_goals FOR INSERT TO authenticated WITH CHECK (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can update strategic goals" ON public.strategic_goals;
CREATE POLICY "Admins can update strategic goals" ON public.strategic_goals FOR UPDATE TO authenticated USING (public.admin_can_access_org(organization_id)) WITH CHECK (public.admin_can_access_org(organization_id));

DROP POLICY IF EXISTS "Admins can delete strategic goal departments" ON public.strategic_goal_departments;
CREATE POLICY "Admins can delete strategic goal departments" ON public.strategic_goal_departments FOR DELETE TO authenticated USING (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can insert strategic goal departments" ON public.strategic_goal_departments;
CREATE POLICY "Admins can insert strategic goal departments" ON public.strategic_goal_departments FOR INSERT TO authenticated WITH CHECK (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can update strategic goal departments" ON public.strategic_goal_departments;
CREATE POLICY "Admins can update strategic goal departments" ON public.strategic_goal_departments FOR UPDATE TO authenticated USING (public.admin_can_access_org(organization_id)) WITH CHECK (public.admin_can_access_org(organization_id));

DROP POLICY IF EXISTS "Admins can delete operational plans" ON public.operational_plans;
CREATE POLICY "Admins can delete operational plans" ON public.operational_plans FOR DELETE TO authenticated USING (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can insert operational plans" ON public.operational_plans;
CREATE POLICY "Admins can insert operational plans" ON public.operational_plans FOR INSERT TO authenticated WITH CHECK (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can update operational plans" ON public.operational_plans;
CREATE POLICY "Admins can update operational plans" ON public.operational_plans FOR UPDATE TO authenticated USING (public.admin_can_access_org(organization_id)) WITH CHECK (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can view all operational plans" ON public.operational_plans;
CREATE POLICY "Admins can view all operational plans" ON public.operational_plans FOR SELECT TO authenticated USING (public.admin_can_access_org(organization_id));

DROP POLICY IF EXISTS "Admins can manage column order" ON public.operational_plan_column_order;
CREATE POLICY "Admins can manage column order" ON public.operational_plan_column_order FOR ALL TO authenticated USING (public.admin_can_access_org(organization_id)) WITH CHECK (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can manage custom columns" ON public.operational_plan_custom_columns;
CREATE POLICY "Admins can manage custom columns" ON public.operational_plan_custom_columns FOR ALL TO authenticated USING (public.admin_can_access_org(organization_id)) WITH CHECK (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Admins can manage custom values" ON public.operational_plan_custom_values;
CREATE POLICY "Admins can manage custom values" ON public.operational_plan_custom_values FOR ALL TO authenticated USING (public.admin_can_access_org(organization_id)) WITH CHECK (public.admin_can_access_org(organization_id));

DROP POLICY IF EXISTS "Users can insert custom values for own plans" ON public.operational_plan_custom_values;
CREATE POLICY "Users can insert custom values for own plans" ON public.operational_plan_custom_values FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.operational_plans op WHERE op.id = operational_plan_custom_values.operational_plan_id
    AND (op.user_id = auth.uid() OR public.admin_can_access_org(op.organization_id))));
DROP POLICY IF EXISTS "Users can update custom values for own plans" ON public.operational_plan_custom_values;
CREATE POLICY "Users can update custom values for own plans" ON public.operational_plan_custom_values FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.operational_plans op WHERE op.id = operational_plan_custom_values.operational_plan_id
    AND (op.user_id = auth.uid() OR public.admin_can_access_org(op.organization_id))));
DROP POLICY IF EXISTS "Users can view custom values for accessible plans" ON public.operational_plan_custom_values;
CREATE POLICY "Users can view custom values for accessible plans" ON public.operational_plan_custom_values FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.operational_plans op WHERE op.id = operational_plan_custom_values.operational_plan_id
    AND (op.user_id = auth.uid() OR public.admin_can_access_org(op.organization_id))));

DROP POLICY IF EXISTS "Admins can delete operational plan months" ON public.operational_plan_months;
CREATE POLICY "Admins can delete operational plan months" ON public.operational_plan_months FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.operational_plans op WHERE op.id = operational_plan_months.operational_plan_id
    AND public.admin_can_access_org(op.organization_id)));
DROP POLICY IF EXISTS "Users can insert operational plan months" ON public.operational_plan_months;
CREATE POLICY "Users can insert operational plan months" ON public.operational_plan_months FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.operational_plans op WHERE op.id = operational_plan_months.operational_plan_id
    AND (op.user_id = auth.uid() OR public.admin_can_access_org(op.organization_id))));
DROP POLICY IF EXISTS "Users can update operational plan months" ON public.operational_plan_months;
CREATE POLICY "Users can update operational plan months" ON public.operational_plan_months FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.operational_plans op WHERE op.id = operational_plan_months.operational_plan_id
    AND (op.user_id = auth.uid() OR public.admin_can_access_org(op.organization_id))));
DROP POLICY IF EXISTS "Users can view operational plan months" ON public.operational_plan_months;
CREATE POLICY "Users can view operational plan months" ON public.operational_plan_months FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.operational_plans op WHERE op.id = operational_plan_months.operational_plan_id
    AND (op.user_id = auth.uid() OR public.admin_can_access_org(op.organization_id))));

DROP POLICY IF EXISTS "Admins can delete executive plans" ON public.executive_plans;
CREATE POLICY "Admins can delete executive plans" ON public.executive_plans FOR DELETE TO authenticated
  USING (public.admin_can_access_org(organization_id));
DROP POLICY IF EXISTS "Users can insert executive plans" ON public.executive_plans;
CREATE POLICY "Users can insert executive plans" ON public.executive_plans FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.operational_plan_months opm JOIN public.operational_plans op ON op.id = opm.operational_plan_id
    WHERE opm.id = executive_plans.operational_plan_month_id AND (op.user_id = auth.uid() OR public.admin_can_access_org(op.organization_id))));
DROP POLICY IF EXISTS "Users can update executive plans" ON public.executive_plans;
CREATE POLICY "Users can update executive plans" ON public.executive_plans FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.operational_plan_months opm JOIN public.operational_plans op ON op.id = opm.operational_plan_id
    WHERE opm.id = executive_plans.operational_plan_month_id AND (op.user_id = auth.uid() OR public.admin_can_access_org(op.organization_id))));
DROP POLICY IF EXISTS "Users can view executive plans" ON public.executive_plans;
CREATE POLICY "Users can view executive plans" ON public.executive_plans FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.operational_plan_months opm JOIN public.operational_plans op ON op.id = opm.operational_plan_id
    WHERE opm.id = executive_plans.operational_plan_month_id AND (op.user_id = auth.uid() OR public.admin_can_access_org(op.organization_id))));

DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.admin_can_access_org(organization_id));

-- 6) Lock down internal SECURITY DEFINER functions from client roles
REVOKE EXECUTE ON FUNCTION public.sb_dump_auth_table(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sb_dump_public_table(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sb_dump_storage_metadata() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sb_list_public_tables() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sb_enqueue_backup_stage(text, uuid, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
DO $
BEGIN
  IF to_regprocedure('public.email_queue_dispatch()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated';
  END IF;
END
$;
REVOKE EXECUTE ON FUNCTION public.allocate_expense(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._upsert_baseline(uuid, text, numeric) FROM anon, authenticated;

-- Remaining definer helpers: not callable by anonymous visitors
REVOKE EXECUTE ON FUNCTION public.get_user_account_email(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_subordinate_employee_ids(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_subordinate_user_ids(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_organization_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_manager(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_viewer(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_demo_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_belongs_to_org(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_user_approved_in_org(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_org_finance_defaults(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_organization_by_slug(text) FROM anon;
