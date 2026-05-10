DO $$
DECLARE
  _job_id integer;
BEGIN
  SELECT jobid INTO _job_id
  FROM cron.job
  WHERE jobname = 'fetch-platform-email-replies-10s'
  LIMIT 1;

  IF _job_id IS NOT NULL THEN
    PERFORM cron.unschedule(_job_id);
  END IF;
END $$;