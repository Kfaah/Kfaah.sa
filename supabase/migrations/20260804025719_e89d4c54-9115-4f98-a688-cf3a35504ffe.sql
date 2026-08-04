CREATE OR REPLACE FUNCTION public.sb_enqueue_backup_stage(_stage text, _backup_id uuid, _cursor integer)
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
    url := 'https://jopvcsrmccoulujeyjvw.supabase.co/functions/v1/secure-backup-to-github',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := jsonb_build_object('stage', _stage, 'backup_id', _backup_id, 'cursor', GREATEST(_cursor, 0))
  ) INTO _req_id;

  RETURN _req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sb_enqueue_backup_stage(text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sb_enqueue_backup_stage(text, uuid, integer) TO service_role;