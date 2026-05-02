CREATE OR REPLACE FUNCTION public.get_org_membership_requests(_org_slug text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  organization_id uuid,
  approval_status text,
  requested_at timestamptz,
  approved_at timestamptz,
  display_name text,
  username text,
  contact_email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  _requester uuid;
  _org_id uuid;
BEGIN
  _requester := auth.uid();
  IF _requester IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _org_slug IS NOT NULL AND btrim(_org_slug) <> '' THEN
    SELECT o.id INTO _org_id
    FROM public.organizations o
    WHERE o.slug = _org_slug
    LIMIT 1;
  ELSE
    _org_id := public.get_user_organization_id(_requester);
  END IF;

  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'organization_not_found';
  END IF;

  IF NOT (
    public.is_super_admin(_requester)
    OR (
      public.is_user_approved_in_org(_requester, _org_id)
      AND public.has_any_role(_requester, ARRAY['admin','hr_manager','moderator']::public.app_role[])
    )
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    uo.id,
    uo.user_id,
    uo.organization_id,
    uo.approval_status,
    uo.requested_at,
    uo.approved_at,
    COALESCE(
      NULLIF(e.full_name, ''),
      NULLIF(TRIM(CONCAT_WS(' ', au.raw_user_meta_data->>'first_name', au.raw_user_meta_data->>'last_name')), ''),
      NULLIF(au.raw_user_meta_data->>'full_name', ''),
      NULLIF(au.raw_user_meta_data->>'username', ''),
      NULLIF(split_part(au.email, '@', 1), ''),
      'مستخدم جديد'
    ) AS display_name,
    COALESCE(
      NULLIF(e.username, ''),
      NULLIF(au.raw_user_meta_data->>'username', ''),
      NULLIF(split_part(au.email, '@', 1), '')
    ) AS username,
    COALESCE(
      NULLIF(e.email, ''),
      NULLIF(au.raw_user_meta_data->>'email', ''),
      NULLIF(au.email, '')
    ) AS contact_email
  FROM public.user_organizations uo
  LEFT JOIN public.employees e ON e.user_id = uo.user_id
  LEFT JOIN auth.users au ON au.id = uo.user_id
  WHERE uo.organization_id = _org_id
  ORDER BY
    CASE uo.approval_status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
    uo.requested_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_membership_request(_membership_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  _requester uuid;
  _target_user uuid;
  _org_id uuid;
  _display_name text;
  _username text;
  _email text;
  _existing_employee_id uuid;
BEGIN
  _requester := auth.uid();
  IF _requester IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT uo.user_id, uo.organization_id
  INTO _target_user, _org_id
  FROM public.user_organizations uo
  WHERE uo.id = _membership_id;

  IF _target_user IS NULL OR _org_id IS NULL THEN
    RAISE EXCEPTION 'membership_not_found';
  END IF;

  IF NOT (
    public.is_super_admin(_requester)
    OR (
      public.is_user_approved_in_org(_requester, _org_id)
      AND public.has_role(_requester, 'admin'::public.app_role)
    )
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  UPDATE public.user_organizations
  SET approval_status = _status,
      approved_by = CASE WHEN _status = 'approved' THEN _requester ELSE NULL END,
      approved_at = CASE WHEN _status = 'approved' THEN now() ELSE NULL END
  WHERE id = _membership_id;

  IF _status = 'approved' THEN
    SELECT
      COALESCE(
        NULLIF(TRIM(CONCAT_WS(' ', au.raw_user_meta_data->>'first_name', au.raw_user_meta_data->>'last_name')), ''),
        NULLIF(au.raw_user_meta_data->>'full_name', ''),
        NULLIF(au.raw_user_meta_data->>'username', ''),
        NULLIF(split_part(au.email, '@', 1), ''),
        'عضو جديد'
      ),
      COALESCE(
        NULLIF(au.raw_user_meta_data->>'username', ''),
        NULLIF(split_part(au.email, '@', 1), '')
      ),
      COALESCE(
        NULLIF(au.raw_user_meta_data->>'email', ''),
        NULLIF(au.email, ''),
        'member-' || _target_user::text || '@user.local'
      )
    INTO _display_name, _username, _email
    FROM auth.users au
    WHERE au.id = _target_user;

    SELECT e.id INTO _existing_employee_id
    FROM public.employees e
    WHERE e.user_id = _target_user
    LIMIT 1;

    IF _existing_employee_id IS NULL THEN
      INSERT INTO public.employees (
        user_id,
        full_name,
        username,
        email,
        phone,
        job_role,
        role_color,
        status,
        organization_id,
        role_level
      ) VALUES (
        _target_user,
        _display_name,
        _username,
        _email,
        NULL,
        'عضو جمعية',
        'bg-primary',
        'active',
        _org_id,
        'employee'
      );
    ELSE
      UPDATE public.employees
      SET organization_id = COALESCE(organization_id, _org_id),
          full_name = COALESCE(NULLIF(full_name, ''), _display_name),
          username = COALESCE(NULLIF(username, ''), _username),
          email = COALESCE(NULLIF(email, ''), _email),
          status = COALESCE(status, 'active')
      WHERE id = _existing_employee_id;
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target_user, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  INSERT INTO public.notifications (user_id, organization_id, title, message, type)
  VALUES (
    _target_user,
    _org_id,
    CASE WHEN _status = 'approved' THEN 'تم اعتماد عضويتك' ELSE 'تم رفض طلب الانضمام' END,
    CASE WHEN _status = 'approved'
      THEN 'تمت الموافقة على انضمامك إلى الجمعية. يمكنك الآن تسجيل الدخول.'
      ELSE 'نأسف، لم تتم الموافقة على طلب انضمامك. يرجى التواصل مع المسؤول.'
    END,
    'info'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_membership_requests(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_membership_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_membership_requests(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_membership_request(uuid, text) TO authenticated;