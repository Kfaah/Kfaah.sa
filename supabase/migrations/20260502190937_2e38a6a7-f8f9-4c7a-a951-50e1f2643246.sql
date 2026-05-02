
-- Add approval status to user_organizations
ALTER TABLE public.user_organizations 
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz NOT NULL DEFAULT now();

-- Validation trigger ensures status values are valid
CREATE OR REPLACE FUNCTION public.validate_user_org_approval_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid approval_status: %', NEW.approval_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_user_org_approval_status_trigger ON public.user_organizations;
CREATE TRIGGER validate_user_org_approval_status_trigger
BEFORE INSERT OR UPDATE ON public.user_organizations
FOR EACH ROW EXECUTE FUNCTION public.validate_user_org_approval_status();

-- Allow org admins to update memberships (for approval/rejection) within their org
CREATE POLICY "Org admins can update memberships in their org"
ON public.user_organizations
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND organization_id = get_user_organization_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND organization_id = get_user_organization_id(auth.uid())
);

-- Update join_organization_by_slug to insert as pending
CREATE OR REPLACE FUNCTION public.join_organization_by_slug(_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _user_id uuid;
  _admin_user_id uuid;
  _new_user_label text;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT id INTO _org_id
  FROM public.organizations
  WHERE slug = _slug AND is_active = true AND allow_self_signup = true
  LIMIT 1;

  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'organization_not_found_or_signup_disabled';
  END IF;

  -- Insert as PENDING, requires admin approval before access
  INSERT INTO public.user_organizations (user_id, organization_id, is_default, approval_status)
  VALUES (_user_id, _org_id, true, 'pending')
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  -- Default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Build a friendly label for the new user
  SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ',
            au.raw_user_meta_data->>'first_name',
            au.raw_user_meta_data->>'last_name')), ''),
          au.raw_user_meta_data->>'username',
          'مستخدم جديد')
  INTO _new_user_label
  FROM auth.users au
  WHERE au.id = _user_id;

  -- Notify all org admins of the new pending request
  FOR _admin_user_id IN
    SELECT uo.user_id
    FROM public.user_organizations uo
    JOIN public.user_roles ur ON ur.user_id = uo.user_id
    WHERE uo.organization_id = _org_id
      AND uo.approval_status = 'approved'
      AND ur.role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, organization_id, title, message, type)
    VALUES (
      _admin_user_id,
      _org_id,
      'طلب انضمام جديد',
      'قام ' || _new_user_label || ' بطلب الانضمام إلى الجمعية ويحتاج إلى موافقتك.',
      'info'
    );
  END LOOP;

  RETURN _org_id;
END;
$$;

-- Helper: check if a user is approved in a given org
CREATE OR REPLACE FUNCTION public.is_user_approved_in_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id AND approval_status = 'approved'
  );
$$;
