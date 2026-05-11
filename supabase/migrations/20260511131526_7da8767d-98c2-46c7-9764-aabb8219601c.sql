CREATE TABLE IF NOT EXISTS public.org_donor_tiers (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  tier_a_min numeric NOT NULL DEFAULT 5000,
  tier_b_min numeric NOT NULL DEFAULT 2000,
  tier_c_min numeric NOT NULL DEFAULT 500,
  tier_a_channel text NOT NULL DEFAULT 'خطاب رسمي + اتصال',
  tier_b_channel text NOT NULL DEFAULT 'اتصال هاتفي',
  tier_c_channel text NOT NULL DEFAULT 'رسالة واتساب شخصية',
  tier_d_channel text NOT NULL DEFAULT 'رسالة SMS',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.org_donor_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members view donor tiers" ON public.org_donor_tiers;
CREATE POLICY "org members view donor tiers" ON public.org_donor_tiers
FOR SELECT USING (public.user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "org admins manage donor tiers" ON public.org_donor_tiers;
CREATE POLICY "org admins manage donor tiers" ON public.org_donor_tiers
FOR ALL USING (public.is_org_admin(auth.uid(), organization_id))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));