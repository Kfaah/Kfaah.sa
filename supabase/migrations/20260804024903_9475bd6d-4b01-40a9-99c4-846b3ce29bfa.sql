-- =============================================================
-- Secure encrypted backup infrastructure (read-only helpers)
-- No existing table is altered or dropped.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.secure_backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'running',
  tables_count integer NOT NULL DEFAULT 0,
  rows_count bigint NOT NULL DEFAULT 0,
  files_count integer NOT NULL DEFAULT 0,
  total_bytes bigint NOT NULL DEFAULT 0,
  parts_count integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0,
  error_summary text,
  remote_path text,
  commit_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  manifest jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Data API grants: no anon, no authenticated writes.
GRANT SELECT ON public.secure_backup_logs TO authenticated;
GRANT ALL ON public.secure_backup_logs TO service_role;

ALTER TABLE public.secure_backup_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admins can read secure backup logs" ON public.secure_backup_logs;
CREATE POLICY "super admins can read secure backup logs"
ON public.secure_backup_logs FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_secure_backup_logs_updated_at ON public.secure_backup_logs;
CREATE TRIGGER trg_secure_backup_logs_updated_at
BEFORE UPDATE ON public.secure_backup_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- Read-only dump helpers. service_role only.
-- =============================================================

CREATE OR REPLACE FUNCTION public.sb_list_public_tables()
RETURNS TABLE(table_name text, row_estimate bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.relname::text,
         GREATEST(c.reltuples::bigint, 0)
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
  ORDER BY c.relname;
$$;

REVOKE ALL ON FUNCTION public.sb_list_public_tables() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sb_list_public_tables() TO service_role;

-- Paged dump of one public table (rows as jsonb array), read-only.
CREATE OR REPLACE FUNCTION public.sb_dump_public_table(_table text, _limit integer DEFAULT 1000, _offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = _table
  ) THEN
    RAISE EXCEPTION 'unknown_table';
  END IF;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.%I ORDER BY 1 OFFSET %s LIMIT %s) t',
    _table, GREATEST(_offset, 0), LEAST(GREATEST(_limit, 1), 5000)
  ) INTO _result;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.sb_dump_public_table(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sb_dump_public_table(text, integer, integer) TO service_role;

-- Restore-critical auth data only. Sessions / refresh tokens / one-time tokens are excluded.
CREATE OR REPLACE FUNCTION public.sb_dump_auth_table(_table text, _limit integer DEFAULT 500, _offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF _table NOT IN ('users', 'identities', 'mfa_factors') THEN
    RAISE EXCEPTION 'table_not_allowed';
  END IF;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM auth.%I ORDER BY id OFFSET %s LIMIT %s) t',
    _table, GREATEST(_offset, 0), LEAST(GREATEST(_limit, 1), 2000)
  ) INTO _result;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.sb_dump_auth_table(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sb_dump_auth_table(text, integer, integer) TO service_role;

-- Storage metadata (buckets + object records), read-only.
CREATE OR REPLACE FUNCTION public.sb_dump_storage_metadata()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'buckets', COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM storage.buckets b), '[]'::jsonb),
    'objects', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'bucket_id', o.bucket_id, 'name', o.name,
        'created_at', o.created_at, 'updated_at', o.updated_at,
        'metadata', o.metadata
      )) FROM storage.objects o
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.sb_dump_storage_metadata() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sb_dump_storage_metadata() TO service_role;