-- دالة للحصول على مدير الموارد البشرية
CREATE OR REPLACE FUNCTION public.get_hr_manager_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result uuid;
BEGIN
  SELECT e.user_id INTO result
  FROM employees e
  JOIN user_roles ur ON ur.user_id = e.user_id
  WHERE ur.role = 'hr_manager'::app_role
  LIMIT 1;
  RETURN result;
END;
$$;

-- دالة للحصول على المدير المالي
CREATE OR REPLACE FUNCTION public.get_finance_manager_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result uuid;
BEGIN
  SELECT e.user_id INTO result
  FROM employees e
  JOIN user_roles ur ON ur.user_id = e.user_id
  WHERE ur.role = 'finance_manager'::app_role
  LIMIT 1;
  RETURN result;
END;
$$;

-- دالة للحصول على المحاسبين
CREATE OR REPLACE FUNCTION public.get_accountants()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result uuid[];
BEGIN
  SELECT COALESCE(ARRAY_AGG(e.user_id), ARRAY[]::uuid[]) INTO result
  FROM employees e
  JOIN user_roles ur ON ur.user_id = e.user_id
  WHERE ur.role = 'accountant'::app_role;
  RETURN result;
END;
$$;

-- دالة للتحقق من الدور
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  );
END;
$$;