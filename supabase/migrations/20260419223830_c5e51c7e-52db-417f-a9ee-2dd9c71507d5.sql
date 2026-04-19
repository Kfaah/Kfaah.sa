-- 1) Add role_level to employees
DO $$ BEGIN
  CREATE TYPE public.employee_role_level AS ENUM ('employee', 'manager', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS role_level public.employee_role_level NOT NULL DEFAULT 'employee';

-- 2) Recursive function: get all subordinate employee_ids under a given manager (by employee.id)
CREATE OR REPLACE FUNCTION public.get_subordinate_employee_ids(_manager_employee_id uuid)
RETURNS TABLE(employee_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT id FROM public.employees WHERE direct_manager_id = _manager_employee_id
    UNION ALL
    SELECT e.id
    FROM public.employees e
    JOIN tree t ON e.direct_manager_id = t.id
  )
  SELECT id FROM tree;
$$;

-- 3) Helper: get subordinate user_ids (auth uids) under a given auth user (the manager)
CREATE OR REPLACE FUNCTION public.get_subordinate_user_ids(_manager_user_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT id FROM public.employees WHERE user_id = _manager_user_id LIMIT 1
  ),
  subs AS (
    SELECT employee_id FROM public.get_subordinate_employee_ids((SELECT id FROM me))
  )
  SELECT e.user_id
  FROM public.employees e
  JOIN subs s ON s.employee_id = e.id
  WHERE e.user_id IS NOT NULL;
$$;

-- 4) Helper: is this user a manager (has any direct subordinate)?
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees me
    JOIN public.employees sub ON sub.direct_manager_id = me.id
    WHERE me.user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.employees WHERE user_id = _user_id AND role_level = 'manager'
  );
$$;