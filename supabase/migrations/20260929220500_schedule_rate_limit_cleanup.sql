-- Keep public rate-limit state bounded. pg_cron already exists in this stack.
DO $$
DECLARE
  _job_id bigint;
BEGIN
  SELECT jobid
  INTO _job_id
  FROM cron.job
  WHERE jobname = 'cleanup-public-rate-limits-daily'
  LIMIT 1;

  IF _job_id IS NOT NULL THEN
    PERFORM cron.unschedule(_job_id);
  END IF;

  PERFORM cron.schedule(
    'cleanup-public-rate-limits-daily',
    '17 3 * * *',
    $cmd$SELECT public.cleanup_public_rate_limits(interval '2 days');$cmd$
  );
END
$$;
