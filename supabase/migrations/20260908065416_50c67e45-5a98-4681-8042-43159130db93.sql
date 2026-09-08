-- 1) Restrict employee self-update to safe columns via trigger guard
CREATE OR REPLACE FUNCTION public.guard_employee_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Privileged actors bypass the guard
  IF public.is_super_admin(auth.uid())
     OR (NEW.organization_id IS NOT NULL AND public.admin_can_access_org(NEW.organization_id))
     OR (OLD.organization_id IS NOT NULL AND public.admin_can_access_org(OLD.organization_id))
     OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Self edit: force privileged columns to keep their old values
  IF auth.uid() = OLD.user_id THEN
    NEW.user_id := OLD.user_id;
    NEW.organization_id := OLD.organization_id;
    NEW.department_id := OLD.department_id;
    NEW.direct_manager_id := OLD.direct_manager_id;
    NEW.executive_manager_id := OLD.executive_manager_id;
    NEW.role_level := OLD.role_level;
    NEW.job_role := OLD.job_role;
    NEW.is_viewer_account := OLD.is_viewer_account;
    NEW.status := OLD.status;
    NEW.performance := OLD.performance;
    NEW.tasks_completed := OLD.tasks_completed;
    NEW.tasks_total := OLD.tasks_total;
    NEW.email := OLD.email;
    NEW.username := OLD.username;
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_employee_self_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_employee_self_update ON public.employees;
CREATE TRIGGER trg_guard_employee_self_update
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.guard_employee_self_update();

-- Tighten the self-update policy itself
DROP POLICY IF EXISTS "Employees can update own record" ON public.employees;
CREATE POLICY "Employees can update own record"
ON public.employees
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2) Align evaluation_criteria write access with delete (admins only)
DROP POLICY IF EXISTS "Admins can insert criteria" ON public.evaluation_criteria;
CREATE POLICY "Admins can insert criteria"
ON public.evaluation_criteria
FOR INSERT
TO authenticated
WITH CHECK (admin_can_access_org(organization_id));

DROP POLICY IF EXISTS "Admins can update criteria" ON public.evaluation_criteria;
CREATE POLICY "Admins can update criteria"
ON public.evaluation_criteria
FOR UPDATE
TO authenticated
USING (admin_can_access_org(organization_id))
WITH CHECK (admin_can_access_org(organization_id));