CREATE OR REPLACE FUNCTION public.join_organization_by_slug(_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _org_id uuid;
  _user_id uuid;
  _admin_user_id uuid;
  _new_user_label text;
  _has_approved boolean;
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

  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND approval_status = 'approved'
  ) INTO _has_approved;

  INSERT INTO public.user_organizations (
    user_id, organization_id, is_default, approval_status, requested_at, approved_by, approved_at
  )
  VALUES (_user_id, _org_id, NOT _has_approved, 'pending', now(), NULL, NULL)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET
    approval_status = CASE
      WHEN public.user_organizations.approval_status = 'approved' THEN 'approved'
      ELSE 'pending'
    END,
    requested_at = CASE
      WHEN public.user_organizations.approval_status = 'approved' THEN public.user_organizations.requested_at
      ELSE now()
    END,
    approved_by = CASE
      WHEN public.user_organizations.approval_status = 'approved' THEN public.user_organizations.approved_by
      ELSE NULL
    END,
    approved_at = CASE
      WHEN public.user_organizations.approval_status = 'approved' THEN public.user_organizations.approved_at
      ELSE NULL
    END,
    is_default = public.user_organizations.is_default;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT COALESCE(
    NULLIF(TRIM(CONCAT_WS(' ', au.raw_user_meta_data->>'first_name', au.raw_user_meta_data->>'last_name')), ''),
    au.raw_user_meta_data->>'username',
    'مستخدم جديد'
  )
  INTO _new_user_label
  FROM auth.users au
  WHERE au.id = _user_id;

  FOR _admin_user_id IN
    SELECT DISTINCT uo.user_id
    FROM public.user_organizations uo
    JOIN public.user_roles ur ON ur.user_id = uo.user_id
    WHERE uo.organization_id = _org_id
      AND uo.approval_status = 'approved'
      AND ur.role IN ('admin', 'super_admin')
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
$function$;