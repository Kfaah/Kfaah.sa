ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_viewer_account boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_viewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'viewer'::app_role
  )
$$;