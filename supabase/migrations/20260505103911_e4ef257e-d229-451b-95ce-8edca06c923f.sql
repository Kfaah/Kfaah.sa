CREATE OR REPLACE FUNCTION public.get_user_account_email(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _user_id LIMIT 1;
  RETURN _email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_account_email(uuid) TO authenticated;