-- ============ 1) Organization Branding ============
CREATE TABLE IF NOT EXISTS public.organization_branding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_name TEXT,
  site_tagline TEXT,
  display_name TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branding_read_for_org_members"
ON public.organization_branding FOR SELECT TO authenticated
USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "branding_manage_super_admin"
ON public.organization_branding FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "branding_manage_org_admin"
ON public.organization_branding FOR ALL TO authenticated
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  AND public.has_any_role(auth.uid(), ARRAY['admin','hr_manager','moderator']::app_role[])
)
WITH CHECK (
  public.user_belongs_to_org(auth.uid(), organization_id)
  AND public.has_any_role(auth.uid(), ARRAY['admin','hr_manager','moderator']::app_role[])
);

CREATE TRIGGER trg_branding_updated_at
BEFORE UPDATE ON public.organization_branding
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 2) Role Permissions Matrix ============
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  module TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, role, module)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_perm_read_for_org_or_global"
ON public.role_permissions FOR SELECT TO authenticated
USING (organization_id IS NULL OR public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "role_perm_manage_super_admin"
ON public.role_permissions FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "role_perm_manage_org_admin"
ON public.role_permissions FOR ALL TO authenticated
USING (
  organization_id IS NOT NULL
  AND public.user_belongs_to_org(auth.uid(), organization_id)
  AND public.has_any_role(auth.uid(), ARRAY['admin']::app_role[])
)
WITH CHECK (
  organization_id IS NOT NULL
  AND public.user_belongs_to_org(auth.uid(), organization_id)
  AND public.has_any_role(auth.uid(), ARRAY['admin']::app_role[])
);

CREATE TRIGGER trg_role_perm_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 3) Navigation Customization ============
CREATE TABLE IF NOT EXISTS public.navigation_customization (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  custom_label TEXT,
  custom_icon TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  visible_to_roles app_role[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, item_key)
);

ALTER TABLE public.navigation_customization ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nav_read_for_org_or_global"
ON public.navigation_customization FOR SELECT TO authenticated
USING (organization_id IS NULL OR public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "nav_manage_super_admin"
ON public.navigation_customization FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "nav_manage_org_admin"
ON public.navigation_customization FOR ALL TO authenticated
USING (
  organization_id IS NOT NULL
  AND public.user_belongs_to_org(auth.uid(), organization_id)
  AND public.has_any_role(auth.uid(), ARRAY['admin','moderator']::app_role[])
)
WITH CHECK (
  organization_id IS NOT NULL
  AND public.user_belongs_to_org(auth.uid(), organization_id)
  AND public.has_any_role(auth.uid(), ARRAY['admin','moderator']::app_role[])
);

CREATE TRIGGER trg_nav_updated_at
BEFORE UPDATE ON public.navigation_customization
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Storage bucket for branding assets ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding-assets', 'branding-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "branding_assets_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding-assets');

CREATE POLICY "branding_assets_authenticated_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'branding-assets');

CREATE POLICY "branding_assets_authenticated_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'branding-assets');

CREATE POLICY "branding_assets_authenticated_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'branding-assets');
