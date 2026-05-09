CREATE TABLE IF NOT EXISTS public.platform_email_sync_settings (
  id boolean PRIMARY KEY DEFAULT true,
  sync_token text NOT NULL,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_email_sync_settings_singleton CHECK (id = true)
);

ALTER TABLE public.platform_email_sync_settings ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_platform_email_sync_settings_updated ON public.platform_email_sync_settings;
CREATE TRIGGER trg_platform_email_sync_settings_updated
BEFORE UPDATE ON public.platform_email_sync_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();