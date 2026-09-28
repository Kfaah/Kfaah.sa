-- Rewrite persisted references that still point at the former hosted Supabase project
-- and route backup continuation calls through the Hetzner Kfaah gateway.

DO $$
DECLARE
  old_base constant text := 'https://jopvcsrmccoulujeyjvw.supabase.co';
  new_base constant text := 'https://kfaah.sa';
BEGIN
  UPDATE public.organizations
  SET logo_url = replace(logo_url, old_base, new_base)
  WHERE logo_url LIKE old_base || '%';

  UPDATE public.organization_profiles
  SET logo_url = replace(logo_url, old_base, new_base),
      updated_at = now()
  WHERE logo_url LIKE old_base || '%';

  UPDATE public.organization_branding
  SET logo_url = CASE
        WHEN logo_url LIKE old_base || '%' THEN replace(logo_url, old_base, new_base)
        ELSE logo_url
      END,
      favicon_url = CASE
        WHEN favicon_url LIKE old_base || '%' THEN replace(favicon_url, old_base, new_base)
        ELSE favicon_url
      END,
      updated_at = now()
  WHERE logo_url LIKE old_base || '%'
     OR favicon_url LIKE old_base || '%';

  UPDATE public.action_plan_tasks
  SET subtasks = replace(subtasks::text, old_base, new_base)::jsonb,
      updated_at = now()
  WHERE subtasks::text LIKE '%' || old_base || '%';
END;
$$;

CREATE OR REPLACE FUNCTION public.sb_enqueue_backup_stage(
  _stage text,
  _backup_id uuid,
  _cursor integer
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _req_id bigint;
BEGIN
  IF _stage NOT IN ('database', 'storage', 'finalize') THEN
    RAISE EXCEPTION 'invalid_stage';
  END IF;

  SELECT net.http_post(
    url := 'https://kfaah.sa/functions/v1/secure-backup-to-github',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := jsonb_build_object(
      'stage', _stage,
      'backup_id', _backup_id,
      'cursor', GREATEST(_cursor, 0)
    )
  ) INTO _req_id;

  RETURN _req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sb_enqueue_backup_stage(text, uuid, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sb_enqueue_backup_stage(text, uuid, integer)
TO service_role;
