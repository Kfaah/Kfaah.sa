CREATE TABLE IF NOT EXISTS public.platform_email_settings (
  id boolean PRIMARY KEY DEFAULT true,
  sender_name text NOT NULL DEFAULT 'منصة كفاءة',
  signature text NOT NULL DEFAULT '',
  signature_enabled boolean NOT NULL DEFAULT false,
  footer text NOT NULL DEFAULT '',
  footer_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_email_settings_singleton CHECK (id = true)
);

INSERT INTO public.platform_email_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read platform email settings"
ON public.platform_email_settings FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins update platform email settings"
ON public.platform_email_settings FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));