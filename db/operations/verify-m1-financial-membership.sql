-- M1-01R operator acceptance: membership and financial reservation boundary.
-- Synthetic arithmetic fixtures only. This script never calls an external provider.
-- Preparation only: do not run until the operator gate explicitly authorizes execution.
BEGIN;
DO $$
DECLARE
  e record;
  app_role text;
  app_oid oid;
  role_record record;
  identity_issuer text;
  identity_subject text;
  account_uuid uuid;
  base_plan uuid := '10000000-0000-4000-8000-000000000101';
  plus_plan uuid := '10000000-0000-4000-8000-000000000102';
  policy_uuid uuid := '20000000-0000-4000-8000-000000000001';
  rate_uuid uuid := '28000000-0000-4000-8000-000000000001';
  limit_uuid uuid := '28000000-0000-4000-8000-000000000002';
  assignment_uuid uuid := '28000000-0000-4000-8000-000000000003';
  grant_uuid uuid := '28000000-0000-4000-8000-000000000004';
  operation_one uuid := '28000000-0000-4000-8000-000000000011';
  attempt_one uuid := '28000000-0000-4000-8000-000000000012';
  operation_unknown uuid := '28000000-0000-4000-8000-000000000021';
  attempt_unknown uuid := '28000000-0000-4000-8000-000000000022';
  operation_release uuid := '28000000-0000-4000-8000-000000000031';
  attempt_release uuid := '28000000-0000-4000-8000-000000000032';
  operation_free uuid := '28000000-0000-4000-8000-000000000041';
  attempt_free uuid := '28000000-0000-4000-8000-000000000042';
  requested_units jsonb := '{"token_input":1000,"token_output":1000}'::jsonb;
  actual_units jsonb := '{"token_input":500,"token_output":500}'::jsonb;
  receipt jsonb;
  replay jsonb;
  expected jsonb;
BEGIN
  IF current_database() IS DISTINCT FROM 'groundbnb' OR session_user IS DISTINCT FROM 'neondb_owner' THEN
    RAISE EXCEPTION 'Requires groundbnb as neondb_owner';
  END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  IF app_role IS NULL OR (SELECT count(*) FROM groundbnb.schema_migrations) IS DISTINCT FROM 9 OR
     (SELECT count(*) FROM groundbnb.schema_migrations WHERE version IN
       ('0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
        '0005_profile_records','0006_profile_transfer','0007_membership_foundation',
        '0008_provider_reservations','0009_privileged_factors')) IS DISTINCT FROM 9 THEN
    RAISE EXCEPTION 'Requires exact pinned local/preview environment and migrations 0001-0009';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user") IS DISTINCT FROM 1 OR NOT EXISTS(
       SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic fixture';
  END IF;
  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=app_role;
  app_oid:=role_record.oid;
  IF NOT role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole OR
     role_record.rolreplication OR role_record.rolbypassrls OR role_record.rolinherit OR role_record.rolconnlimit IS DISTINCT FROM 4 OR
     NOT (role_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=app_oid) OR
     has_database_privilege(app_oid,current_database(),'CREATE') OR has_schema_privilege(app_oid,'groundbnb','CREATE') OR
     NOT has_function_privilege(app_oid,'groundbnb.read_profile(text,text)','EXECUTE') OR
     NOT has_function_privilege(app_oid,'groundbnb.save_profile(text,text,uuid,bigint,jsonb)','EXECUTE') OR
     NOT has_function_privilege(app_oid,'groundbnb.read_profile_operation(text,text,uuid)','EXECUTE') OR
     NOT has_function_privilege(app_oid,'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') OR
     NOT has_function_privilege(app_oid,'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
      WHERE ((s.nspname='groundbnb' AND c.relkind IN ('r','p','v','m')
               AND c.relname NOT IN ('environment_identity','schema_migrations')) OR s.nspname='neon_auth')
        AND has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
      WHERE s.nspname='groundbnb' AND p.proname IN (
        '_financial_version_immutable','_provider_rate_version_guard','_provider_limit_version_guard',
        '_financial_control_audit','_financial_audit_immutable','_provider_cost',
        'reserve_provider_attempt','mark_provider_attempt_dispatched','settle_provider_attempt',
        'close_provider_operation','_protect_membership_plan','_protect_published_membership_version',
        '_protect_membership_policy_defaults','_guard_base_assignment_overlap','_protect_access_grant_history',
        '_protect_policy_audit','_guard_security_epoch','_guard_factor_enrollment_history',
        '_guard_recovery_consumption','_guard_accepted_factor_step','_guard_factor_attestation',
        '_guard_factor_attempt_window','_privileged_factor_audit_append_only','_require_factor_epoch_event',
        '_serialize_factor_attempt_window') AND has_function_privilege(app_oid,p.oid,'EXECUTE')) THEN
    RAISE EXCEPTION 'Application role has direct table or private helper access';
  END IF;
  SELECT issuer,subject,account_id INTO STRICT identity_issuer,identity_subject,account_uuid
    FROM groundbnb.account_identities WHERE verified_email=e.kind || '-01@example.test' AND revoked_at IS NULL;
  IF (SELECT count(*) FROM groundbnb.account_identities WHERE verified_email=e.kind || '-01@example.test' AND revoked_at IS NULL) IS DISTINCT FROM 1 OR
     (SELECT status FROM groundbnb.accounts WHERE id=account_uuid) IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Synthetic fixture owner state is not unique and active';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.membership_assignments WHERE account_id=account_uuid) OR
     EXISTS(SELECT 1 FROM groundbnb.access_grants WHERE account_id=account_uuid) OR
     EXISTS(SELECT 1 FROM groundbnb.provider_operations) OR
     EXISTS(SELECT 1 FROM groundbnb.provider_attempt_reservations) OR
     EXISTS(SELECT 1 FROM groundbnb.provider_usage_windows) OR
     EXISTS(SELECT 1 FROM groundbnb.financial_control_audit) OR
     EXISTS(SELECT 1 FROM groundbnb.provider_rate_versions WHERE provider_key='m1r_test_arithmetic') OR
     EXISTS(SELECT 1 FROM groundbnb.provider_financial_limit_versions WHERE provider_key='m1r_test_arithmetic') THEN
    RAISE EXCEPTION 'Synthetic acceptance fixture is not clean';
  END IF;
  IF (SELECT mode FROM groundbnb.financial_dispatch_control WHERE singleton) IS DISTINCT FROM 'paused' OR
     (SELECT commercial_mode FROM groundbnb.financial_policy_versions WHERE policy_version_id=policy_uuid) IS DISTINCT FROM 'report_only' OR
     (SELECT count(*) FROM groundbnb.financial_plan_budgets WHERE plan_version_id IN
       ('10000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000102',
        '10000000-0000-4000-8000-000000000103')) IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Prepared financial defaults differ from the expected paused v1 baseline';
  END IF;

  -- A pristine paused system refuses reservation before any provider data is configured.
  receipt:=groundbnb.reserve_provider_attempt(identity_issuer,identity_subject,
    '28000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000002',
    'm1r_test_arithmetic','synthetic_units_v1',rate_uuid,requested_units);
  IF receipt->>'category' IS DISTINCT FROM 'paused' THEN RAISE EXCEPTION 'Paused dispatch control did not refuse reservation'; END IF;

  INSERT INTO groundbnb.membership_assignments(assignment_id,account_id,plan_version_id,effective_from,status)
    VALUES(assignment_uuid,account_uuid,base_plan,clock_timestamp()-interval '1 minute','active');
  BEGIN
    INSERT INTO groundbnb.membership_assignments(account_id,plan_version_id,effective_from,status)
      VALUES(account_uuid,base_plan,clock_timestamp(),'active');
    RAISE EXCEPTION 'Expected overlapping base assignment rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Overlapping base membership assignments are not allowed' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE groundbnb.membership_plan_versions SET release_tier='v1.1' WHERE version_id=base_plan;
    RAISE EXCEPTION 'Expected published plan version immutability';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Published plan versions are immutable' THEN RAISE; END IF;
  END;

  -- Explicit test-only arithmetic; not official vendor pricing or rate verification.
  INSERT INTO groundbnb.provider_rate_versions(rate_version_id,provider_key,model_key,status,source_url,
    checked_at,checked_by,release_date)
    VALUES(rate_uuid,'m1r_test_arithmetic','synthetic_units_v1','active',
      'https://example.test/m1-01r-arithmetic-only',clock_timestamp(),
      'M1-01R synthetic arithmetic fixture',current_date);
  INSERT INTO groundbnb.provider_rate_components(rate_version_id,component_key,unit_name,
    price_per_million_usd,accounting_note) VALUES
    (rate_uuid,'token_input','token',1,'Synthetic arithmetic only; not a vendor price.'),
    (rate_uuid,'token_output','token',1,'Synthetic arithmetic only; not a vendor price.');
  INSERT INTO groundbnb.provider_financial_limit_versions(limit_version_id,provider_key,status,
    daily_cap_usd,monthly_cap_usd,source_url,checked_at,checked_by,release_date)
    VALUES(limit_uuid,'m1r_test_arithmetic','active',100,1000,
      'https://example.test/m1-01r-arithmetic-only',clock_timestamp(),
      'M1-01R synthetic arithmetic fixture',current_date);
  INSERT INTO groundbnb.access_grants(grant_id,account_id,plan_version_id,grant_type,granted_by,
    granted_at,starts_at,reason)
    VALUES(grant_uuid,account_uuid,plus_plan,'lifetime',account_uuid,clock_timestamp(),clock_timestamp(),
      'M1-01R rollback-only overlay check');
  UPDATE groundbnb.financial_dispatch_control SET mode='normal',changed_by=account_uuid,
    change_reason='M1-01R rollback-only acceptance; no network dispatch' WHERE singleton;

  receipt:=groundbnb.reserve_provider_attempt(identity_issuer,identity_subject,operation_one,attempt_one,
    'm1r_test_arithmetic','synthetic_units_v1',rate_uuid,requested_units);
  IF receipt->>'ok' IS DISTINCT FROM 'true' OR receipt->>'status' IS DISTINCT FROM 'reserved' OR receipt->>'dispatched' IS DISTINCT FROM 'false' OR
     receipt->>'maximumCostUsd' IS DISTINCT FROM '0.002' OR NOT EXISTS(SELECT 1 FROM groundbnb.provider_operations
       WHERE account_id=account_uuid AND operation_id=operation_one AND plan_version_id=plus_plan) THEN
    RAISE EXCEPTION 'Lifetime overlay did not pin the expected Plus plan and reserve receipt';
  END IF;
  expected:=receipt;
  replay:=groundbnb.reserve_provider_attempt(identity_issuer,identity_subject,operation_one,attempt_one,
    'm1r_test_arithmetic','synthetic_units_v1',rate_uuid,requested_units);
  IF replay IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Reserve replay did not return its original receipt'; END IF;
  receipt:=groundbnb.mark_provider_attempt_dispatched(identity_issuer,identity_subject,attempt_one);
  IF receipt->>'ok' IS DISTINCT FROM 'true' OR receipt->>'dispatchAuthorized' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'First-dispatch receipt did not authorize exactly the synthetic acceptance marker';
  END IF;
  replay:=groundbnb.mark_provider_attempt_dispatched(identity_issuer,identity_subject,attempt_one);
  IF replay->>'dispatchAuthorized' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Dispatch replay authorized a second attempt'; END IF;
  receipt:=groundbnb.settle_provider_attempt(identity_issuer,identity_subject,attempt_one,actual_units,false);
  IF receipt->>'ok' IS DISTINCT FROM 'true' OR receipt->>'status' IS DISTINCT FROM 'settled' OR receipt->>'actualCostUsd' IS DISTINCT FROM '0.001' THEN
    RAISE EXCEPTION 'Known synthetic actual usage did not settle';
  END IF;
  expected:=receipt;
  replay:=groundbnb.settle_provider_attempt(identity_issuer,identity_subject,attempt_one,actual_units,false);
  IF replay IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Settlement replay did not return original receipt'; END IF;
  replay:=groundbnb.settle_provider_attempt(identity_issuer,identity_subject,attempt_one,
    '{"token_input":1,"token_output":1}'::jsonb,false);
  IF replay->>'category' IS DISTINCT FROM 'idempotency_conflict' THEN RAISE EXCEPTION 'Changed settlement payload was not rejected'; END IF;
  receipt:=groundbnb.close_provider_operation(identity_issuer,identity_subject,operation_one);
  IF receipt->>'ok' IS DISTINCT FROM 'true' OR receipt->>'status' IS DISTINCT FROM 'complete' THEN RAISE EXCEPTION 'Settled operation did not close'; END IF;

  receipt:=groundbnb.reserve_provider_attempt(identity_issuer,identity_subject,operation_unknown,attempt_unknown,
    'm1r_test_arithmetic','synthetic_units_v1',rate_uuid,requested_units);
  IF receipt->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Could not create unknown-outcome test reservation'; END IF;
  receipt:=groundbnb.mark_provider_attempt_dispatched(identity_issuer,identity_subject,attempt_unknown);
  IF receipt->>'dispatchAuthorized' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Unknown-outcome scenario did not reach dispatch marker'; END IF;
  receipt:=groundbnb.settle_provider_attempt(identity_issuer,identity_subject,attempt_unknown,NULL,false);
  IF receipt->>'status' IS DISTINCT FROM 'needs_reconciliation' OR NOT EXISTS(SELECT 1 FROM groundbnb.provider_usage_windows
      WHERE scope_kind='provider' AND scope_key='m1r_test_arithmetic' AND pending_usd>0) THEN
    RAISE EXCEPTION 'Unknown dispatched outcome did not preserve pending usage for reconciliation';
  END IF;
  receipt:=groundbnb.close_provider_operation(identity_issuer,identity_subject,operation_unknown);
  IF receipt->>'category' IS DISTINCT FROM 'reconciliation_required' THEN RAISE EXCEPTION 'Unknown operation closed without reconciliation'; END IF;
  receipt:=groundbnb.settle_provider_attempt(identity_issuer,identity_subject,attempt_unknown,actual_units,false);
  IF receipt->>'status' IS DISTINCT FROM 'settled' THEN RAISE EXCEPTION 'Explicit reconciliation did not settle known synthetic usage'; END IF;
  receipt:=groundbnb.close_provider_operation(identity_issuer,identity_subject,operation_unknown);
  IF receipt->>'status' IS DISTINCT FROM 'complete' THEN RAISE EXCEPTION 'Reconciled operation did not close'; END IF;

  receipt:=groundbnb.reserve_provider_attempt(identity_issuer,identity_subject,operation_release,attempt_release,
    'm1r_test_arithmetic','synthetic_units_v1',rate_uuid,requested_units);
  IF receipt->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Could not create never-dispatched release scenario'; END IF;
  receipt:=groundbnb.settle_provider_attempt(identity_issuer,identity_subject,attempt_release,NULL,true);
  IF receipt->>'status' IS DISTINCT FROM 'released' THEN RAISE EXCEPTION 'Confirmed never-dispatched attempt was not released'; END IF;
  receipt:=groundbnb.close_provider_operation(identity_issuer,identity_subject,operation_release);
  IF receipt->>'ok' IS DISTINCT FROM 'true' OR receipt->>'status' IS DISTINCT FROM 'complete' THEN RAISE EXCEPTION 'Released operation did not terminalize'; END IF;
  replay:=groundbnb.reserve_provider_attempt(identity_issuer,identity_subject,operation_release,
    '28000000-0000-4000-8000-000000000033','m1r_test_arithmetic','synthetic_units_v1',rate_uuid,requested_units);
  IF replay->>'category' IS DISTINCT FROM 'operation_closed' THEN RAISE EXCEPTION 'Terminal released operation was reopened'; END IF;

  UPDATE groundbnb.access_grants SET revoked_at=clock_timestamp(),revoked_by=account_uuid,
    revocation_note='M1-01R rollback-only revocation check' WHERE grant_id=grant_uuid;
  BEGIN
    UPDATE groundbnb.access_grants SET revoked_at=NULL,revoked_by=NULL,revocation_note=NULL WHERE grant_id=grant_uuid;
    RAISE EXCEPTION 'Expected revoked grant history protection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Grant revocation history is immutable' THEN RAISE; END IF;
  END;
  receipt:=groundbnb.reserve_provider_attempt(identity_issuer,identity_subject,operation_free,attempt_free,
    'm1r_test_arithmetic','synthetic_units_v1',rate_uuid,requested_units);
  IF receipt->>'ok' IS DISTINCT FROM 'true' OR NOT EXISTS(SELECT 1 FROM groundbnb.provider_operations
      WHERE account_id=account_uuid AND operation_id=operation_free AND plan_version_id=base_plan) THEN
    RAISE EXCEPTION 'Revoked lifetime grant remained effective or base assignment was not restored';
  END IF;
  receipt:=groundbnb.settle_provider_attempt(identity_issuer,identity_subject,attempt_free,NULL,true);
  IF receipt->>'status' IS DISTINCT FROM 'released' THEN RAISE EXCEPTION 'Free-plan check did not cleanly release'; END IF;
  PERFORM groundbnb.close_provider_operation(identity_issuer,identity_subject,operation_free);

  -- Constraint probes use nested subtransactions and require the intended constraint failure.
  BEGIN
    INSERT INTO groundbnb.provider_financial_limit_versions(limit_version_id,provider_key,status,
      daily_cap_usd,monthly_cap_usd,source_url,checked_at,checked_by,release_date)
      VALUES('28000000-0000-4000-8000-000000000098','m1r_nonfinite_probe','active','NaN'::numeric,1000,
        'https://example.test/m1-01r-arithmetic-only',clock_timestamp(),
        'M1-01R synthetic arithmetic fixture',current_date);
    RAISE EXCEPTION 'Expected nonfinite financial limit rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO groundbnb.provider_rate_versions(rate_version_id,provider_key,model_key,status,
      source_url,checked_at,checked_by,release_date)
      VALUES('28000000-0000-4000-8000-000000000099','m1r_missing_provenance','synthetic_units_v1',
        'active',NULL,NULL,NULL,NULL);
    RAISE EXCEPTION 'Expected active rate provenance rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  UPDATE groundbnb.financial_dispatch_control SET mode='paused',changed_by=account_uuid,
    change_reason='M1-01R rollback-only cleanup; restore paused control' WHERE singleton;
END $$;
SELECT 'M1_FINANCIAL_MEMBERSHIP_ACCEPTANCE_PREPARED' AS result;
ROLLBACK;
