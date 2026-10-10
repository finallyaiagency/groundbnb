-- M1-01M dormant financial boundary. Prepared only for pinned synthetic local/preview.
-- No provider rates are seeded and this migration grants no app execution authority.
BEGIN;
DO $$
DECLARE e record; app_role text; role_record record;
BEGIN
  IF current_database()<>'groundbnb' THEN RAISE EXCEPTION 'Expected groundbnb database'; END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  IF app_role IS NULL OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0003_profile_domain') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0004_profile_operation_status') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0005_profile_records') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0006_profile_transfer') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0007_membership_foundation') OR
     EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0008_provider_reservations') THEN
    RAISE EXCEPTION 'Requires pinned local/preview with exact 0001-0007 baseline and no prior 0008';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user")<>1 OR NOT EXISTS(
       SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires sole verified synthetic Auth fixture';
  END IF;
  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=app_role;
  IF NOT role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole OR
     role_record.rolreplication OR role_record.rolbypassrls OR role_record.rolinherit OR role_record.rolconnlimit<>4 OR
     NOT (role_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=role_record.oid) OR
     has_database_privilege(role_record.oid,current_database(),'CREATE') OR has_schema_privilege(role_record.oid,'groundbnb','CREATE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.read_profile(text,text)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile(text,text,uuid,bigint,jsonb)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.read_profile_operation(text,text,uuid)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m') AND c.relname NOT IN ('environment_identity','schema_migrations')
       AND has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
    RAISE EXCEPTION 'Pinned app-role or existing function-only ACL differs from approved baseline';
  END IF;
END $$;

CREATE TABLE groundbnb.financial_policy_versions (
  policy_version_id uuid PRIMARY KEY,
  version_key text NOT NULL UNIQUE CHECK(version_key ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  status text NOT NULL CHECK(status IN ('active','retired')),
  commercial_mode text NOT NULL CHECK(commercial_mode IN ('report_only','enforced')),
  application_daily_cap_usd numeric(20,9) NOT NULL CHECK(application_daily_cap_usd>=0),
  application_daily_held_usd numeric(20,9) NOT NULL CHECK(application_daily_held_usd>=0),
  application_monthly_cap_usd numeric(20,9) NOT NULL CHECK(application_monthly_cap_usd>=0),
  application_monthly_held_usd numeric(20,9) NOT NULL CHECK(application_monthly_held_usd>=0),
  free_pool_daily_cap_usd numeric(20,9) NOT NULL CHECK(free_pool_daily_cap_usd>=0),
  provider_rate_policy text NOT NULL CHECK(provider_rate_policy='official_review_required'),
  created_at timestamptz NOT NULL CHECK (isfinite(created_at)),
  source_spec text NOT NULL CHECK(source_spec='Groundbnb_Route_Planner_Agency_Spec_v3.0.md'),
  CHECK(application_daily_cap_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) AND
    application_daily_held_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) AND
    application_monthly_cap_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) AND
    application_monthly_held_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) AND
    free_pool_daily_cap_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)),
  CHECK(application_daily_held_usd<=application_daily_cap_usd),
  CHECK(application_monthly_held_usd<=application_monthly_cap_usd)
);
CREATE UNIQUE INDEX financial_one_active_policy_idx ON groundbnb.financial_policy_versions((status)) WHERE status='active';
CREATE TABLE groundbnb.financial_dispatch_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  mode text NOT NULL CHECK(mode IN ('normal','paused')),
  policy_version_id uuid NOT NULL REFERENCES groundbnb.financial_policy_versions(policy_version_id) ON DELETE RESTRICT,
  changed_by uuid REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  change_reason text,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(updated_at))
);
CREATE TABLE groundbnb.financial_control_audit (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_account_id uuid NOT NULL REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  previous_mode text NOT NULL CHECK(previous_mode IN ('normal','paused')),
  new_mode text NOT NULL CHECK(new_mode IN ('normal','paused')),
  previous_policy_version_id uuid NOT NULL REFERENCES groundbnb.financial_policy_versions(policy_version_id) ON DELETE RESTRICT,
  new_policy_version_id uuid NOT NULL REFERENCES groundbnb.financial_policy_versions(policy_version_id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 500),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(changed_at))
);

CREATE TABLE groundbnb.financial_plan_budgets (
  plan_version_id uuid PRIMARY KEY REFERENCES groundbnb.membership_plan_versions(version_id) ON DELETE RESTRICT,
  account_period text NOT NULL CHECK(account_period IN ('day','calendar_month')),
  base_ai_usd numeric(20,9) NOT NULL CHECK(base_ai_usd>=0),
  grace_ai_usd numeric(20,9) NOT NULL CHECK(grace_ai_usd>=0),
  grace_request_limit integer NOT NULL CHECK(grace_request_limit>=0),
  held_emergency_usd numeric(20,9) NOT NULL CHECK(held_emergency_usd>=0),
  hard_ai_usd numeric(20,9) NOT NULL CHECK(hard_ai_usd>=0),
  daily_provider_cap_usd numeric(20,9) NOT NULL CHECK(daily_provider_cap_usd>=0),
  ordinary_request_limit integer,
  max_concurrent_jobs integer NOT NULL CHECK(max_concurrent_jobs BETWEEN 1 AND 100),
  CHECK(ordinary_request_limit IS NULL OR ordinary_request_limit>=0),
  CHECK(base_ai_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) AND
    grace_ai_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) AND
    held_emergency_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) AND
    hard_ai_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) AND
    daily_provider_cap_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)),
  CHECK(base_ai_usd+grace_ai_usd+held_emergency_usd=hard_ai_usd),
  CHECK((account_period='day' AND ordinary_request_limit IS NOT NULL) OR
        (account_period='calendar_month' AND ordinary_request_limit IS NULL))
);

-- A configured rate requires dated official provenance. This migration intentionally seeds none.
CREATE TABLE groundbnb.provider_rate_versions (
  rate_version_id uuid PRIMARY KEY,
  provider_key text NOT NULL CHECK(provider_key ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  model_key text NOT NULL CHECK(model_key ~ '^[a-z0-9][a-z0-9._:-]{0,127}$'),
  status text NOT NULL CHECK(status IN ('unconfigured','active','retired')),
  source_url text,
  checked_at timestamptz,
  checked_by text,
  release_date date,
  UNIQUE(rate_version_id,provider_key,model_key),
  CHECK((status='unconfigured' AND source_url IS NULL AND checked_at IS NULL AND checked_by IS NULL AND release_date IS NULL) OR
        (status IN ('active','retired') AND source_url IS NOT NULL AND source_url ~ '^https://' AND
          checked_at IS NOT NULL AND isfinite(checked_at) AND checked_by IS NOT NULL AND
          length(btrim(checked_by)) BETWEEN 1 AND 200 AND release_date IS NOT NULL AND isfinite(release_date)))
);
CREATE TABLE groundbnb.provider_rate_components (
  rate_version_id uuid NOT NULL REFERENCES groundbnb.provider_rate_versions(rate_version_id) ON DELETE RESTRICT,
  component_key text NOT NULL CHECK(component_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  unit_name text NOT NULL CHECK(unit_name IN ('token','request','character','unit')),
  price_per_million_usd numeric(20,9) NOT NULL CHECK(price_per_million_usd>=0 AND
    price_per_million_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)),
  accounting_note text NOT NULL CHECK(length(btrim(accounting_note)) BETWEEN 1 AND 500),
  PRIMARY KEY(rate_version_id,component_key)
);
CREATE TABLE groundbnb.provider_financial_limit_versions (
  limit_version_id uuid PRIMARY KEY,
  provider_key text NOT NULL CHECK(provider_key ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  status text NOT NULL CHECK(status IN ('unconfigured','active','retired')),
  daily_cap_usd numeric(20,9),
  monthly_cap_usd numeric(20,9),
  source_url text,
  checked_at timestamptz,
  checked_by text,
  release_date date,
  UNIQUE(limit_version_id,provider_key),
  CHECK((status='unconfigured' AND daily_cap_usd IS NULL AND monthly_cap_usd IS NULL AND
          source_url IS NULL AND checked_at IS NULL AND checked_by IS NULL AND release_date IS NULL) OR
        (status IN ('active','retired') AND daily_cap_usd IS NOT NULL AND monthly_cap_usd IS NOT NULL AND
          daily_cap_usd>=0 AND monthly_cap_usd>=0 AND
          daily_cap_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) AND
          monthly_cap_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) AND
          source_url IS NOT NULL AND source_url ~ '^https://' AND checked_at IS NOT NULL AND isfinite(checked_at) AND
          checked_by IS NOT NULL AND length(btrim(checked_by)) BETWEEN 1 AND 200 AND release_date IS NOT NULL AND isfinite(release_date)))
);
CREATE UNIQUE INDEX provider_single_active_limit_idx ON groundbnb.provider_financial_limit_versions(provider_key)
  WHERE status='active';

CREATE TABLE groundbnb.provider_usage_windows (
  scope_kind text NOT NULL CHECK(scope_kind IN ('account','provider','application','free_pool')),
  scope_key text NOT NULL,
  period_kind text NOT NULL CHECK(period_kind IN ('day','calendar_month')),
  period_key date NOT NULL,
  limit_state text NOT NULL CHECK(limit_state IN ('configured','unlimited','not_configured')),
  cap_usd numeric(20,9),
  held_usd numeric(20,9),
  spent_usd numeric(20,9) NOT NULL DEFAULT 0 CHECK(spent_usd>=0),
  pending_usd numeric(20,9) NOT NULL DEFAULT 0 CHECK(pending_usd>=0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(updated_at)),
  PRIMARY KEY(scope_kind,scope_key,period_kind,period_key),
  CHECK((period_kind='day' AND period_key=date_trunc('day',period_key::timestamp)::date) OR
        (period_kind='calendar_month' AND extract(day FROM period_key)=1)),
  CHECK((limit_state='configured' AND cap_usd IS NOT NULL AND held_usd IS NOT NULL AND
        cap_usd>=0 AND held_usd BETWEEN 0 AND cap_usd AND
        cap_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) AND
        held_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)) OR
        (limit_state='unlimited' AND cap_usd IS NULL AND held_usd IS NULL) OR
        (limit_state='not_configured' AND cap_usd IS NULL AND held_usd IS NULL)),
  CHECK(spent_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) AND
    pending_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric))
);

CREATE TABLE groundbnb.provider_operations (
  account_id uuid NOT NULL REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  operation_id uuid NOT NULL,
  request_identity jsonb NOT NULL CHECK(jsonb_typeof(request_identity)='object'),
  policy_version_id uuid NOT NULL REFERENCES groundbnb.financial_policy_versions(policy_version_id) ON DELETE RESTRICT,
  plan_version_id uuid NOT NULL REFERENCES groundbnb.membership_plan_versions(version_id) ON DELETE RESTRICT,
  account_period text NOT NULL CHECK(account_period IN ('day','calendar_month')),
  account_period_key date NOT NULL,
  prompt_bucket text NOT NULL CHECK(prompt_bucket IN ('base','grace')),
  prompt_state text NOT NULL CHECK(prompt_state IN ('reserved','dispatched','released')),
  status text NOT NULL CHECK(status IN ('active','complete','needs_reconciliation','released')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(created_at)),
  dispatched_at timestamptz,
  closed_at timestamptz,
  PRIMARY KEY(account_id,operation_id),
  CHECK((prompt_state='dispatched')=(dispatched_at IS NOT NULL)),
  CHECK((status IN ('complete','released') AND closed_at IS NOT NULL AND isfinite(closed_at)) OR
        (status IN ('active','needs_reconciliation') AND closed_at IS NULL)),
  CHECK(dispatched_at IS NULL OR isfinite(dispatched_at))
);
CREATE INDEX provider_operations_concurrency_idx ON groundbnb.provider_operations(account_id,status)
  WHERE status IN ('active','needs_reconciliation');

CREATE TABLE groundbnb.provider_attempt_reservations (
  attempt_id uuid PRIMARY KEY,
  account_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  provider_key text NOT NULL,
  model_key text NOT NULL,
  rate_version_id uuid NOT NULL,
  request_units jsonb NOT NULL CHECK(jsonb_typeof(request_units)='object'),
  maximum_cost_usd numeric(20,9) NOT NULL CHECK(maximum_cost_usd>=0),
  actual_cost_usd numeric(20,9),
  actual_units jsonb,
  window_keys jsonb NOT NULL CHECK(jsonb_typeof(window_keys)='array'),
  status text NOT NULL CHECK(status IN ('reserved','dispatched','settled','released','needs_reconciliation')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  dispatched_at timestamptz,
  settled_at timestamptz,
  FOREIGN KEY(account_id,operation_id) REFERENCES groundbnb.provider_operations(account_id,operation_id) ON DELETE RESTRICT,
  FOREIGN KEY(rate_version_id,provider_key,model_key) REFERENCES groundbnb.provider_rate_versions(rate_version_id,provider_key,model_key) ON DELETE RESTRICT,
  policy_version_id uuid NOT NULL REFERENCES groundbnb.financial_policy_versions(policy_version_id) ON DELETE RESTRICT,
  plan_version_id uuid NOT NULL REFERENCES groundbnb.membership_plan_versions(version_id) ON DELETE RESTRICT,
  limit_version_id uuid NOT NULL,
  FOREIGN KEY(limit_version_id,provider_key) REFERENCES groundbnb.provider_financial_limit_versions(limit_version_id,provider_key) ON DELETE RESTRICT,
  reserve_acknowledgment jsonb NOT NULL,
  dispatch_acknowledgment jsonb,
  settlement_acknowledgment jsonb,
  CHECK(maximum_cost_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) AND
    (actual_cost_usd IS NULL OR (actual_cost_usd>=0 AND
      actual_cost_usd NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)))),
  CHECK((status='dispatched')=(dispatched_at IS NOT NULL) OR
        (status IN ('settled','needs_reconciliation') AND dispatched_at IS NOT NULL) OR
        (status='released' AND dispatched_at IS NULL)),
  CHECK(status NOT IN ('settled','released') OR settled_at IS NOT NULL),
  CHECK(isfinite(created_at) AND (dispatched_at IS NULL OR isfinite(dispatched_at)) AND
    (settled_at IS NULL OR isfinite(settled_at)))
);
CREATE INDEX provider_attempts_operation_idx ON groundbnb.provider_attempt_reservations(account_id,operation_id,created_at);

CREATE FUNCTION groundbnb._financial_version_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Published financial versions are immutable'; END $$;
CREATE TRIGGER financial_policy_immutable BEFORE UPDATE OR DELETE ON groundbnb.financial_policy_versions
  FOR EACH ROW EXECUTE FUNCTION groundbnb._financial_version_immutable();
CREATE TRIGGER financial_plan_budget_immutable BEFORE UPDATE OR DELETE ON groundbnb.financial_plan_budgets
  FOR EACH ROW EXECUTE FUNCTION groundbnb._financial_version_immutable();
CREATE TRIGGER provider_rate_component_immutable BEFORE UPDATE OR DELETE ON groundbnb.provider_rate_components
  FOR EACH ROW EXECUTE FUNCTION groundbnb._financial_version_immutable();
CREATE FUNCTION groundbnb._provider_rate_version_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Provider rate versions are immutable'; END IF;
  IF ROW(NEW.rate_version_id,NEW.provider_key,NEW.model_key,NEW.source_url,NEW.checked_at,
      NEW.checked_by,NEW.release_date) IS DISTINCT FROM ROW(OLD.rate_version_id,OLD.provider_key,OLD.model_key,
      OLD.source_url,OLD.checked_at,OLD.checked_by,OLD.release_date) OR
      NOT (OLD.status='active' AND NEW.status='retired') THEN
    RAISE EXCEPTION 'Provider rate versions are immutable; retirement only disables an active version';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER provider_rate_version_guard BEFORE UPDATE OR DELETE ON groundbnb.provider_rate_versions
  FOR EACH ROW EXECUTE FUNCTION groundbnb._provider_rate_version_guard();
CREATE UNIQUE INDEX provider_single_active_rate_idx ON groundbnb.provider_rate_versions(provider_key,model_key)
  WHERE status='active';
CREATE FUNCTION groundbnb._provider_limit_version_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Provider limit versions are immutable'; END IF;
  IF ROW(NEW.limit_version_id,NEW.provider_key,NEW.daily_cap_usd,NEW.monthly_cap_usd,NEW.source_url,
      NEW.checked_at,NEW.checked_by,NEW.release_date) IS DISTINCT FROM ROW(OLD.limit_version_id,OLD.provider_key,
      OLD.daily_cap_usd,OLD.monthly_cap_usd,OLD.source_url,OLD.checked_at,OLD.checked_by,OLD.release_date) OR
      NOT (OLD.status='active' AND NEW.status='retired') THEN
    RAISE EXCEPTION 'Provider limit versions are immutable; retirement only disables an active version';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER provider_limit_version_guard BEFORE UPDATE OR DELETE ON groundbnb.provider_financial_limit_versions
  FOR EACH ROW EXECUTE FUNCTION groundbnb._provider_limit_version_guard();
CREATE FUNCTION groundbnb._financial_control_audit() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'Financial control row is retained'; END IF;
  IF NEW.changed_by IS NULL OR NEW.change_reason IS NULL OR length(btrim(NEW.change_reason)) NOT BETWEEN 1 AND 500 OR
      (NEW.mode=OLD.mode AND NEW.policy_version_id=OLD.policy_version_id) THEN
    RAISE EXCEPTION 'Financial control change requires an actor, reason, and actual change';
  END IF;
  INSERT INTO groundbnb.financial_control_audit(actor_account_id,previous_mode,new_mode,
    previous_policy_version_id,new_policy_version_id,reason)
  VALUES(NEW.changed_by,OLD.mode,NEW.mode,OLD.policy_version_id,NEW.policy_version_id,NEW.change_reason);
  NEW.updated_at:=clock_timestamp();
  RETURN NEW;
END $$;
CREATE FUNCTION groundbnb._financial_audit_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Financial control audit is append-only'; END $$;
CREATE TRIGGER financial_control_audit_guard BEFORE UPDATE OR DELETE ON groundbnb.financial_control_audit
  FOR EACH ROW EXECUTE FUNCTION groundbnb._financial_audit_immutable();
CREATE TRIGGER financial_control_change_guard BEFORE UPDATE OR DELETE ON groundbnb.financial_dispatch_control
  FOR EACH ROW EXECUTE FUNCTION groundbnb._financial_control_audit();

CREATE FUNCTION groundbnb._provider_cost(rate_uuid uuid, units jsonb) RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE rate_row record; component record; unit_value numeric; total numeric:=0; component_count integer;
BEGIN
  IF units IS NULL OR jsonb_typeof(units)<>'object' OR octet_length(units::text)>4096 THEN RETURN NULL; END IF;
  SELECT * INTO rate_row FROM groundbnb.provider_rate_versions r
    -- Settlements retain the reviewed terms pinned by the attempt even after a rate is retired.
    WHERE r.rate_version_id=rate_uuid AND r.status IN ('active','retired') AND r.source_url ~ '^https://'
      AND r.checked_at IS NOT NULL AND r.release_date IS NOT NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO component_count FROM groundbnb.provider_rate_components c WHERE c.rate_version_id=rate_uuid;
  IF component_count=0 OR component_count<>(SELECT count(*) FROM jsonb_object_keys(units)) THEN RETURN NULL; END IF;
  FOR component IN SELECT c.component_key,c.price_per_million_usd FROM groundbnb.provider_rate_components c
      WHERE c.rate_version_id=rate_uuid ORDER BY c.component_key LOOP
    IF NOT (units ? component.component_key) OR jsonb_typeof(units->component.component_key)<>'number' OR
       (units->>component.component_key)!~'^(0|[1-9][0-9]{0,8})$' THEN RETURN NULL; END IF;
    unit_value:=(units->>component.component_key)::numeric;
    -- Ceil each additive line to one nanodollar so a fractional USD cost never rounds down.
    total:=total+ceil(unit_value*component.price_per_million_usd*1000)/1000000000;
  END LOOP;
  RETURN total;
END $$;

CREATE FUNCTION groundbnb.reserve_provider_attempt(identity_issuer text,identity_subject text,
  operation_uuid uuid,attempt_uuid uuid,provider text,model text,rate_uuid uuid,requested_units jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; account_row record; control_row record; policy_row record; plan_row record;
  rate_row record; limit_row record; selected_plan record; operation_row record; attempt_row record;
  request_key jsonb; cost_max numeric;
  receipt jsonb;
  day_key date; month_key date; prompt_bucket_value text; base_used numeric; grace_used numeric;
  reserved_prompts integer; grace_prompts integer; active_jobs integer; windows jsonb; w record; window_row record;
BEGIN
  account_uuid:=groundbnb._profile_account(identity_issuer,identity_subject);
  IF account_uuid IS NULL THEN RETURN jsonb_build_object('ok',false,'category','auth'); END IF;
  IF operation_uuid IS NULL OR attempt_uuid IS NULL OR provider !~ '^[a-z0-9][a-z0-9._-]{0,63}$' OR
     model !~ '^[a-z0-9][a-z0-9._:-]{0,127}$' OR requested_units IS NULL OR jsonb_typeof(requested_units)<>'object' OR
     octet_length(requested_units::text)>4096 THEN RETURN jsonb_build_object('ok',false,'category','validation'); END IF;
  request_key:=jsonb_build_object('provider',provider,'model',model,'rateVersionId',rate_uuid,'units',requested_units);

  -- Existing receipts are immutable and do not authorize dispatch; return exact reserve evidence first.
  SELECT * INTO attempt_row FROM groundbnb.provider_attempt_reservations WHERE attempt_id=attempt_uuid;
  IF FOUND THEN
    SELECT * INTO account_row FROM groundbnb.accounts WHERE id=account_uuid;
    IF NOT FOUND OR account_row.status<>'active' THEN RETURN jsonb_build_object('ok',false,'category','auth'); END IF;
    IF attempt_row.account_id<>account_uuid OR attempt_row.operation_id<>operation_uuid OR
       attempt_row.provider_key<>provider OR attempt_row.model_key<>model OR
       attempt_row.rate_version_id<>rate_uuid OR attempt_row.request_units<>requested_units THEN
      RETURN jsonb_build_object('ok',false,'category','idempotency_conflict');
    END IF;
    RETURN attempt_row.reserve_acknowledgment;
  END IF;

  -- Reserve and first-dispatch paths lock shared configuration in the same order.
  SELECT * INTO control_row FROM groundbnb.financial_dispatch_control WHERE singleton FOR SHARE;
  IF NOT FOUND OR control_row.mode<>'normal' THEN RETURN jsonb_build_object('ok',false,'category','paused'); END IF;
  SELECT * INTO policy_row FROM groundbnb.financial_policy_versions
    WHERE policy_version_id=control_row.policy_version_id AND status='active' FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'category','paused'); END IF;
  SELECT * INTO rate_row FROM groundbnb.provider_rate_versions
    WHERE rate_version_id=rate_uuid AND provider_key=provider AND model_key=model AND status='active'
      AND checked_at IS NOT NULL AND isfinite(checked_at) AND source_url IS NOT NULL AND source_url ~ '^https://'
    FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'category','rate_unconfigured'); END IF;
  SELECT * INTO limit_row FROM groundbnb.provider_financial_limit_versions
    WHERE provider_key=provider AND status='active' AND daily_cap_usd IS NOT NULL AND monthly_cap_usd IS NOT NULL
    FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'category','provider_limit_unconfigured'); END IF;
  cost_max:=groundbnb._provider_cost(rate_uuid,requested_units);
  IF cost_max IS NULL THEN RETURN jsonb_build_object('ok',false,'category','rate_unconfigured'); END IF;
  IF cost_max<=0 OR cost_max>99999999999.999999999 THEN
    RETURN jsonb_build_object('ok',false,'category','invalid_cost_bound');
  END IF;

  SELECT * INTO account_row FROM groundbnb.accounts WHERE id=account_uuid FOR UPDATE;
  IF NOT FOUND OR account_row.status<>'active' THEN RETURN jsonb_build_object('ok',false,'category','auth'); END IF;
  -- Recheck after account/config locks to close the concurrent same-attempt insert race.
  SELECT * INTO attempt_row FROM groundbnb.provider_attempt_reservations WHERE attempt_id=attempt_uuid FOR UPDATE;
  IF FOUND THEN
    IF attempt_row.account_id<>account_uuid OR attempt_row.operation_id<>operation_uuid OR
       attempt_row.provider_key<>provider OR attempt_row.model_key<>model OR
       attempt_row.rate_version_id<>rate_uuid OR attempt_row.request_units<>requested_units THEN
      RETURN jsonb_build_object('ok',false,'category','idempotency_conflict');
    END IF;
    RETURN attempt_row.reserve_acknowledgment;
  END IF;

  -- v1 supports the lifetime overlay only; it never edits the base assignment.
  SELECT chosen.plan_key,chosen.plan_version_id INTO selected_plan FROM (
    SELECT p.plan_key,pv.version_id AS plan_version_id,a.effective_from,0 AS priority,a.assignment_id::text AS stable_id
      FROM groundbnb.membership_assignments a
      JOIN groundbnb.membership_plan_versions pv ON pv.version_id=a.plan_version_id
      JOIN groundbnb.membership_plans p ON p.plan_id=pv.plan_id
      WHERE a.account_id=account_uuid AND a.status='active' AND a.effective_from<=clock_timestamp()
        AND (a.effective_until IS NULL OR a.effective_until>clock_timestamp()) AND p.status='active'
    UNION ALL
    SELECT p.plan_key,pv.version_id,g.starts_at,1,g.grant_id::text
      FROM groundbnb.access_grants g
      JOIN groundbnb.membership_plan_versions pv ON pv.version_id=g.plan_version_id
      JOIN groundbnb.membership_plans p ON p.plan_id=pv.plan_id
      WHERE g.account_id=account_uuid AND g.grant_type='lifetime' AND g.revoked_at IS NULL
        AND g.starts_at<=clock_timestamp() AND p.status='active'
  ) chosen ORDER BY chosen.priority DESC,chosen.effective_from DESC,chosen.stable_id LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'category','membership_unavailable'); END IF;
  SELECT * INTO plan_row FROM groundbnb.financial_plan_budgets WHERE plan_version_id=selected_plan.plan_version_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'category','budget_unconfigured'); END IF;
  SELECT * INTO operation_row FROM groundbnb.provider_operations
    WHERE account_id=account_uuid AND operation_id=operation_uuid FOR UPDATE;
  IF FOUND AND operation_row.status NOT IN ('active','needs_reconciliation') AND
      NOT (operation_row.status='released' AND operation_row.dispatched_at IS NULL) THEN
    RETURN jsonb_build_object('ok',false,'category','operation_closed');
  END IF;
  IF FOUND AND operation_row.request_identity<>request_key THEN
    RETURN jsonb_build_object('ok',false,'category','idempotency_conflict');
  END IF;
  IF FOUND AND (operation_row.policy_version_id<>policy_row.policy_version_id OR
      operation_row.plan_version_id<>selected_plan.plan_version_id) THEN
    RETURN jsonb_build_object('ok',false,'category','policy_changed');
  END IF;
  IF NOT FOUND AND EXISTS(SELECT 1 FROM groundbnb.provider_operations WHERE operation_id=operation_uuid AND account_id<>account_uuid) THEN
    RETURN jsonb_build_object('ok',false,'category','auth');
  END IF;
  day_key:=(clock_timestamp() AT TIME ZONE 'UTC')::date;
  month_key:=date_trunc('month',day_key::timestamp)::date;
  IF operation_row.operation_id IS NOT NULL AND operation_row.account_period_key<>
      (CASE WHEN plan_row.account_period='day' THEN day_key ELSE month_key END) THEN
    RETURN jsonb_build_object('ok',false,'category','period_conflict');
  END IF;
  SELECT count(*) INTO active_jobs FROM groundbnb.provider_operations
    WHERE account_id=account_uuid AND status IN ('active','needs_reconciliation');
  IF (operation_row.operation_id IS NULL OR operation_row.status='released') AND active_jobs>=plan_row.max_concurrent_jobs THEN
    RETURN jsonb_build_object('ok',false,'category','concurrency_limit');
  END IF;

  IF operation_row.operation_id IS NULL THEN
    IF plan_row.account_period='day' THEN
      SELECT count(*) INTO reserved_prompts FROM groundbnb.provider_operations
        WHERE account_id=account_uuid AND account_period='day' AND account_period_key=day_key
          AND prompt_bucket='base' AND prompt_state IN ('reserved','dispatched');
      SELECT COALESCE(sum(CASE WHEN a.status='settled' THEN a.actual_cost_usd ELSE a.maximum_cost_usd END),0) INTO base_used
        FROM groundbnb.provider_attempt_reservations a JOIN groundbnb.provider_operations o
          USING(account_id,operation_id) WHERE o.account_id=account_uuid AND o.account_period_key=day_key
          AND o.prompt_bucket='base' AND a.status IN ('reserved','dispatched','needs_reconciliation','settled');
      SELECT COALESCE(sum(CASE WHEN a.status='settled' THEN a.actual_cost_usd ELSE a.maximum_cost_usd END),0) INTO grace_used
        FROM groundbnb.provider_attempt_reservations a JOIN groundbnb.provider_operations o
          USING(account_id,operation_id) WHERE o.account_id=account_uuid AND o.account_period_key=day_key
          AND o.prompt_bucket='grace' AND a.status IN ('reserved','dispatched','needs_reconciliation','settled');
      IF reserved_prompts<COALESCE(plan_row.ordinary_request_limit,0) AND base_used+cost_max<=plan_row.base_ai_usd THEN
        prompt_bucket_value:='base';
      ELSE prompt_bucket_value:='grace'; END IF;
    ELSE
      SELECT COALESCE(sum(CASE WHEN a.status='settled' THEN a.actual_cost_usd ELSE a.maximum_cost_usd END),0) INTO base_used
        FROM groundbnb.provider_attempt_reservations a JOIN groundbnb.provider_operations o
          USING(account_id,operation_id) WHERE o.account_id=account_uuid AND o.account_period_key=month_key
          AND o.prompt_bucket='base' AND a.status IN ('reserved','dispatched','needs_reconciliation','settled');
      prompt_bucket_value:=CASE WHEN base_used+cost_max<=plan_row.base_ai_usd THEN 'base' ELSE 'grace' END;
    END IF;
    IF prompt_bucket_value='grace' THEN
      SELECT count(*) INTO grace_prompts FROM groundbnb.provider_operations
        WHERE account_id=account_uuid AND account_period_key=CASE WHEN plan_row.account_period='day' THEN day_key ELSE month_key END
          AND prompt_bucket='grace' AND prompt_state IN ('reserved','dispatched');
      SELECT COALESCE(sum(CASE WHEN a.status='settled' THEN a.actual_cost_usd ELSE a.maximum_cost_usd END),0) INTO grace_used
        FROM groundbnb.provider_attempt_reservations a JOIN groundbnb.provider_operations o
          USING(account_id,operation_id) WHERE o.account_id=account_uuid
          AND o.account_period_key=CASE WHEN plan_row.account_period='day' THEN day_key ELSE month_key END
          AND o.prompt_bucket='grace' AND a.status IN ('reserved','dispatched','needs_reconciliation','settled');
      IF grace_prompts>=plan_row.grace_request_limit OR grace_used+cost_max>plan_row.grace_ai_usd THEN
        RETURN jsonb_build_object('ok',false,'category','account_allowance_exhausted');
      END IF;
    END IF;
  ELSE
    prompt_bucket_value:=operation_row.prompt_bucket;
    SELECT COALESCE(sum(CASE WHEN a.status='settled' THEN a.actual_cost_usd ELSE a.maximum_cost_usd END),0)
      INTO base_used FROM groundbnb.provider_attempt_reservations a JOIN groundbnb.provider_operations o
        USING(account_id,operation_id) WHERE o.account_id=account_uuid AND o.operation_id=operation_uuid
          AND a.status IN ('reserved','dispatched','needs_reconciliation','settled');
    IF prompt_bucket_value='base' AND base_used+cost_max>plan_row.base_ai_usd OR
       prompt_bucket_value='grace' AND base_used+cost_max>plan_row.base_ai_usd+plan_row.grace_ai_usd THEN
      RETURN jsonb_build_object('ok',false,'category','account_allowance_exhausted');
    END IF;
  END IF;

  windows:=jsonb_build_array(
    jsonb_build_object('scope','account','key',account_uuid::text,'kind','day','period',day_key,
      'state','configured','cap',CASE WHEN selected_plan.plan_key='free' THEN plan_row.hard_ai_usd ELSE plan_row.daily_provider_cap_usd END,
      'held',CASE WHEN selected_plan.plan_key='free' THEN plan_row.held_emergency_usd ELSE 0 END),
    jsonb_build_object('scope','account','key',account_uuid::text,'kind','calendar_month','period',month_key,
      'state',CASE WHEN plan_row.account_period='calendar_month' THEN 'configured' ELSE 'unlimited' END,
      'cap',CASE WHEN plan_row.account_period='calendar_month' THEN plan_row.hard_ai_usd END,
      'held',CASE WHEN plan_row.account_period='calendar_month' THEN plan_row.held_emergency_usd END),
    jsonb_build_object('scope','provider','key',provider,'kind','day','period',day_key,
      'state','configured','cap',limit_row.daily_cap_usd,'held',0),
    jsonb_build_object('scope','provider','key',provider,'kind','calendar_month','period',month_key,
      'state','configured','cap',limit_row.monthly_cap_usd,'held',0),
    jsonb_build_object('scope','application','key','application','kind','day','period',day_key,
      'state','configured','cap',policy_row.application_daily_cap_usd,'held',policy_row.application_daily_held_usd),
    jsonb_build_object('scope','application','key','application','kind','calendar_month','period',month_key,
      'state','configured','cap',policy_row.application_monthly_cap_usd,'held',policy_row.application_monthly_held_usd));
  IF selected_plan.plan_key='free' THEN windows:=windows||jsonb_build_array(jsonb_build_object(
    'scope','free_pool','key','free-pool','kind','day','period',day_key,'state','configured',
    'cap',policy_row.free_pool_daily_cap_usd,'held',0)); END IF;

  -- Create/update caps, then lock all shared rows in one canonical order before checking any.
  FOR w IN SELECT value FROM jsonb_array_elements(windows)
    ORDER BY value->>'scope',value->>'key',value->>'kind',value->>'period' LOOP
    INSERT INTO groundbnb.provider_usage_windows(scope_kind,scope_key,period_kind,period_key,limit_state,cap_usd,held_usd)
      VALUES(w.value->>'scope',w.value->>'key',w.value->>'kind',(w.value->>'period')::date,
        w.value->>'state',NULLIF(w.value->>'cap','')::numeric,NULLIF(w.value->>'held','')::numeric)
    ON CONFLICT(scope_kind,scope_key,period_kind,period_key) DO UPDATE SET
      limit_state=EXCLUDED.limit_state,cap_usd=EXCLUDED.cap_usd,held_usd=EXCLUDED.held_usd,updated_at=clock_timestamp();
  END LOOP;
  PERFORM 1 FROM groundbnb.provider_usage_windows u JOIN LATERAL jsonb_to_recordset(windows)
    AS w(scope text,key text,kind text,period date,state text,cap numeric,held numeric)
    ON u.scope_kind=w.scope AND u.scope_key=w.key AND u.period_kind=w.kind AND u.period_key=w.period
    ORDER BY u.scope_kind,u.scope_key,u.period_kind,u.period_key FOR UPDATE OF u;
  FOR w IN SELECT value FROM jsonb_array_elements(windows)
    ORDER BY value->>'scope',value->>'key',value->>'kind',value->>'period' LOOP
    SELECT * INTO STRICT window_row FROM groundbnb.provider_usage_windows
      WHERE scope_kind=w.value->>'scope' AND scope_key=w.value->>'key' AND period_kind=w.value->>'kind'
        AND period_key=(w.value->>'period')::date;
    IF window_row.limit_state<>'configured' THEN RETURN jsonb_build_object('ok',false,'category','window_unconfigured'); END IF;
    IF window_row.spent_usd+window_row.pending_usd+cost_max>window_row.cap_usd-window_row.held_usd THEN
      RETURN jsonb_build_object('ok',false,'category','financial_limit');
    END IF;
  END LOOP;

  IF operation_row.operation_id IS NULL THEN
    INSERT INTO groundbnb.provider_operations(account_id,operation_id,request_identity,policy_version_id,plan_version_id,
      account_period,account_period_key,prompt_bucket,prompt_state,status)
    VALUES(account_uuid,operation_uuid,request_key,policy_row.policy_version_id,selected_plan.plan_version_id,
      plan_row.account_period,CASE WHEN plan_row.account_period='day' THEN day_key ELSE month_key END,
      prompt_bucket_value,'reserved','active');
  ELSIF operation_row.status='released' THEN
    UPDATE groundbnb.provider_operations SET status='active',prompt_state='reserved',closed_at=NULL
      WHERE account_id=account_uuid AND operation_id=operation_uuid AND dispatched_at IS NULL;
  END IF;
  FOR w IN SELECT value FROM jsonb_array_elements(windows)
    ORDER BY value->>'scope',value->>'key',value->>'kind',value->>'period' LOOP
    UPDATE groundbnb.provider_usage_windows SET pending_usd=pending_usd+cost_max,updated_at=clock_timestamp()
      WHERE scope_kind=w.value->>'scope' AND scope_key=w.value->>'key' AND period_kind=w.value->>'kind'
        AND period_key=(w.value->>'period')::date;
  END LOOP;
  receipt:=jsonb_build_object('ok',true,'status','reserved','operationId',operation_uuid,'attemptId',attempt_uuid,
    'maximumCostUsd',cost_max::text,'dispatched',false);
  INSERT INTO groundbnb.provider_attempt_reservations(attempt_id,account_id,operation_id,provider_key,model_key,
    rate_version_id,request_units,maximum_cost_usd,window_keys,status,policy_version_id,plan_version_id,limit_version_id,
    reserve_acknowledgment)
  VALUES(attempt_uuid,account_uuid,operation_uuid,provider,model,rate_uuid,requested_units,cost_max,windows,'reserved',
    policy_row.policy_version_id,selected_plan.plan_version_id,limit_row.limit_version_id,receipt);
  RETURN receipt;
END $$;

CREATE FUNCTION groundbnb.mark_provider_attempt_dispatched(identity_issuer text,identity_subject text,attempt_uuid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; account_row record; control_row record; policy_row record; attempt_hint record;
  rate_row record; limit_row record; attempt_row record; operation_row record; receipt jsonb;
  dispatch_day date; dispatch_month date;
BEGIN
  account_uuid:=groundbnb._profile_account(identity_issuer,identity_subject);
  IF account_uuid IS NULL THEN RETURN jsonb_build_object('ok',false,'category','auth'); END IF;
  SELECT * INTO account_row FROM groundbnb.accounts WHERE id=account_uuid;
  IF NOT FOUND OR account_row.status<>'active' THEN RETURN jsonb_build_object('ok',false,'category','auth'); END IF;
  SELECT * INTO attempt_hint FROM groundbnb.provider_attempt_reservations
    WHERE attempt_id=attempt_uuid AND account_id=account_uuid;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'category','unavailable'); END IF;
  IF attempt_hint.status IN ('dispatched','settled','needs_reconciliation') THEN
    -- Replay carries historical receipt data but can never authorize another external call.
    RETURN jsonb_set(COALESCE(attempt_hint.dispatch_acknowledgment,
      jsonb_build_object('ok',true,'status',attempt_hint.status,'dispatched',true)),
      '{dispatchAuthorized}','false'::jsonb,true);
  END IF;
  IF attempt_hint.status<>'reserved' THEN RETURN jsonb_build_object('ok',false,'category','operation_closed'); END IF;

  -- Match reserve's shared lock order before taking account/attempt/operation locks.
  SELECT * INTO control_row FROM groundbnb.financial_dispatch_control WHERE singleton FOR SHARE;
  IF NOT FOUND OR control_row.mode<>'normal' THEN RETURN jsonb_build_object('ok',false,'category','paused'); END IF;
  SELECT * INTO policy_row FROM groundbnb.financial_policy_versions
    WHERE policy_version_id=control_row.policy_version_id AND status='active' FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'category','paused'); END IF;
  SELECT * INTO rate_row FROM groundbnb.provider_rate_versions
    WHERE rate_version_id=attempt_hint.rate_version_id AND provider_key=attempt_hint.provider_key
      AND model_key=attempt_hint.model_key AND status='active'
      AND checked_at IS NOT NULL AND isfinite(checked_at) AND source_url IS NOT NULL AND source_url ~ '^https://'
    FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'category','policy_changed'); END IF;
  SELECT * INTO limit_row FROM groundbnb.provider_financial_limit_versions
    WHERE limit_version_id=attempt_hint.limit_version_id AND provider_key=attempt_hint.provider_key
      AND status='active' AND daily_cap_usd IS NOT NULL AND monthly_cap_usd IS NOT NULL
    FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'category','policy_changed'); END IF;

  SELECT * INTO account_row FROM groundbnb.accounts WHERE id=account_uuid FOR UPDATE;
  IF NOT FOUND OR account_row.status<>'active' THEN RETURN jsonb_build_object('ok',false,'category','auth'); END IF;
  SELECT * INTO attempt_row FROM groundbnb.provider_attempt_reservations
    WHERE attempt_id=attempt_uuid AND account_id=account_uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'category','unavailable'); END IF;
  IF attempt_row.status IN ('dispatched','settled','needs_reconciliation') THEN
    RETURN jsonb_set(COALESCE(attempt_row.dispatch_acknowledgment,
      jsonb_build_object('ok',true,'status',attempt_row.status,'dispatched',true)),
      '{dispatchAuthorized}','false'::jsonb,true);
  END IF;
  IF attempt_row.status<>'reserved' OR attempt_row.rate_version_id<>attempt_hint.rate_version_id OR
      attempt_row.limit_version_id<>attempt_hint.limit_version_id THEN
    RETURN jsonb_build_object('ok',false,'category','operation_closed');
  END IF;
  SELECT * INTO operation_row FROM groundbnb.provider_operations
    WHERE account_id=account_uuid AND operation_id=attempt_row.operation_id FOR UPDATE;
  IF NOT FOUND OR operation_row.status<>'active' THEN
    RETURN jsonb_build_object('ok',false,'category','operation_closed');
  END IF;
  IF control_row.policy_version_id<>operation_row.policy_version_id OR
      policy_row.policy_version_id<>operation_row.policy_version_id THEN
    RETURN jsonb_build_object('ok',false,'category','policy_changed');
  END IF;
  dispatch_day:=(clock_timestamp() AT TIME ZONE 'UTC')::date;
  dispatch_month:=date_trunc('month',dispatch_day::timestamp)::date;
  IF operation_row.account_period_key<>(CASE WHEN operation_row.account_period='day'
      THEN dispatch_day ELSE dispatch_month END) OR
     EXISTS(SELECT 1 FROM jsonb_to_recordset(attempt_row.window_keys) AS w(kind text,period date)
       WHERE (w.kind='day' AND w.period<>dispatch_day) OR
         (w.kind='calendar_month' AND w.period<>dispatch_month)) THEN
    RETURN jsonb_build_object('ok',false,'category','policy_changed');
  END IF;
  IF operation_row.dispatched_at IS NULL THEN
    UPDATE groundbnb.provider_operations SET prompt_state='dispatched',dispatched_at=clock_timestamp()
      WHERE account_id=account_uuid AND operation_id=operation_row.operation_id;
  END IF;
  receipt:=jsonb_build_object('ok',true,'status','dispatched','operationId',attempt_row.operation_id,
    'attemptId',attempt_uuid,'promptCounted',(operation_row.dispatched_at IS NULL),'dispatchAuthorized',true);
  UPDATE groundbnb.provider_attempt_reservations SET status='dispatched',dispatched_at=clock_timestamp(),dispatch_acknowledgment=receipt
    WHERE attempt_id=attempt_uuid;
  RETURN receipt;
END $$;

CREATE FUNCTION groundbnb.settle_provider_attempt(identity_issuer text,identity_subject text,attempt_uuid uuid,
  actual_units jsonb,confirmed_never_dispatched boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
-- This user-scoped path intentionally requires an active owner identity. Reconciliation after suspension
-- or revocation is not implemented here; no operator/service writer is claimed until a separate
-- server-attested privileged-access gate exists.
DECLARE account_uuid uuid; attempt_row record; operation_row record; actual_cost numeric; receipt jsonb; w record;
BEGIN
  account_uuid:=groundbnb._profile_account(identity_issuer,identity_subject);
  IF account_uuid IS NULL THEN RETURN jsonb_build_object('ok',false,'category','auth'); END IF;
  PERFORM 1 FROM groundbnb.accounts WHERE id=account_uuid AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'category','auth'); END IF;
  SELECT * INTO attempt_row FROM groundbnb.provider_attempt_reservations WHERE attempt_id=attempt_uuid AND account_id=account_uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'category','unavailable'); END IF;
  SELECT * INTO operation_row FROM groundbnb.provider_operations WHERE account_id=account_uuid AND operation_id=attempt_row.operation_id FOR UPDATE;
  IF attempt_row.status='settled' THEN
    IF confirmed_never_dispatched THEN RETURN jsonb_build_object('ok',false,'category','idempotency_conflict'); END IF;
    IF attempt_row.actual_units IS DISTINCT FROM actual_units THEN RETURN jsonb_build_object('ok',false,'category','idempotency_conflict'); END IF;
    RETURN attempt_row.settlement_acknowledgment;
  END IF;
  IF attempt_row.status='released' THEN
    IF confirmed_never_dispatched AND actual_units IS NULL THEN RETURN attempt_row.settlement_acknowledgment; END IF;
    RETURN jsonb_build_object('ok',false,'category','idempotency_conflict');
  END IF;
  IF confirmed_never_dispatched THEN
    IF attempt_row.status<>'reserved' OR attempt_row.dispatched_at IS NOT NULL THEN
      RETURN jsonb_build_object('ok',false,'category','reconciliation_required');
    END IF;
    FOR w IN SELECT value FROM jsonb_array_elements(attempt_row.window_keys)
      ORDER BY value->>'scope',value->>'key',value->>'kind',value->>'period' LOOP
      PERFORM 1 FROM groundbnb.provider_usage_windows WHERE scope_kind=w.value->>'scope' AND scope_key=w.value->>'key'
        AND period_kind=w.value->>'kind' AND period_key=(w.value->>'period')::date FOR UPDATE;
    END LOOP;
    FOR w IN SELECT value FROM jsonb_array_elements(attempt_row.window_keys)
      ORDER BY value->>'scope',value->>'key',value->>'kind',value->>'period' LOOP
      UPDATE groundbnb.provider_usage_windows SET pending_usd=pending_usd-attempt_row.maximum_cost_usd,updated_at=clock_timestamp()
        WHERE scope_kind=w.value->>'scope' AND scope_key=w.value->>'key' AND period_kind=w.value->>'kind'
          AND period_key=(w.value->>'period')::date;
    END LOOP;
    receipt:=jsonb_build_object('ok',true,'status','released','attemptId',attempt_uuid,'actualCostUsd',null);
    UPDATE groundbnb.provider_attempt_reservations SET status='released',settled_at=clock_timestamp(),settlement_acknowledgment=receipt
      WHERE attempt_id=attempt_uuid;
    IF NOT EXISTS(SELECT 1 FROM groundbnb.provider_attempt_reservations a WHERE a.account_id=account_uuid
        AND a.operation_id=attempt_row.operation_id AND a.status IN ('reserved','dispatched','needs_reconciliation')) THEN
      UPDATE groundbnb.provider_operations SET prompt_state='released',status='released',closed_at=clock_timestamp()
        WHERE account_id=account_uuid AND operation_id=attempt_row.operation_id AND dispatched_at IS NULL;
    END IF;
    RETURN receipt;
  END IF;
  IF actual_units IS NULL THEN
    IF attempt_row.dispatched_at IS NULL THEN RETURN jsonb_build_object('ok',false,'category','dispatch_status_unknown'); END IF;
    receipt:=jsonb_build_object('ok',true,'status','needs_reconciliation','attemptId',attempt_uuid,
      'reservedCostPending',attempt_row.maximum_cost_usd::text);
    UPDATE groundbnb.provider_attempt_reservations SET status='needs_reconciliation',settlement_acknowledgment=receipt
      WHERE attempt_id=attempt_uuid;
    UPDATE groundbnb.provider_operations SET status='needs_reconciliation'
      WHERE account_id=account_uuid AND operation_id=attempt_row.operation_id;
    RETURN receipt;
  END IF;
  IF attempt_row.dispatched_at IS NULL OR attempt_row.status NOT IN ('dispatched','needs_reconciliation') THEN
    RETURN jsonb_build_object('ok',false,'category','dispatch_status_unknown');
  END IF;
  actual_cost:=groundbnb._provider_cost(attempt_row.rate_version_id,actual_units);
  IF actual_cost IS NULL THEN RETURN jsonb_build_object('ok',false,'category','usage_unpriced'); END IF;
  FOR w IN SELECT value FROM jsonb_array_elements(attempt_row.window_keys)
    ORDER BY value->>'scope',value->>'key',value->>'kind',value->>'period' LOOP
    PERFORM 1 FROM groundbnb.provider_usage_windows WHERE scope_kind=w.value->>'scope' AND scope_key=w.value->>'key'
      AND period_kind=w.value->>'kind' AND period_key=(w.value->>'period')::date FOR UPDATE;
  END LOOP;
  FOR w IN SELECT value FROM jsonb_array_elements(attempt_row.window_keys)
    ORDER BY value->>'scope',value->>'key',value->>'kind',value->>'period' LOOP
    UPDATE groundbnb.provider_usage_windows SET pending_usd=pending_usd-attempt_row.maximum_cost_usd,
      spent_usd=spent_usd+actual_cost,updated_at=clock_timestamp()
      WHERE scope_kind=w.value->>'scope' AND scope_key=w.value->>'key' AND period_kind=w.value->>'kind'
        AND period_key=(w.value->>'period')::date;
  END LOOP;
  receipt:=jsonb_build_object('ok',true,'status','settled','attemptId',attempt_uuid,
    'maximumCostUsd',attempt_row.maximum_cost_usd::text,'actualCostUsd',actual_cost::text,
    'overReservation',actual_cost>attempt_row.maximum_cost_usd);
  UPDATE groundbnb.provider_attempt_reservations SET status='settled',actual_units=actual_units,
    actual_cost_usd=actual_cost,settled_at=clock_timestamp(),settlement_acknowledgment=receipt WHERE attempt_id=attempt_uuid;
  IF EXISTS(SELECT 1 FROM groundbnb.provider_attempt_reservations a WHERE a.account_id=account_uuid
      AND a.operation_id=attempt_row.operation_id AND a.status='needs_reconciliation') THEN
    UPDATE groundbnb.provider_operations SET status='needs_reconciliation'
      WHERE account_id=account_uuid AND operation_id=attempt_row.operation_id;
  ELSE UPDATE groundbnb.provider_operations SET status='active'
      WHERE account_id=account_uuid AND operation_id=attempt_row.operation_id AND status='needs_reconciliation'; END IF;
  RETURN receipt;
END $$;

CREATE FUNCTION groundbnb.close_provider_operation(identity_issuer text,identity_subject text,operation_uuid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; result jsonb;
BEGIN
  account_uuid:=groundbnb._profile_account(identity_issuer,identity_subject);
  IF account_uuid IS NULL THEN RETURN jsonb_build_object('ok',false,'category','auth'); END IF;
  PERFORM 1 FROM groundbnb.accounts WHERE id=account_uuid AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'category','auth'); END IF;
  IF NOT EXISTS(SELECT 1 FROM groundbnb.provider_operations WHERE account_id=account_uuid AND operation_id=operation_uuid) THEN
    RETURN jsonb_build_object('ok',false,'category','unavailable');
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.provider_attempt_reservations WHERE account_id=account_uuid
      AND operation_id=operation_uuid AND status IN ('reserved','dispatched','needs_reconciliation')) THEN
    RETURN jsonb_build_object('ok',false,'category','reconciliation_required');
  END IF;
  result:=jsonb_build_object('ok',true,'status','complete','operationId',operation_uuid);
  UPDATE groundbnb.provider_operations SET status='complete',closed_at=clock_timestamp()
    WHERE account_id=account_uuid AND operation_id=operation_uuid AND status<>'complete';
  RETURN result;
END $$;

ALTER TABLE groundbnb.financial_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.financial_dispatch_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.financial_control_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.financial_plan_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.provider_rate_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.provider_rate_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.provider_financial_limit_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.provider_usage_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.provider_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.provider_attempt_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON groundbnb.financial_policy_versions,groundbnb.financial_dispatch_control,groundbnb.financial_control_audit,
  groundbnb.financial_plan_budgets,groundbnb.provider_rate_versions,groundbnb.provider_rate_components,
  groundbnb.provider_financial_limit_versions,groundbnb.provider_usage_windows,
  groundbnb.provider_operations,groundbnb.provider_attempt_reservations FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._provider_cost(uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._financial_version_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._provider_rate_version_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._provider_limit_version_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._financial_control_audit() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._financial_audit_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb.reserve_provider_attempt(text,text,uuid,uuid,text,text,uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb.mark_provider_attempt_dispatched(text,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb.settle_provider_attempt(text,text,uuid,jsonb,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb.close_provider_operation(text,text,uuid) FROM PUBLIC;

-- Frozen Section 0 / 11.14 defaults only; no real account assignments or provider rates are created.
INSERT INTO groundbnb.financial_policy_versions(policy_version_id,version_key,status,commercial_mode,
  application_daily_cap_usd,application_daily_held_usd,application_monthly_cap_usd,application_monthly_held_usd,
  free_pool_daily_cap_usd,provider_rate_policy,created_at,source_spec)
VALUES('20000000-0000-4000-8000-000000000001','m1-v1-default','active','report_only',5.00,0.50,100.00,5.00,
  2.50,'official_review_required','2026-10-08T00:00:00Z','Groundbnb_Route_Planner_Agency_Spec_v3.0.md');
INSERT INTO groundbnb.financial_dispatch_control(singleton,mode,policy_version_id)
VALUES(true,'paused','20000000-0000-4000-8000-000000000001');
INSERT INTO groundbnb.financial_plan_budgets(plan_version_id,account_period,base_ai_usd,grace_ai_usd,
  grace_request_limit,held_emergency_usd,hard_ai_usd,daily_provider_cap_usd,ordinary_request_limit,max_concurrent_jobs)
VALUES
  ('10000000-0000-4000-8000-000000000101','day',0.20,0.03,2,0.02,0.25,0.25,10,1),
  ('10000000-0000-4000-8000-000000000102','calendar_month',10.00,1.90,2147483647,0.10,12.00,5.00,NULL,2),
  ('10000000-0000-4000-8000-000000000103','calendar_month',30.00,5.75,2147483647,0.25,36.00,15.00,NULL,3);

DO $$
DECLARE e record; app_role text; app_oid oid;
BEGIN
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE WHEN e.kind='local' THEN 'groundbnb_local_app' ELSE 'groundbnb_preview_app' END;
  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='groundbnb' AND c.relname IN ('financial_policy_versions','financial_plan_budgets',
        'financial_dispatch_control','financial_control_audit','provider_rate_versions','provider_rate_components',
        'provider_financial_limit_versions','provider_usage_windows',
        'provider_operations','provider_attempt_reservations')
        AND has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE n.nspname='groundbnb' AND p.proname IN ('_financial_version_immutable','_provider_rate_version_guard',
         '_provider_limit_version_guard','_financial_control_audit','_financial_audit_immutable',
         '_provider_cost','reserve_provider_attempt','mark_provider_attempt_dispatched',
         'settle_provider_attempt','close_provider_operation')
         AND (acl.grantee=0 OR acl.grantee=app_oid) AND acl.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'Financial internals and prepared functions must remain ungranted';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='groundbnb' AND p.proname IN ('_financial_version_immutable','_provider_rate_version_guard',
        '_provider_limit_version_guard','_financial_control_audit','_financial_audit_immutable',
        '_provider_cost','reserve_provider_attempt','mark_provider_attempt_dispatched',
        'settle_provider_attempt','close_provider_operation')
        AND has_function_privilege(app_oid,p.oid,'EXECUTE')) THEN
    RAISE EXCEPTION 'Application role has effective financial helper/function execution';
  END IF;
END $$;
INSERT INTO groundbnb.schema_migrations(version) VALUES('0008_provider_reservations');
COMMIT;
