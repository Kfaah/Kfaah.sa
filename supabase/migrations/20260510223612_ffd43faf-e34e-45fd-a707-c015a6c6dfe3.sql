-- Baselines table
CREATE TABLE IF NOT EXISTS public.task_time_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  baseline_key text NOT NULL,           -- e.g. "source:daily_intelligence" | "category:متابعة" | "channel:call"
  avg_minutes numeric NOT NULL DEFAULT 15,
  samples integer NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, baseline_key)
);

CREATE INDEX IF NOT EXISTS idx_baselines_org_key
  ON public.task_time_baselines (organization_id, baseline_key);

ALTER TABLE public.task_time_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read baselines"
  ON public.task_time_baselines FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "service role manages baselines"
  ON public.task_time_baselines FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- EWMA upsert helper
CREATE OR REPLACE FUNCTION public._upsert_baseline(_org uuid, _key text, _actual numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_avg numeric;
BEGIN
  IF _actual IS NULL OR _actual <= 0 THEN
    RETURN;
  END IF;
  INSERT INTO public.task_time_baselines (organization_id, baseline_key, avg_minutes, samples, last_updated)
  VALUES (_org, _key, LEAST(GREATEST(_actual, 3), 240), 1, now())
  ON CONFLICT (organization_id, baseline_key) DO UPDATE
    SET avg_minutes = LEAST(GREATEST(public.task_time_baselines.avg_minutes * 0.7 + EXCLUDED.avg_minutes * 0.3, 3), 240),
        samples = public.task_time_baselines.samples + 1,
        last_updated = now();
END;
$$;

-- Trigger: when a task transitions to completed/executed, learn from actual_time_minutes
CREATE OR REPLACE FUNCTION public.tr_tasks_learn_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actual numeric;
  _src text;
  _cat text;
  _ch text;
BEGIN
  IF NEW.status NOT IN ('completed', 'executed') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Compute actual minutes (use field if present, else from started_at→now)
  _actual := NEW.actual_time_minutes;
  IF (_actual IS NULL OR _actual <= 0) AND NEW.started_at IS NOT NULL THEN
    _actual := EXTRACT(EPOCH FROM (now() - NEW.started_at)) / 60.0;
  END IF;
  IF _actual IS NULL OR _actual <= 0 THEN
    RETURN NEW;
  END IF;

  _src := NULLIF(NEW.source, '');
  _cat := NULLIF(NEW.category, '');
  _ch  := NULLIF(NEW.metadata->>'channel', '');

  IF _src IS NOT NULL THEN PERFORM public._upsert_baseline(NEW.organization_id, 'source:' || _src, _actual); END IF;
  IF _cat IS NOT NULL THEN PERFORM public._upsert_baseline(NEW.organization_id, 'category:' || _cat, _actual); END IF;
  IF _ch  IS NOT NULL THEN PERFORM public._upsert_baseline(NEW.organization_id, 'channel:' || _ch,   _actual); END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_tasks_learn_time ON public.tasks;
CREATE TRIGGER tr_tasks_learn_time
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tr_tasks_learn_time();