CREATE TABLE IF NOT EXISTS public.organization_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  about text,
  website_url text,
  store_url text,
  twitter_url text,
  instagram_url text,
  tiktok_url text,
  snapchat_url text,
  youtube_url text,
  facebook_url text,
  linkedin_url text,
  other_links jsonb DEFAULT '[]'::jsonb,
  last_analyzed_at timestamptz,
  ai_analysis jsonb,
  ai_model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access on organization_profiles"
  ON public.organization_profiles FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Org members can read their org profile"
  ON public.organization_profiles FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE TRIGGER update_organization_profiles_updated_at
  BEFORE UPDATE ON public.organization_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();