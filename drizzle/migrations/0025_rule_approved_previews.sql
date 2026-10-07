-- REVIEW-ONLY MIGRATION. Never run against production as part of this PR.
-- Source contract: 2841fed3f6e5ce010984b2b8444d94b6d9b2313c, migrations through 0024.
-- Creating/granting this restricted persistent role needs separate security approval.
-- Its purpose is atomic private receipts WITHOUT granting receipt-table access to clients.
-- It inherits authenticated's existing RLS and is never a table owner or BYPASSRLS role.
-- Both gates remain OFF after migration. No task/plan is changed by this migration.
BEGIN;
CREATE ROLE kfaah_rule_executor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS INHERIT;
GRANT authenticated TO kfaah_rule_executor;
CREATE SCHEMA rule_approval_private;
REVOKE ALL ON SCHEMA rule_approval_private FROM PUBLIC;
GRANT USAGE ON SCHEMA public, auth, rule_approval_private TO kfaah_rule_executor;

CREATE TABLE rule_approval_private.settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false
);
INSERT INTO rule_approval_private.settings(singleton, enabled) VALUES (true, false);
CREATE TABLE rule_approval_private.receipts (
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  review_hash text NOT NULL CHECK (review_hash ~ '^[a-f0-9]{64}$'),
  selection jsonb NOT NULL,
  result jsonb NOT NULL,
  task_origins jsonb NOT NULL CHECK (jsonb_typeof(task_origins) = 'array'),
  approved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id, review_hash)
);
REVOKE ALL ON ALL TABLES IN SCHEMA rule_approval_private FROM PUBLIC, anon, authenticated;
GRANT SELECT ON rule_approval_private.settings TO kfaah_rule_executor;
GRANT SELECT, INSERT ON rule_approval_private.receipts TO kfaah_rule_executor;
-- Defense in depth; membership in authenticated must not expose private receipt writes.
ALTER TABLE rule_approval_private.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_approval_private.receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY rule_receipt_read ON rule_approval_private.receipts FOR SELECT TO kfaah_rule_executor
  USING (auth.uid() IS NOT NULL AND public.admin_can_access_org(organization_id));
CREATE POLICY rule_receipt_insert ON rule_approval_private.receipts FOR INSERT TO kfaah_rule_executor
  WITH CHECK (user_id = auth.uid());
CREATE UNIQUE INDEX rule_approved_tasks_identity ON public.tasks(organization_id, dedupe_key)
  WHERE source = 'rules_approved' AND dedupe_key IS NOT NULL;

CREATE FUNCTION rule_approval_private.require_admin(p_org uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR p_org IS NULL OR NOT (
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role::text = 'super_admin' AND r.organization_id IS NULL)
    OR (EXISTS (SELECT 1 FROM public.user_organizations m WHERE m.user_id = auth.uid() AND m.organization_id = p_org AND m.approval_status = 'approved')
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.organization_id = p_org AND r.role::text = 'admin'))
  ) OR NOT public.admin_can_access_org(p_org) THEN
    -- Intersect strict membership/role checks with the deployed RLS helper.
    -- If historical migration ordering differs, do not assume all tasks are visible.
    RAISE EXCEPTION 'approval_forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Read only: selectors -> current authorized source -> deterministic candidates -> hash.
-- All workdays in the FULL selected month establish the denominator, even when only
-- some dates are selected. Never multiply the monthly target by filtering dates first.
CREATE FUNCTION rule_approval_private.build_review(p_selection jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  v_org uuid; v_plan_id uuid; v_month_id uuid; v_employee_id uuid;
  v_dates date[]; v_plan public.operational_plans%ROWTYPE;
  v_month public.operational_plan_months%ROWTYPE; v_employee public.employees%ROWTYPE;
  v_months jsonb; v_existing jsonb; v_tasks jsonb := '[]'; v_preserved jsonb := '[]';
  v_review jsonb; v_date date; v_target bigint; v_workdays integer; v_rank integer;
  v_template text; v_key text; v_matches jsonb; v_task jsonb;
  v_allocation jsonb; v_allocation_hash text; v_needs_review jsonb := '[]'; v_prior jsonb;
  v_executive jsonb;
  v_origins jsonb; v_origin jsonb;
BEGIN
  IF jsonb_typeof(p_selection) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_selection)) <> 5
    OR NOT p_selection ?& ARRAY['organization_id','source_plan_id','source_month_id','assigned_employee_id','task_dates']
    OR jsonb_typeof(p_selection->'task_dates') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_selection->'task_dates') NOT BETWEEN 1 AND 31 THEN
    RAISE EXCEPTION 'approval_invalid_selection';
  END IF;
  BEGIN
    v_org := (p_selection->>'organization_id')::uuid;
    v_plan_id := (p_selection->>'source_plan_id')::uuid;
    v_month_id := (p_selection->>'source_month_id')::uuid;
    v_employee_id := (p_selection->>'assigned_employee_id')::uuid;
    SELECT array_agg(value::date ORDER BY value::date) INTO v_dates
      FROM jsonb_array_elements_text(p_selection->'task_dates');
  EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'approval_invalid_selection';
  END;
  IF v_org IS NULL OR v_plan_id IS NULL OR v_month_id IS NULL OR v_employee_id IS NULL
    OR array_position(v_dates, NULL) IS NOT NULL
    OR (SELECT count(DISTINCT d) FROM unnest(v_dates) d) <> cardinality(v_dates)
    OR p_selection IS DISTINCT FROM jsonb_build_object('organization_id',v_org,'source_plan_id',v_plan_id,
      'source_month_id',v_month_id,'assigned_employee_id',v_employee_id,'task_dates',to_jsonb(v_dates)) THEN
    RAISE EXCEPTION 'approval_invalid_selection';
  END IF;
  PERFORM rule_approval_private.require_admin(v_org);
  SELECT * INTO v_plan FROM public.operational_plans WHERE id = v_plan_id AND organization_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'approval_source_not_found'; END IF;
  SELECT * INTO v_month FROM public.operational_plan_months
    WHERE id = v_month_id AND operational_plan_id = v_plan_id AND organization_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'approval_source_not_found'; END IF;
  SELECT * INTO v_employee FROM public.employees WHERE id = v_employee_id AND organization_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'approval_source_not_found'; END IF;
  IF v_plan.responsible_employee_id IS DISTINCT FROM v_employee.id OR v_employee.user_id IS NULL
    OR v_employee.is_viewer_account OR v_employee.status IS DISTINCT FROM 'active'
    OR NOT EXISTS (SELECT 1 FROM public.user_organizations m WHERE m.user_id = v_employee.user_id
      AND m.organization_id = v_org AND m.approval_status = 'approved') THEN
    RAISE EXCEPTION 'approval_source_requires_review';
  END IF;
  IF lower(btrim(v_plan.status)) IN ('completed','done','executed','cancelled','مكتمل','مكتملة')
    OR v_plan.year NOT BETWEEN 2000 AND 2100 OR v_plan.annual_target < 0 OR v_plan.annual_target > 1000000000
    OR v_plan.annual_target <> trunc(v_plan.annual_target)
    OR v_month.month NOT BETWEEN 1 AND 12 OR v_month.monthly_target <= 0
    OR v_month.monthly_target <> trunc(v_month.monthly_target)
    OR v_month.monthly_target > v_plan.annual_target THEN
    RAISE EXCEPTION 'approval_source_requires_review';
  END IF;
  -- Intentionally narrower than free-text normalization in the read-only preview.
  v_template := CASE lower(btrim(v_plan.activity_name))
    WHEN 'نشر محتوى' THEN 'content_publication' WHEN 'نشر المحتوى' THEN 'content_publication'
    WHEN 'نشر منشورات' THEN 'content_publication' WHEN 'نشر منشور' THEN 'content_publication'
    WHEN 'content publication' THEN 'content_publication' WHEN 'publish content' THEN 'content_publication'
    WHEN 'تصميم محتوى' THEN 'content_design' WHEN 'تصميم المحتوى' THEN 'content_design'
    WHEN 'تصميم منشورات' THEN 'content_design' WHEN 'تصميم منشور' THEN 'content_design' WHEN 'content design' THEN 'content_design'
    WHEN 'إعداد تقرير' THEN 'report_preparation' WHEN 'اعداد تقرير' THEN 'report_preparation'
    WHEN 'إعداد التقارير' THEN 'report_preparation' WHEN 'اعداد التقارير' THEN 'report_preparation' WHEN 'report preparation' THEN 'report_preparation'
    WHEN 'التواصل مع المتبرعين' THEN 'donor_contact' WHEN 'تواصل مع المتبرعين' THEN 'donor_contact' WHEN 'donor contact' THEN 'donor_contact'
    WHEN 'تنفيذ فعالية' THEN 'event_delivery' WHEN 'تنفيذ الفعاليات' THEN 'event_delivery' WHEN 'event delivery' THEN 'event_delivery'
    ELSE NULL END;
  IF v_template IS NULL THEN RAISE EXCEPTION 'approval_source_requires_review'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.month,m.id),'[]') INTO v_months
    FROM public.operational_plan_months m WHERE m.operational_plan_id = v_plan_id AND m.organization_id = v_org;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_months) m
      WHERE (m->>'month')::integer NOT BETWEEN 1 AND 12 OR (m->>'monthly_target')::numeric < 0
        OR (m->>'monthly_target')::numeric <> trunc((m->>'monthly_target')::numeric))
    OR (SELECT count(DISTINCT m->>'month') FROM jsonb_array_elements(v_months) m) <> jsonb_array_length(v_months)
    OR (SELECT sum((m->>'monthly_target')::numeric) FROM jsonb_array_elements(v_months) m) > v_plan.annual_target
    OR (jsonb_array_length(v_months) = 12 AND (SELECT sum((m->>'monthly_target')::numeric) FROM jsonb_array_elements(v_months) m) <> v_plan.annual_target) THEN
    RAISE EXCEPTION 'approval_source_requires_review';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_dates) d WHERE extract(year FROM d) <> v_plan.year
    OR extract(month FROM d) <> v_month.month OR extract(dow FROM d) IN (5,6)) THEN
    RAISE EXCEPTION 'approval_invalid_selection';
  END IF;
  SELECT count(*) INTO v_workdays FROM generate_series(make_date(v_plan.year,v_month.month,1)::timestamp,
    (make_date(v_plan.year,v_month.month,1) + interval '1 month - 1 day')::timestamp, interval '1 day') d
    WHERE extract(dow FROM d) NOT IN (5,6);
  v_allocation := jsonb_build_object('organization_id',v_org,'source_plan_id',v_plan_id,'source_month_id',v_month_id,
    'year',v_plan.year,'month',v_month.month,'annual_target',v_plan.annual_target,'monthly_target',v_month.monthly_target,
    'activity_name',v_plan.activity_name,'template',v_template,'assigned_employee_id',v_employee.id,'user_id',v_employee.user_id,
    'calendar',jsonb_build_object('timezone','Asia/Riyadh','weekend_days',jsonb_build_array(5,6),'excluded_dates','[]'::jsonb),
    'rule_version','plan-rules-v1','contract','rule-approved-month-v1');
  v_allocation_hash := encode(sha256(convert_to(v_allocation::text,'UTF8')),'hex');
  SELECT coalesce(jsonb_agg(to_jsonb(ep) ORDER BY ep.id),'[]') INTO v_executive
    FROM public.executive_plans ep WHERE ep.organization_id = v_org AND ep.operational_plan_month_id = v_month_id;
  -- This first write contract does not reinterpret previously scheduled or
  -- completed daily plans. A future adapter must reconcile them explicitly.
  IF jsonb_array_length(v_executive) > 0 THEN
    v_needs_review := v_needs_review || jsonb_build_array(jsonb_build_object('code','existing_daily_plans_require_review',
      'source_month_id',v_month_id,'existing_plan_count',jsonb_array_length(v_executive)));
  END IF;
  -- Provenance lives in the private immutable receipt, not in user-editable
  -- task metadata. Include approvals by other authorized admins of this org.
  SELECT coalesce(jsonb_agg(o ORDER BY o->>'id'),'[]') INTO v_origins
    FROM rule_approval_private.receipts r CROSS JOIN LATERAL jsonb_array_elements(r.task_origins) o
    WHERE r.organization_id = v_org AND r.selection->>'source_plan_id' = v_plan_id::text
      AND r.selection->>'source_month_id' = v_month_id::text;
  -- Include every linked existing row, irrespective of status, creator or source.
  -- Existing executive-plan/task links are preserved without inventing a new link.
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'status',t.status,'due_date',t.due_date,
    'dedupe_key',t.dedupe_key,'metadata',t.metadata,'phase',t.phase,'executive_plan_id',t.executive_plan_id,
    'source_activity_id',t.source_activity_id,'updated_at',t.updated_at,'source',t.source,
    'assigned_employee_id',t.assigned_employee_id,'user_id',t.user_id) ORDER BY t.id),'[]') INTO v_existing
  FROM public.tasks t WHERE t.organization_id = v_org AND (
    EXISTS (SELECT 1 FROM jsonb_array_elements(v_origins) o WHERE o->>'id' = t.id::text)
    OR
    (t.due_date >= make_date(v_plan.year,v_month.month,1) AND t.due_date < make_date(v_plan.year,v_month.month,1) + interval '1 month')
    OR t.metadata->>'source_month_id' = v_month_id::text
    OR EXISTS (SELECT 1 FROM public.executive_plans ep WHERE ep.organization_id = v_org
      AND ep.operational_plan_month_id = v_month_id AND ep.id IN (t.executive_plan_id,t.source_activity_id))) AND (
    EXISTS (SELECT 1 FROM jsonb_array_elements(v_origins) o WHERE o->>'id' = t.id::text)
    OR
    t.metadata->>'source_plan_id' = v_plan_id::text
    OR t.dedupe_key LIKE 'rule-preview:' || v_org::text || ':' || v_plan_id::text || ':%'
    OR EXISTS (SELECT 1 FROM public.executive_plans ep JOIN public.operational_plan_months pm ON pm.id = ep.operational_plan_month_id
      WHERE ep.organization_id = v_org AND pm.organization_id = v_org AND pm.operational_plan_id = v_plan_id
        AND ep.id IN (t.executive_plan_id,t.source_activity_id)));
  IF jsonb_array_length(v_existing) > 100 OR jsonb_array_length(v_executive) > 31 THEN
    RAISE EXCEPTION 'approval_source_requires_review';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_origins) o WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_existing) e WHERE e->>'id' = o->>'id')) THEN
    v_needs_review := v_needs_review || jsonb_build_array(jsonb_build_object('code','historical_task_missing'));
  END IF;
  -- Reconcile the WHOLE source month before extending a partial approval.
  -- Unknown manual/legacy coverage or a changed activity/assignment/target is
  -- never silently counted toward the new monthly allocation.
  FOR v_prior IN SELECT e FROM jsonb_array_elements(v_existing) e
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(v_origins) o WHERE o->>'id' = e->>'id')
      OR ((coalesce(nullif(e->>'phase',''),'during') = 'during' OR e->>'source' = 'rules_approved'
        OR e->'metadata'->'approval'->>'contract' = 'rule-approved-month-v1') AND (
      e->'metadata'->>'source_month_id' = v_month_id::text
      OR ((e->>'due_date')::date >= make_date(v_plan.year,v_month.month,1)
        AND (e->>'due_date')::date < make_date(v_plan.year,v_month.month,1) + interval '1 month')
      OR EXISTS (SELECT 1 FROM public.executive_plans ep WHERE ep.organization_id = v_org
        AND ep.operational_plan_month_id = v_month_id AND ep.id::text IN (e->>'executive_plan_id',e->>'source_activity_id'))))
  LOOP
    SELECT o INTO v_origin FROM jsonb_array_elements(v_origins) o WHERE o->>'id' = v_prior->>'id';
    IF v_origin IS NULL OR v_prior->>'source' IS DISTINCT FROM 'rules_approved'
      OR v_prior->>'phase' IS DISTINCT FROM 'during'
      OR v_origin->>'allocation_hash' IS DISTINCT FROM v_allocation_hash
      OR v_prior->>'due_date' IS DISTINCT FROM v_origin->>'due_date'
      OR v_prior->>'dedupe_key' IS DISTINCT FROM v_origin->>'dedupe_key'
      OR v_prior->'metadata'->'target' IS DISTINCT FROM v_origin->'target'
      OR v_prior->'metadata'->'approval'->>'allocation_hash' IS DISTINCT FROM v_allocation_hash
      OR v_prior->>'assigned_employee_id' IS DISTINCT FROM v_employee.id::text
      OR v_prior->>'user_id' IS DISTINCT FROM v_employee.user_id::text
      OR v_prior->'metadata'->>'template_id' IS DISTINCT FROM v_template || ':during'
      OR v_prior->'metadata'->>'source_plan_id' IS DISTINCT FROM v_plan_id::text
      OR v_prior->'metadata'->>'source_month_id' IS DISTINCT FROM v_month_id::text
      OR v_prior->'metadata'->>'rule_version' IS DISTINCT FROM 'plan-rules-v1'
      OR v_prior->>'due_date' IS NULL
      OR extract(year FROM (v_prior->>'due_date')::date) <> v_plan.year
      OR extract(month FROM (v_prior->>'due_date')::date) <> v_month.month
      OR extract(dow FROM (v_prior->>'due_date')::date) IN (5,6)
      OR v_prior->>'dedupe_key' IS DISTINCT FROM 'rule-preview:' || v_org::text || ':' || v_plan_id::text || ':'
        || (v_prior->>'due_date') || ':' || v_template || '%3Aduring:plan-rules-v1'
      OR (SELECT count(*) FROM jsonb_array_elements(v_existing) e WHERE e->>'due_date' = v_prior->>'due_date'
        AND coalesce(nullif(e->>'phase',''),'during') = 'during') > 1 THEN
      v_needs_review := v_needs_review || jsonb_build_array(jsonb_build_object('code','historical_allocation_requires_review','task_id',v_prior->>'id'));
    ELSE
      SELECT count(*) INTO v_rank FROM generate_series(make_date(v_plan.year,v_month.month,1)::timestamp,
        (v_prior->>'due_date')::date::timestamp,interval '1 day') d WHERE extract(dow FROM d) NOT IN (5,6);
      v_target := trunc(v_month.monthly_target / v_workdays)::bigint
        + CASE WHEN v_rank <= mod(v_month.monthly_target::bigint,v_workdays) THEN 1 ELSE 0 END;
      IF v_prior->'metadata'->'target' IS DISTINCT FROM to_jsonb(v_target) THEN
        v_needs_review := v_needs_review || jsonb_build_array(jsonb_build_object('code','historical_target_requires_review','task_id',v_prior->>'id'));
      END IF;
    END IF;
  END LOOP;
  FOREACH v_date IN ARRAY v_dates LOOP
    SELECT count(*) INTO v_rank FROM generate_series(make_date(v_plan.year,v_month.month,1)::timestamp,
      v_date::timestamp, interval '1 day') d WHERE extract(dow FROM d) NOT IN (5,6);
    v_target := trunc(v_month.monthly_target / v_workdays)::bigint
      + CASE WHEN v_rank <= mod(v_month.monthly_target::bigint,v_workdays) THEN 1 ELSE 0 END;
    IF v_target <= 0 THEN RAISE EXCEPTION 'approval_invalid_selection'; END IF;
    v_key := 'rule-preview:' || v_org::text || ':' || v_plan_id::text || ':' || v_date::text || ':' || v_template || '%3Aduring:plan-rules-v1';
    SELECT coalesce(jsonb_agg(e ORDER BY e->>'id'),'[]') INTO v_matches FROM jsonb_array_elements(v_existing) e
    WHERE e->>'dedupe_key' = v_key OR (
      e->'metadata'->>'source_plan_id' = v_plan_id::text AND (e->>'due_date')::date = v_date
      AND coalesce(nullif(e->>'phase',''),'during') = 'during')
      OR (coalesce(e->>'phase','during') = 'during' AND EXISTS (
        SELECT 1 FROM public.executive_plans ep WHERE ep.organization_id = v_org AND ep.operational_plan_month_id = v_month_id
          AND ep.day = extract(day FROM v_date) AND ep.id::text IN (e->>'executive_plan_id',e->>'source_activity_id')));
    IF jsonb_array_length(v_matches) > 0 THEN
      v_preserved := v_preserved || jsonb_build_array(jsonb_build_object('date',v_date,'existing',v_matches));
      CONTINUE;
    END IF;
    v_task := jsonb_build_object('dedupe_key',v_key,'organization_id',v_org,'assigned_employee_id',v_employee.id,
      'user_id',v_employee.user_id,'title','تنفيذ: ' || v_plan.activity_name,
      'description',v_plan.activity_name || '؛ المستهدف المعتمد لهذا اليوم: ' || v_target::text || '.',
      'due_date',v_date,'phase','during','target',v_target,'template_id',v_template || ':during',
      'status','upcoming','priority','medium','source','rules_approved','ai_generated',false,
      'metadata',jsonb_build_object('source_plan_id',v_plan_id,'source_month_id',v_month_id,
        'template_id',v_template || ':during','rule_version','plan-rules-v1','target',v_target,
        'assignment_source','explicit_responsible_employee','no_quality_assessment',true,
        'evidence',jsonb_build_object('source_plan_id',v_plan_id,'source_month_id',v_month_id,
          'annual_target',v_plan.annual_target,'monthly_target',v_month.monthly_target,
          'allocation','explicit_monthly_target','daily_allocation','largest_remainder_equal_workdays','rule_version','plan-rules-v1')));
    v_tasks := v_tasks || jsonb_build_array(v_task);
  END LOOP;
  v_review := jsonb_build_object('contract','rule-approved-month-v1','user_id',auth.uid(),'selection',p_selection,
    'calendar',jsonb_build_object('timezone','Asia/Riyadh','weekend_days',jsonb_build_array(5,6),'excluded_dates','[]'::jsonb),
    'source_plan',to_jsonb(v_plan),'source_months',v_months,
    'employee',jsonb_build_object('id',v_employee.id,'organization_id',v_employee.organization_id,'user_id',v_employee.user_id,
      'full_name',v_employee.full_name,'status',v_employee.status,'is_viewer_account',v_employee.is_viewer_account,'updated_at',v_employee.updated_at),
    'tasks',v_tasks,'preserved_tasks',v_preserved,'existing_tasks',v_existing,'needs_review',v_needs_review,
    'can_commit',jsonb_array_length(v_needs_review) = 0,'allocation_hash',v_allocation_hash,
    'existing_executive_plans',v_executive,'prior_approved_tasks',v_origins);
  RETURN jsonb_build_object('review_json',v_review::text,'review_hash',encode(sha256(convert_to(v_review::text,'UTF8')),'hex'));
END;
$$;

CREATE FUNCTION public.review_rule_month(p_selection jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = on
SET TimeZone = 'UTC' SET DateStyle = 'ISO, YMD' AS $$
BEGIN
  RETURN rule_approval_private.build_review(p_selection) || jsonb_build_object('database_enabled',
    coalesce((SELECT enabled FROM rule_approval_private.settings WHERE singleton),false));
END;
$$;

CREATE FUNCTION rule_approval_private.require_safe_task_insert() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $$
DECLARE v_allowed_source text := 'BEGIN IF NEW.organization_id IS NULL THEN NEW.organization_id := public.get_user_organization_id(auth.uid()); END IF; RETURN NEW; END;';
BEGIN
  -- Compare OID, trigger structure, language and the complete audited function body.
  -- A name alone is not an authorization to execute changed code. No client allowlist.
  IF NOT row_security_active('public.tasks'::regclass)
    OR NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
      WHERE c.oid = 'public.tasks'::regclass AND c.relkind = 'r' AND c.relrowsecurity
        AND r.rolname <> current_user)
    OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolbypassrls))
    OR EXISTS (SELECT 1 FROM pg_rewrite WHERE ev_class = 'public.tasks'::regclass AND rulename <> '_RETURN')
    OR EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_language l ON l.oid = p.prolang
      WHERE t.tgrelid = 'public.tasks'::regclass AND NOT t.tgisinternal AND t.tgenabled <> 'D' AND (t.tgtype::integer & 4) = 4
      AND NOT (t.tgname = 'set_org_id_tasks' AND t.tgtype = 7 AND t.tgnargs = 0 AND t.tgqual IS NULL
        AND t.tgfoid = to_regprocedure('public.set_organization_id_on_insert()') AND l.lanname = 'plpgsql'
        AND encode(sha256(convert_to(regexp_replace(p.prosrc,'[[:space:]]','','g'),'UTF8')),'hex')
          = encode(sha256(convert_to(regexp_replace(v_allowed_source,'[[:space:]]','','g'),'UTF8')),'hex')))
    OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.tasks'::regclass AND attname = 'due_date' AND atttypid = 'date'::regtype)
    -- Every current column is supplied explicitly below. An added column could
    -- introduce an unreviewed default/generated expression: require a new audit.
    OR (SELECT array_agg(attname::text ORDER BY attname) FROM pg_attribute
      WHERE attrelid = 'public.tasks'::regclass AND attnum > 0 AND NOT attisdropped)
      IS DISTINCT FROM ARRAY['actual_time_minutes','ai_generated','assigned_employee_id','category','completed_at',
        'completion_percentage','created_at','dedupe_key','description','due_date','estimated_time_minutes','executive_plan_id',
        'id','metadata','organization_id','phase','priority','quality_percentage','source','source_activity_id','started_at',
        'status','title','updated_at','user_id']::text[]
    OR EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_depend d ON d.classid = 'pg_constraint'::regclass AND d.objid = c.oid
      JOIN pg_proc p ON d.refclassid = 'pg_proc'::regclass AND p.oid = d.refobjid
      WHERE c.conrelid = 'public.tasks'::regclass AND p.pronamespace <> 'pg_catalog'::regnamespace)
    OR EXISTS (SELECT 1 FROM pg_index i JOIN pg_depend d ON d.classid = 'pg_class'::regclass AND d.objid = i.indexrelid
      JOIN pg_proc p ON d.refclassid = 'pg_proc'::regclass AND p.oid = d.refobjid
      WHERE i.indrelid = 'public.tasks'::regclass AND p.pronamespace <> 'pg_catalog'::regnamespace) THEN
    RAISE EXCEPTION 'approval_unsafe_database_hooks';
  END IF;
END;
$$;

CREATE FUNCTION public.apply_rule_month(p_selection jsonb, p_review_hash text, p_confirmed boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = on
SET TimeZone = 'UTC' SET DateStyle = 'ISO, YMD' SET lock_timeout = '2s' SET statement_timeout = '5s' AS $$
DECLARE
  v_org uuid; v_review jsonb; v_packet jsonb; v_existing rule_approval_private.receipts%ROWTYPE;
  v_task jsonb; v_id uuid; v_created uuid[] := '{}'; v_result jsonb;
  v_origins jsonb := '[]';
BEGIN
  IF p_confirmed IS DISTINCT FROM true OR p_review_hash IS NULL OR p_review_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'approval_confirmation_required';
  END IF;
  v_org := (p_selection->>'organization_id')::uuid;
  PERFORM rule_approval_private.require_admin(v_org);
  IF NOT coalesce((SELECT enabled FROM rule_approval_private.settings WHERE singleton),false) THEN
    RAISE EXCEPTION 'approval_persistence_disabled';
  END IF;
  -- Serializable decision under a short bounded table lock. This also excludes
  -- manual/legacy inserts, source edits, role revocations and source-month phantoms.
  LOCK TABLE public.operational_plans, public.operational_plan_months, public.employees,
    public.executive_plans, public.user_organizations, public.user_roles IN SHARE MODE;
  LOCK TABLE public.tasks IN SHARE ROW EXCLUSIVE MODE;
  PERFORM rule_approval_private.require_admin(v_org);
  SELECT * INTO v_existing FROM rule_approval_private.receipts
    WHERE organization_id = v_org AND user_id = auth.uid() AND review_hash = p_review_hash;
  IF FOUND THEN
    IF v_existing.selection IS DISTINCT FROM p_selection THEN RAISE EXCEPTION 'approval_stale_review'; END IF;
    RETURN v_existing.result || jsonb_build_object('status','already_applied','writes_performed',0,'created_tasks',0);
  END IF;
  PERFORM rule_approval_private.require_safe_task_insert();
  v_packet := rule_approval_private.build_review(p_selection);
  IF v_packet->>'review_hash' IS DISTINCT FROM p_review_hash THEN RAISE EXCEPTION 'approval_stale_review'; END IF;
  v_review := (v_packet->>'review_json')::jsonb;
  IF v_review->>'can_commit' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'approval_source_requires_review'; END IF;
  FOR v_task IN SELECT value FROM jsonb_array_elements(v_review->'tasks') LOOP
    INSERT INTO public.tasks (id,organization_id,user_id,assigned_employee_id,title,description,due_date,
      priority,status,source,ai_generated,phase,dedupe_key,metadata,executive_plan_id,source_activity_id,
      category,actual_time_minutes,completed_at,completion_percentage,estimated_time_minutes,quality_percentage,
      started_at,created_at,updated_at)
    VALUES (gen_random_uuid(),v_org,(v_task->>'user_id')::uuid,(v_task->>'assigned_employee_id')::uuid,
      v_task->>'title',v_task->>'description',(v_task->>'due_date')::date,'medium','upcoming','rules_approved',false,
      'during',v_task->>'dedupe_key',(v_task->'metadata') || jsonb_build_object('approval',jsonb_build_object(
        'review_hash',p_review_hash,'approved_by',auth.uid(),'contract','rule-approved-month-v1',
        'allocation_hash',v_review->>'allocation_hash')),
      NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,now(),now()) RETURNING id INTO v_id;
    v_created := array_append(v_created,v_id);
    v_origins := v_origins || jsonb_build_array(jsonb_build_object('id',v_id,'due_date',v_task->>'due_date',
      'dedupe_key',v_task->>'dedupe_key','target',v_task->'target','assigned_employee_id',v_task->>'assigned_employee_id',
      'user_id',v_task->>'user_id','allocation_hash',v_review->>'allocation_hash'));
  END LOOP;
  v_result := jsonb_build_object('status','applied','organization_id',v_org,'user_id',auth.uid(),
    'review_hash',p_review_hash,'created_tasks',cardinality(v_created),'task_ids',to_jsonb(v_created),
    'preserved_dates',jsonb_array_length(v_review->'preserved_tasks'),'writes_performed',cardinality(v_created),
    'notifications_sent',0,'plans_created',0);
  INSERT INTO rule_approval_private.receipts(organization_id,user_id,review_hash,selection,result,task_origins)
    VALUES (v_org,auth.uid(),p_review_hash,p_selection,v_result,v_origins);
  RETURN v_result;
END;
$$;

-- Private helpers are never a direct RPC capability. Owners are not table owners.
ALTER FUNCTION rule_approval_private.require_admin(uuid) OWNER TO kfaah_rule_executor;
ALTER FUNCTION rule_approval_private.build_review(jsonb) OWNER TO kfaah_rule_executor;
ALTER FUNCTION rule_approval_private.require_safe_task_insert() OWNER TO kfaah_rule_executor;
ALTER FUNCTION public.review_rule_month(jsonb) OWNER TO kfaah_rule_executor;
ALTER FUNCTION public.apply_rule_month(jsonb,text,boolean) OWNER TO kfaah_rule_executor;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rule_approval_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_rule_month(jsonb), public.apply_rule_month(jsonb,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_rule_month(jsonb), public.apply_rule_month(jsonb,text,boolean) TO authenticated;
COMMIT;
