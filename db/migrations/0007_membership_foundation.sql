-- M1-01K. Dormant versioned membership catalog and storage foundation.
-- Prepared for pinned synthetic local/preview only; never apply to production/recovery.
BEGIN;
DO $$
DECLARE e record; app_role text; role_record record;
BEGIN
  IF current_database()<>'groundbnb' THEN RAISE EXCEPTION 'Expected groundbnb database'; END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  IF app_role IS NULL OR NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0003_profile_domain') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0004_profile_operation_status') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0005_profile_records') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0006_profile_transfer') OR
     EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0007_membership_foundation') THEN
    RAISE EXCEPTION 'Requires pinned local/preview with exact 0001-0006 baseline and no prior 0007';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user")<>1 OR NOT EXISTS(SELECT 1 FROM neon_auth."user"
      WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic fixture';
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
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_patch(jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_records(jsonb,jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_account(text,text)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_snapshot(uuid)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m') AND c.relname NOT IN ('environment_identity','schema_migrations'))
          OR n.nspname='neon_auth')
         AND has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) OR
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_patch(jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_records(jsonb,jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_account(text,text)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_snapshot(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Pinned application role/function-only ACL baseline differs from approved M1 boundary';
  END IF;
END $$;

CREATE TABLE groundbnb.membership_plans (
  plan_id uuid PRIMARY KEY,
  plan_key text NOT NULL UNIQUE CHECK (plan_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 80),
  status text NOT NULL CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (isfinite(created_at) AND isfinite(updated_at))
);

CREATE TABLE groundbnb.membership_plan_versions (
  version_id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES groundbnb.membership_plans(plan_id) ON DELETE RESTRICT,
  version_number integer NOT NULL CHECK (version_number>0),
  release_tier text NOT NULL CHECK (release_tier IN ('v1','v1.1','v2')),
  created_by text NOT NULL CHECK (created_by ~ '^(migration:[a-z0-9-]+|account:[0-9a-f-]{36})$'),
  feature_definitions jsonb NOT NULL CHECK (jsonb_typeof(feature_definitions)='object'),
  limit_definitions jsonb NOT NULL CHECK (jsonb_typeof(limit_definitions)='object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_at timestamptz,
  UNIQUE(plan_id,version_number),
  CHECK (isfinite(created_at) AND (published_at IS NULL OR (isfinite(published_at) AND published_at>=created_at)))
);

CREATE TABLE groundbnb.membership_policy (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  commercial_mode text NOT NULL CHECK (commercial_mode IN ('report_only','enforced')),
  enforced_test_cohorts text NOT NULL CHECK (enforced_test_cohorts='explicit'),
  checkout_enabled boolean NOT NULL CHECK (checkout_enabled=false),
  supplier_transactions_enabled boolean NOT NULL CHECK (supplier_transactions_enabled=false),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (isfinite(updated_at))
);
INSERT INTO groundbnb.membership_policy(singleton,commercial_mode,enforced_test_cohorts,
  checkout_enabled,supplier_transactions_enabled)
VALUES(true,'report_only','explicit',false,false);

CREATE TABLE groundbnb.membership_assignments (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  plan_version_id uuid NOT NULL REFERENCES groundbnb.membership_plan_versions(version_id) ON DELETE RESTRICT,
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  status text NOT NULL CHECK (status IN ('scheduled','active','ended','revoked')),
  grant_type text NOT NULL DEFAULT 'base' CHECK (grant_type='base'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (isfinite(effective_from) AND (effective_until IS NULL OR (isfinite(effective_until) AND effective_until>effective_from))),
  CHECK (isfinite(created_at))
);
CREATE INDEX membership_assignments_owner_period_idx
  ON groundbnb.membership_assignments(account_id,effective_from,effective_until)
  WHERE status IN ('scheduled','active');

CREATE TABLE groundbnb.access_grants (
  grant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  plan_version_id uuid NOT NULL REFERENCES groundbnb.membership_plan_versions(version_id) ON DELETE RESTRICT,
  grant_type text NOT NULL CHECK (grant_type='lifetime'),
  granted_by uuid NOT NULL REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL,
  starts_at timestamptz NOT NULL,
  expires_at timestamptz,
  reason text,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  revocation_note text,
  CHECK (isfinite(granted_at) AND isfinite(starts_at) AND (expires_at IS NULL OR isfinite(expires_at))
    AND (revoked_at IS NULL OR isfinite(revoked_at))),
  CHECK (expires_at IS NULL),
  CHECK ((revoked_at IS NULL AND revoked_by IS NULL) OR
         (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND revoked_at>=granted_at))
);
CREATE INDEX access_grants_owner_start_idx ON groundbnb.access_grants(account_id,starts_at);

CREATE TABLE groundbnb.policy_audit (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_account_id uuid NOT NULL REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('assignment_created','assignment_ended','lifetime_grant_created',
    'lifetime_grant_revoked','plan_display_name_changed')),
  target_account_id uuid REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  affected_account_ids uuid[] NOT NULL DEFAULT '{}',
  before_state jsonb,
  after_state jsonb,
  reason text,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (isfinite(occurred_at) AND array_position(affected_account_ids,NULL) IS NULL)
);
CREATE INDEX policy_audit_actor_time_idx ON groundbnb.policy_audit(actor_account_id,occurred_at DESC);

CREATE FUNCTION groundbnb._protect_membership_plan()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Membership plan identity is retained'; END IF;
  IF TG_OP='INSERT' THEN NEW.updated_at:=NEW.created_at; RETURN NEW; END IF;
  IF ROW(NEW.plan_id,NEW.plan_key,NEW.status,NEW.created_at) IS DISTINCT FROM
     ROW(OLD.plan_id,OLD.plan_key,OLD.status,OLD.created_at) THEN
    RAISE EXCEPTION 'Only a membership plan display label may change in this release';
  END IF;
  NEW.updated_at:=clock_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER membership_plan_identity_guard BEFORE INSERT OR UPDATE OR DELETE ON groundbnb.membership_plans
  FOR EACH ROW EXECUTE FUNCTION groundbnb._protect_membership_plan();

CREATE FUNCTION groundbnb._protect_published_membership_version()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' AND OLD.published_at IS NOT NULL THEN RAISE EXCEPTION 'Published plan versions are immutable'; END IF;
  IF TG_OP='UPDATE' AND OLD.published_at IS NOT NULL THEN RAISE EXCEPTION 'Published plan versions are immutable'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER membership_version_immutable_guard BEFORE UPDATE OR DELETE ON groundbnb.membership_plan_versions
  FOR EACH ROW EXECUTE FUNCTION groundbnb._protect_published_membership_version();

CREATE FUNCTION groundbnb._protect_membership_policy_defaults()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Membership policy defaults require a later audited control migration';
END $$;
CREATE TRIGGER membership_policy_defaults_guard BEFORE UPDATE OR DELETE ON groundbnb.membership_policy
  FOR EACH ROW EXECUTE FUNCTION groundbnb._protect_membership_policy_defaults();

CREATE FUNCTION groundbnb._guard_base_assignment_overlap()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
DECLARE excluded_assignment uuid;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Membership assignment history is retained'; END IF;
  IF TG_OP='UPDATE' THEN excluded_assignment:=OLD.assignment_id; END IF;
  -- Serializes concurrent assignment attempts for one owner before checking half-open periods.
  PERFORM 1 FROM groundbnb.accounts WHERE id=NEW.account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership account does not exist'; END IF;
  IF NEW.status IN ('scheduled','active') AND EXISTS(
    SELECT 1 FROM groundbnb.membership_assignments a
    WHERE a.account_id=NEW.account_id AND a.status IN ('scheduled','active')
      AND (excluded_assignment IS NULL OR a.assignment_id<>excluded_assignment)
      AND (a.effective_until IS NULL OR NEW.effective_from<a.effective_until)
      AND (NEW.effective_until IS NULL OR a.effective_from<NEW.effective_until)
  ) THEN RAISE EXCEPTION 'Overlapping base membership assignments are not allowed'; END IF;
  IF TG_OP='UPDATE' AND ROW(NEW.assignment_id,NEW.account_id,NEW.plan_version_id,NEW.effective_from,NEW.grant_type,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.assignment_id,OLD.account_id,OLD.plan_version_id,OLD.effective_from,OLD.grant_type,OLD.created_at) THEN
    RAISE EXCEPTION 'Assignment owner and pinned plan version are immutable';
  END IF;
  IF TG_OP='UPDATE' AND OLD.status IN ('ended','revoked') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Terminal membership assignments are immutable';
  END IF;
  IF TG_OP='UPDATE' AND OLD.status='active' AND NEW.status='scheduled' THEN
    RAISE EXCEPTION 'Active membership assignments cannot return to scheduled';
  END IF;
  IF TG_OP='UPDATE' AND OLD.effective_until IS NOT NULL AND
      (NEW.effective_until IS NULL OR NEW.effective_until>OLD.effective_until) THEN
    RAISE EXCEPTION 'Assignment history cannot be extended after an end time is recorded';
  END IF;
  IF TG_OP='UPDATE' AND OLD.effective_until IS NOT NULL AND NEW.effective_until<OLD.effective_until AND
      NEW.status NOT IN ('ended','revoked') THEN
    RAISE EXCEPTION 'Assignment history cannot be shortened outside termination';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER membership_assignment_guard BEFORE INSERT OR UPDATE OR DELETE ON groundbnb.membership_assignments
  FOR EACH ROW EXECUTE FUNCTION groundbnb._guard_base_assignment_overlap();

CREATE FUNCTION groundbnb._protect_access_grant_history()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Access grant history is retained'; END IF;
  IF ROW(NEW.grant_id,NEW.account_id,NEW.plan_version_id,NEW.grant_type,NEW.granted_by,NEW.granted_at,
      NEW.starts_at,NEW.expires_at,NEW.reason) IS DISTINCT FROM
     ROW(OLD.grant_id,OLD.account_id,OLD.plan_version_id,OLD.grant_type,OLD.granted_by,OLD.granted_at,
      OLD.starts_at,OLD.expires_at,OLD.reason) THEN RAISE EXCEPTION 'Access grant terms are immutable'; END IF;
  IF OLD.revoked_at IS NOT NULL AND ROW(NEW.revoked_at,NEW.revoked_by,NEW.revocation_note) IS DISTINCT FROM
      ROW(OLD.revoked_at,OLD.revoked_by,OLD.revocation_note) THEN RAISE EXCEPTION 'Grant revocation history is immutable'; END IF;
  IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NULL AND
      (NEW.revoked_by IS NOT NULL OR NEW.revocation_note IS NOT NULL) THEN RAISE EXCEPTION 'Revocation metadata requires revocation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER access_grant_history_guard BEFORE UPDATE OR DELETE ON groundbnb.access_grants
  FOR EACH ROW EXECUTE FUNCTION groundbnb._protect_access_grant_history();

CREATE FUNCTION groundbnb._protect_policy_audit()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Membership policy audit is append-only';
END $$;
CREATE TRIGGER policy_audit_append_only BEFORE UPDATE OR DELETE ON groundbnb.policy_audit
  FOR EACH ROW EXECUTE FUNCTION groundbnb._protect_policy_audit();

REVOKE ALL ON FUNCTION groundbnb._protect_membership_plan() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._protect_published_membership_version() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._protect_membership_policy_defaults() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._guard_base_assignment_overlap() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._protect_access_grant_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._protect_policy_audit() FROM PUBLIC;

-- Exact frozen MEM-01 v1 catalog snapshot; definitions are generated from membership-catalog.mjs.
WITH catalog AS (SELECT '[{"plan":{"id":"00000000-0000-4000-8000-000000000101","key":"free","displayName":"Free","status":"active"},"version":{"id":"10000000-0000-4000-8000-000000000101","planId":"00000000-0000-4000-8000-000000000101","number":1,"releaseTier":"v1","features":{"ai.planning":{"included":true,"releaseTier":"v1"},"trips.saved":{"included":true,"releaseTier":"v1"},"monitoring.checks":{"included":true,"releaseTier":"v1"},"supplier.transactions":{"included":false,"releaseTier":"v2"},"mcp.agent":{"included":false,"releaseTier":"v1.1"},"maps.basic":{"included":true,"releaseTier":"v1"},"maps.tour":{"included":true,"releaseTier":"v1"},"export.native_json":{"included":true,"releaseTier":"v1"},"handoff.google_maps":{"included":true,"releaseTier":"v1"},"profile.pdf":{"included":true,"releaseTier":"v1"},"export.geojson":{"included":false,"releaseTier":"v1"},"export.gpx":{"included":false,"releaseTier":"v1"},"export.kml":{"included":false,"releaseTier":"v1"},"export.csv":{"included":false,"releaseTier":"v1"},"export.ical":{"included":false,"releaseTier":"v1"},"handoff.google_calendar":{"included":false,"releaseTier":"v1"},"export.route_video":{"included":false,"releaseTier":"v1.1"},"export.marine_waypoints":{"included":false,"releaseTier":"v1"},"maps.advanced_overlays":{"included":false,"releaseTier":"v2"},"saved_content.view":{"included":true,"releaseTier":"v1"},"manual_work":{"included":true,"releaseTier":"v1"},"profile_text.copy":{"included":true,"releaseTier":"v1"}},"limits":{"saved_trips":{"state":"configured","kind":"finite","value":1,"unit":"trip","period":null},"monitoring_completed_checks":{"state":"configured","kind":"finite","value":1,"unit":"check","period":"calendar_month"},"ai_ordinary_requests":{"state":"configured","kind":"finite","value":10,"unit":"request","period":"day"},"ai_base_cost_usd":{"state":"configured","kind":"finite","value":"0.20","unit":"USD","period":"day"},"ai_grace_cost_usd":{"state":"configured","kind":"finite","value":"0.03","unit":"USD","period":"day"},"ai_grace_requests":{"state":"configured","kind":"finite","value":2,"unit":"request","period":"day"},"ai_emergency_reserve_usd":{"state":"configured","kind":"finite","value":"0.02","unit":"USD","period":"day"},"ai_hard_total_usd":{"state":"configured","kind":"finite","value":"0.25","unit":"USD","period":"day"},"provider_cost_daily_ceiling_usd":{"state":"configured","kind":"finite","value":"0.25","unit":"USD","period":"day"},"ai_concurrent_jobs":{"state":"configured","kind":"finite","value":1,"unit":"job","period":null},"ai_economy_dispatch":{"state":"not_configured","unit":"dispatch","period":"day"},"ai_base_allowance_warning_percent":{"state":"configured","kind":"finite","value":80,"unit":"percent","period":null},"provider_ceiling_warning_percent":{"state":"configured","kind":"finite","value":95,"unit":"percent","period":null}}}},{"plan":{"id":"00000000-0000-4000-8000-000000000102","key":"plus","displayName":"Plus","status":"active"},"version":{"id":"10000000-0000-4000-8000-000000000102","planId":"00000000-0000-4000-8000-000000000102","number":1,"releaseTier":"v1","features":{"ai.planning":{"included":true,"releaseTier":"v1"},"trips.saved":{"included":true,"releaseTier":"v1"},"monitoring.checks":{"included":true,"releaseTier":"v1"},"supplier.transactions":{"included":false,"releaseTier":"v2"},"mcp.agent":{"included":true,"releaseTier":"v1.1"},"maps.basic":{"included":true,"releaseTier":"v1"},"maps.tour":{"included":true,"releaseTier":"v1"},"export.native_json":{"included":true,"releaseTier":"v1"},"handoff.google_maps":{"included":true,"releaseTier":"v1"},"profile.pdf":{"included":true,"releaseTier":"v1"},"export.geojson":{"included":true,"releaseTier":"v1"},"export.gpx":{"included":true,"releaseTier":"v1"},"export.kml":{"included":true,"releaseTier":"v1"},"export.csv":{"included":true,"releaseTier":"v1"},"export.ical":{"included":true,"releaseTier":"v1"},"handoff.google_calendar":{"included":true,"releaseTier":"v1"},"export.route_video":{"included":true,"releaseTier":"v1.1"},"export.marine_waypoints":{"included":false,"releaseTier":"v1"},"maps.advanced_overlays":{"included":false,"releaseTier":"v2"},"saved_content.view":{"included":true,"releaseTier":"v1"},"manual_work":{"included":true,"releaseTier":"v1"},"profile_text.copy":{"included":true,"releaseTier":"v1"}},"limits":{"saved_trips":{"state":"configured","kind":"finite","value":10,"unit":"trip","period":null},"monitoring_completed_checks":{"state":"configured","kind":"finite","value":1,"unit":"check","period":"iso_week"},"ai_ordinary_requests":{"state":"configured","kind":"unlimited","unit":"request","period":"day"},"ai_base_cost_usd":{"state":"configured","kind":"finite","value":"10.00","unit":"USD","period":"calendar_month"},"ai_grace_cost_usd":{"state":"configured","kind":"finite","value":"1.90","unit":"USD","period":"calendar_month"},"ai_grace_requests":{"state":"configured","kind":"unlimited","unit":"request","period":"calendar_month"},"ai_emergency_reserve_usd":{"state":"configured","kind":"finite","value":"0.10","unit":"USD","period":"calendar_month"},"ai_hard_total_usd":{"state":"configured","kind":"finite","value":"12.00","unit":"USD","period":"calendar_month"},"provider_cost_daily_ceiling_usd":{"state":"configured","kind":"finite","value":"5.00","unit":"USD","period":"day"},"ai_concurrent_jobs":{"state":"configured","kind":"finite","value":2,"unit":"job","period":null},"ai_economy_dispatch":{"state":"not_configured","unit":"dispatch","period":"day"},"ai_base_allowance_warning_percent":{"state":"configured","kind":"finite","value":80,"unit":"percent","period":null},"provider_ceiling_warning_percent":{"state":"configured","kind":"finite","value":95,"unit":"percent","period":null}}}},{"plan":{"id":"00000000-0000-4000-8000-000000000103","key":"pro","displayName":"Pro","status":"active"},"version":{"id":"10000000-0000-4000-8000-000000000103","planId":"00000000-0000-4000-8000-000000000103","number":1,"releaseTier":"v1","features":{"ai.planning":{"included":true,"releaseTier":"v1"},"trips.saved":{"included":true,"releaseTier":"v1"},"monitoring.checks":{"included":true,"releaseTier":"v1"},"supplier.transactions":{"included":false,"releaseTier":"v2"},"mcp.agent":{"included":true,"releaseTier":"v1.1"},"maps.basic":{"included":true,"releaseTier":"v1"},"maps.tour":{"included":true,"releaseTier":"v1"},"export.native_json":{"included":true,"releaseTier":"v1"},"handoff.google_maps":{"included":true,"releaseTier":"v1"},"profile.pdf":{"included":true,"releaseTier":"v1"},"export.geojson":{"included":true,"releaseTier":"v1"},"export.gpx":{"included":true,"releaseTier":"v1"},"export.kml":{"included":true,"releaseTier":"v1"},"export.csv":{"included":true,"releaseTier":"v1"},"export.ical":{"included":true,"releaseTier":"v1"},"handoff.google_calendar":{"included":true,"releaseTier":"v1"},"export.route_video":{"included":true,"releaseTier":"v1.1"},"export.marine_waypoints":{"included":true,"releaseTier":"v1"},"maps.advanced_overlays":{"included":false,"releaseTier":"v2"},"saved_content.view":{"included":true,"releaseTier":"v1"},"manual_work":{"included":true,"releaseTier":"v1"},"profile_text.copy":{"included":true,"releaseTier":"v1"}},"limits":{"saved_trips":{"state":"configured","kind":"unlimited","unit":"trip","period":null},"monitoring_completed_checks":{"state":"configured","kind":"finite","value":1,"unit":"check","period":"day"},"ai_ordinary_requests":{"state":"configured","kind":"unlimited","unit":"request","period":"day"},"ai_base_cost_usd":{"state":"configured","kind":"finite","value":"30.00","unit":"USD","period":"calendar_month"},"ai_grace_cost_usd":{"state":"configured","kind":"finite","value":"5.75","unit":"USD","period":"calendar_month"},"ai_grace_requests":{"state":"configured","kind":"unlimited","unit":"request","period":"calendar_month"},"ai_emergency_reserve_usd":{"state":"configured","kind":"finite","value":"0.25","unit":"USD","period":"calendar_month"},"ai_hard_total_usd":{"state":"configured","kind":"finite","value":"36.00","unit":"USD","period":"calendar_month"},"provider_cost_daily_ceiling_usd":{"state":"configured","kind":"finite","value":"15.00","unit":"USD","period":"day"},"ai_concurrent_jobs":{"state":"configured","kind":"finite","value":3,"unit":"job","period":null},"ai_economy_dispatch":{"state":"not_configured","unit":"dispatch","period":"day"},"ai_base_allowance_warning_percent":{"state":"configured","kind":"finite","value":80,"unit":"percent","period":null},"provider_ceiling_warning_percent":{"state":"configured","kind":"finite","value":95,"unit":"percent","period":null}}}}]'::jsonb AS rows)
INSERT INTO groundbnb.membership_plans(plan_id,plan_key,display_name,status)
SELECT (row->'plan'->>'id')::uuid,row->'plan'->>'key',row->'plan'->>'displayName',row->'plan'->>'status'
FROM catalog CROSS JOIN LATERAL jsonb_array_elements(rows) AS items(row);
WITH catalog AS (SELECT '[{"plan":{"id":"00000000-0000-4000-8000-000000000101","key":"free","displayName":"Free","status":"active"},"version":{"id":"10000000-0000-4000-8000-000000000101","planId":"00000000-0000-4000-8000-000000000101","number":1,"releaseTier":"v1","features":{"ai.planning":{"included":true,"releaseTier":"v1"},"trips.saved":{"included":true,"releaseTier":"v1"},"monitoring.checks":{"included":true,"releaseTier":"v1"},"supplier.transactions":{"included":false,"releaseTier":"v2"},"mcp.agent":{"included":false,"releaseTier":"v1.1"},"maps.basic":{"included":true,"releaseTier":"v1"},"maps.tour":{"included":true,"releaseTier":"v1"},"export.native_json":{"included":true,"releaseTier":"v1"},"handoff.google_maps":{"included":true,"releaseTier":"v1"},"profile.pdf":{"included":true,"releaseTier":"v1"},"export.geojson":{"included":false,"releaseTier":"v1"},"export.gpx":{"included":false,"releaseTier":"v1"},"export.kml":{"included":false,"releaseTier":"v1"},"export.csv":{"included":false,"releaseTier":"v1"},"export.ical":{"included":false,"releaseTier":"v1"},"handoff.google_calendar":{"included":false,"releaseTier":"v1"},"export.route_video":{"included":false,"releaseTier":"v1.1"},"export.marine_waypoints":{"included":false,"releaseTier":"v1"},"maps.advanced_overlays":{"included":false,"releaseTier":"v2"},"saved_content.view":{"included":true,"releaseTier":"v1"},"manual_work":{"included":true,"releaseTier":"v1"},"profile_text.copy":{"included":true,"releaseTier":"v1"}},"limits":{"saved_trips":{"state":"configured","kind":"finite","value":1,"unit":"trip","period":null},"monitoring_completed_checks":{"state":"configured","kind":"finite","value":1,"unit":"check","period":"calendar_month"},"ai_ordinary_requests":{"state":"configured","kind":"finite","value":10,"unit":"request","period":"day"},"ai_base_cost_usd":{"state":"configured","kind":"finite","value":"0.20","unit":"USD","period":"day"},"ai_grace_cost_usd":{"state":"configured","kind":"finite","value":"0.03","unit":"USD","period":"day"},"ai_grace_requests":{"state":"configured","kind":"finite","value":2,"unit":"request","period":"day"},"ai_emergency_reserve_usd":{"state":"configured","kind":"finite","value":"0.02","unit":"USD","period":"day"},"ai_hard_total_usd":{"state":"configured","kind":"finite","value":"0.25","unit":"USD","period":"day"},"provider_cost_daily_ceiling_usd":{"state":"configured","kind":"finite","value":"0.25","unit":"USD","period":"day"},"ai_concurrent_jobs":{"state":"configured","kind":"finite","value":1,"unit":"job","period":null},"ai_economy_dispatch":{"state":"not_configured","unit":"dispatch","period":"day"},"ai_base_allowance_warning_percent":{"state":"configured","kind":"finite","value":80,"unit":"percent","period":null},"provider_ceiling_warning_percent":{"state":"configured","kind":"finite","value":95,"unit":"percent","period":null}}}},{"plan":{"id":"00000000-0000-4000-8000-000000000102","key":"plus","displayName":"Plus","status":"active"},"version":{"id":"10000000-0000-4000-8000-000000000102","planId":"00000000-0000-4000-8000-000000000102","number":1,"releaseTier":"v1","features":{"ai.planning":{"included":true,"releaseTier":"v1"},"trips.saved":{"included":true,"releaseTier":"v1"},"monitoring.checks":{"included":true,"releaseTier":"v1"},"supplier.transactions":{"included":false,"releaseTier":"v2"},"mcp.agent":{"included":true,"releaseTier":"v1.1"},"maps.basic":{"included":true,"releaseTier":"v1"},"maps.tour":{"included":true,"releaseTier":"v1"},"export.native_json":{"included":true,"releaseTier":"v1"},"handoff.google_maps":{"included":true,"releaseTier":"v1"},"profile.pdf":{"included":true,"releaseTier":"v1"},"export.geojson":{"included":true,"releaseTier":"v1"},"export.gpx":{"included":true,"releaseTier":"v1"},"export.kml":{"included":true,"releaseTier":"v1"},"export.csv":{"included":true,"releaseTier":"v1"},"export.ical":{"included":true,"releaseTier":"v1"},"handoff.google_calendar":{"included":true,"releaseTier":"v1"},"export.route_video":{"included":true,"releaseTier":"v1.1"},"export.marine_waypoints":{"included":false,"releaseTier":"v1"},"maps.advanced_overlays":{"included":false,"releaseTier":"v2"},"saved_content.view":{"included":true,"releaseTier":"v1"},"manual_work":{"included":true,"releaseTier":"v1"},"profile_text.copy":{"included":true,"releaseTier":"v1"}},"limits":{"saved_trips":{"state":"configured","kind":"finite","value":10,"unit":"trip","period":null},"monitoring_completed_checks":{"state":"configured","kind":"finite","value":1,"unit":"check","period":"iso_week"},"ai_ordinary_requests":{"state":"configured","kind":"unlimited","unit":"request","period":"day"},"ai_base_cost_usd":{"state":"configured","kind":"finite","value":"10.00","unit":"USD","period":"calendar_month"},"ai_grace_cost_usd":{"state":"configured","kind":"finite","value":"1.90","unit":"USD","period":"calendar_month"},"ai_grace_requests":{"state":"configured","kind":"unlimited","unit":"request","period":"calendar_month"},"ai_emergency_reserve_usd":{"state":"configured","kind":"finite","value":"0.10","unit":"USD","period":"calendar_month"},"ai_hard_total_usd":{"state":"configured","kind":"finite","value":"12.00","unit":"USD","period":"calendar_month"},"provider_cost_daily_ceiling_usd":{"state":"configured","kind":"finite","value":"5.00","unit":"USD","period":"day"},"ai_concurrent_jobs":{"state":"configured","kind":"finite","value":2,"unit":"job","period":null},"ai_economy_dispatch":{"state":"not_configured","unit":"dispatch","period":"day"},"ai_base_allowance_warning_percent":{"state":"configured","kind":"finite","value":80,"unit":"percent","period":null},"provider_ceiling_warning_percent":{"state":"configured","kind":"finite","value":95,"unit":"percent","period":null}}}},{"plan":{"id":"00000000-0000-4000-8000-000000000103","key":"pro","displayName":"Pro","status":"active"},"version":{"id":"10000000-0000-4000-8000-000000000103","planId":"00000000-0000-4000-8000-000000000103","number":1,"releaseTier":"v1","features":{"ai.planning":{"included":true,"releaseTier":"v1"},"trips.saved":{"included":true,"releaseTier":"v1"},"monitoring.checks":{"included":true,"releaseTier":"v1"},"supplier.transactions":{"included":false,"releaseTier":"v2"},"mcp.agent":{"included":true,"releaseTier":"v1.1"},"maps.basic":{"included":true,"releaseTier":"v1"},"maps.tour":{"included":true,"releaseTier":"v1"},"export.native_json":{"included":true,"releaseTier":"v1"},"handoff.google_maps":{"included":true,"releaseTier":"v1"},"profile.pdf":{"included":true,"releaseTier":"v1"},"export.geojson":{"included":true,"releaseTier":"v1"},"export.gpx":{"included":true,"releaseTier":"v1"},"export.kml":{"included":true,"releaseTier":"v1"},"export.csv":{"included":true,"releaseTier":"v1"},"export.ical":{"included":true,"releaseTier":"v1"},"handoff.google_calendar":{"included":true,"releaseTier":"v1"},"export.route_video":{"included":true,"releaseTier":"v1.1"},"export.marine_waypoints":{"included":true,"releaseTier":"v1"},"maps.advanced_overlays":{"included":false,"releaseTier":"v2"},"saved_content.view":{"included":true,"releaseTier":"v1"},"manual_work":{"included":true,"releaseTier":"v1"},"profile_text.copy":{"included":true,"releaseTier":"v1"}},"limits":{"saved_trips":{"state":"configured","kind":"unlimited","unit":"trip","period":null},"monitoring_completed_checks":{"state":"configured","kind":"finite","value":1,"unit":"check","period":"day"},"ai_ordinary_requests":{"state":"configured","kind":"unlimited","unit":"request","period":"day"},"ai_base_cost_usd":{"state":"configured","kind":"finite","value":"30.00","unit":"USD","period":"calendar_month"},"ai_grace_cost_usd":{"state":"configured","kind":"finite","value":"5.75","unit":"USD","period":"calendar_month"},"ai_grace_requests":{"state":"configured","kind":"unlimited","unit":"request","period":"calendar_month"},"ai_emergency_reserve_usd":{"state":"configured","kind":"finite","value":"0.25","unit":"USD","period":"calendar_month"},"ai_hard_total_usd":{"state":"configured","kind":"finite","value":"36.00","unit":"USD","period":"calendar_month"},"provider_cost_daily_ceiling_usd":{"state":"configured","kind":"finite","value":"15.00","unit":"USD","period":"day"},"ai_concurrent_jobs":{"state":"configured","kind":"finite","value":3,"unit":"job","period":null},"ai_economy_dispatch":{"state":"not_configured","unit":"dispatch","period":"day"},"ai_base_allowance_warning_percent":{"state":"configured","kind":"finite","value":80,"unit":"percent","period":null},"provider_ceiling_warning_percent":{"state":"configured","kind":"finite","value":95,"unit":"percent","period":null}}}}]'::jsonb AS rows)
INSERT INTO groundbnb.membership_plan_versions(version_id,plan_id,version_number,release_tier,
  created_by,feature_definitions,limit_definitions,created_at,published_at)
SELECT (row->'version'->>'id')::uuid,(row->'version'->>'planId')::uuid,
  (row->'version'->>'number')::integer,row->'version'->>'releaseTier',
  'migration:m1-01k',row->'version'->'features',row->'version'->'limits',
  '2026-10-08T00:00:00Z'::timestamptz,'2026-10-08T00:00:00Z'::timestamptz
FROM catalog CROSS JOIN LATERAL jsonb_array_elements(rows) AS items(row);

ALTER TABLE groundbnb.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.membership_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.membership_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.membership_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.policy_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON groundbnb.membership_plans,groundbnb.membership_plan_versions,groundbnb.membership_policy,
  groundbnb.membership_assignments,groundbnb.access_grants,groundbnb.policy_audit FROM PUBLIC;

DO $$
DECLARE app_role text; app_oid oid;
BEGIN
  SELECT CASE kind WHEN 'local' THEN 'groundbnb_local_app' ELSE 'groundbnb_preview_app' END
    INTO STRICT app_role FROM groundbnb.environment_identity WHERE singleton;
  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='groundbnb' AND c.relname IN ('membership_plans','membership_plan_versions','membership_policy',
        'membership_assignments','access_grants','policy_audit')
        AND has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE n.nspname='groundbnb' AND p.proname IN ('_protect_membership_plan',
         '_protect_published_membership_version','_guard_base_assignment_overlap',
         '_protect_membership_policy_defaults','_protect_access_grant_history','_protect_policy_audit')
         AND (acl.grantee=0 OR acl.grantee=app_oid) AND acl.privilege_type='EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._protect_membership_plan()','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._protect_published_membership_version()','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._guard_base_assignment_overlap()','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._protect_membership_policy_defaults()','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._protect_access_grant_history()','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._protect_policy_audit()','EXECUTE') THEN
    RAISE EXCEPTION 'Membership catalog, private tables, and trigger helpers must remain inaccessible to app roles';
  END IF;
END $$;
INSERT INTO groundbnb.schema_migrations(version) VALUES('0007_membership_foundation');
COMMIT;
