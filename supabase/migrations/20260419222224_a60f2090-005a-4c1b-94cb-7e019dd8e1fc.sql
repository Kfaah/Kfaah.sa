-- Add self-signup toggle for organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS allow_self_signup boolean NOT NULL DEFAULT true;

-- Function to lookup organization by slug (public, used on signup page)
CREATE OR REPLACE FUNCTION public.get_organization_by_slug(_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo_url text,
  is_active boolean,
  allow_self_signup boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, slug, logo_url, is_active, allow_self_signup
  FROM public.organizations
  WHERE slug = _slug AND is_active = true
  LIMIT 1
$$;

-- Allow public read of organization by slug (for the public signup page)
CREATE POLICY "Public can view active orgs by slug lookup"
ON public.organizations
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Function to register a new user into a specific organization (called after signUp)
CREATE OR REPLACE FUNCTION public.join_organization_by_slug(_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _user_id uuid;
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

  INSERT INTO public.user_organizations (user_id, organization_id, is_default)
  VALUES (_user_id, _org_id, true)
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  -- Default role: regular user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _org_id;
END;
$$;