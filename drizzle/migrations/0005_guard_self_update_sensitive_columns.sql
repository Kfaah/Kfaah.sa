
-- 1) Employees: prevent self-service updates from changing org/role/manager columns
CREATE OR REPLACE FUNCTION public.guard_employee_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only restrict when the actor is the employee themselves (self-update)
  -- and they are not an admin / super_admin / org admin.
  IF auth.uid() = OLD.user_id
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT public.is_super_admin(auth.uid())
     AND NOT public.is_org_admin(auth.uid(), OLD.organization_id)
  THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
       OR NEW.role_level IS DISTINCT FROM OLD.role_level
       OR NEW.department_id IS DISTINCT FROM OLD.department_id
       OR NEW.direct_manager_id IS DISTINCT FROM OLD.direct_manager_id
       OR NEW.executive_manager_id IS DISTINCT FROM OLD.executive_manager_id
       OR NEW.username IS DISTINCT FROM OLD.username
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
    THEN
      RAISE EXCEPTION 'not allowed to modify protected employee fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_employee_self_update ON public.employees;
CREATE TRIGGER trg_guard_employee_self_update
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.guard_employee_self_update();

-- 2) Operational plans: prevent non-admins from moving plans across organizations
CREATE OR REPLACE FUNCTION public.guard_operational_plan_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
       AND NOT public.has_role(auth.uid(), 'admin')
       AND NOT public.is_super_admin(auth.uid())
       AND NOT public.is_org_admin(auth.uid(), OLD.organization_id)
    THEN
      RAISE EXCEPTION 'not allowed to change plan organization';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    -- Self-inserted plans must belong to the user's own organization
    IF auth.uid() = NEW.user_id
       AND NOT public.has_role(auth.uid(), 'admin')
       AND NOT public.is_super_admin(auth.uid())
       AND NOT public.is_org_admin(auth.uid(), NEW.organization_id)
       AND NOT public.user_belongs_to_org(auth.uid(), NEW.organization_id)
    THEN
      RAISE EXCEPTION 'not allowed to create a plan for another organization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_operational_plan_org ON public.operational_plans;
CREATE TRIGGER trg_guard_operational_plan_org
BEFORE INSERT OR UPDATE ON public.operational_plans
FOR EACH ROW
EXECUTE FUNCTION public.guard_operational_plan_org();
