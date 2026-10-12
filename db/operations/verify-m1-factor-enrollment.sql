-- M1-01AE rollback-only metadata and unmapped-identity denial checks.
-- This does not create an owner/session, perform enrollment, or prove MFA runtime behavior.
BEGIN;
-- The trusted helper takes row locks on denial paths; all calls are pinned to an unmapped fixture and rolled back.
SET TRANSACTION READ WRITE;
DO $$
DECLARE e record; app_role text; factor_role text; app_oid oid; factor_oid oid; owner_oid oid; cloud_admin_oid oid;
  role_row record; identity_issuer text;
  fake_subject constant text:='10000000-0000-4000-8000-000000000001';
  fake_session constant text:='10000000-0000-4000-8000-000000000002';
  fake_account constant uuid:='10000000-0000-4000-8000-000000000099';
  begin_op constant uuid:='10000000-0000-4000-8000-000000000003';
  attempt_op constant uuid:='10000000-0000-4000-8000-000000000004';
  verify_op constant uuid:='10000000-0000-4000-8000-000000000005';
  candidate_factor constant uuid:='10000000-0000-4000-8000-000000000006';
  fake_fingerprint bytea:=decode(repeat('a',64),'hex');
  receipt_count integer; app_functions oid[]; factor_functions oid[]; expected_app_functions oid[]; expected_factor_functions oid[];
  enrollment_functions oid[]; expected_enrollment_functions oid[]; function_oid oid; function_owner oid;
  function_config text[]; function_acl aclitem[]; result jsonb; observed_error text; failed boolean;
  operations_before bigint; challenges_before bigint; epochs_before bigint; events_before bigint;
  factors_before bigint; recoveries_before bigint; steps_before bigint; attestations_before bigint;
  attempts_before bigint; audits_before bigint; activity_before bigint;
BEGIN
  IF current_database() IS DISTINCT FROM 'groundbnb' OR session_user IS DISTINCT FROM 'neondb_owner' OR
     current_user IS DISTINCT FROM 'neondb_owner' THEN
    RAISE EXCEPTION 'Requires groundbnb as neondb_owner';
  END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  factor_role:=CASE WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_factor_service'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_factor_service' END;
  identity_issuer:=CASE e.kind
    WHEN 'local' THEN 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth'
    WHEN 'preview' THEN 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth' END;
  IF app_role IS NULL OR factor_role IS NULL OR
     (SELECT count(*) FROM groundbnb.schema_migrations) IS DISTINCT FROM 14 OR
     (SELECT count(*) FROM groundbnb.schema_migrations WHERE version=ANY(ARRAY[
       '0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
       '0005_profile_records','0006_profile_transfer','0007_membership_foundation','0008_provider_reservations',
       '0009_privileged_factors','0010_factor_recovery_activity','0011_membership_reader',
       '0012_factor_service','0013_factor_service_principal','0014_factor_enrollment']::text[])) IS DISTINCT FROM 14 THEN
    RAISE EXCEPTION 'Requires exact pinned local/preview 0001-0014 receipt baseline';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user") IS DISTINCT FROM 1 OR NOT EXISTS(
      SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) OR
     EXISTS(SELECT 1 FROM groundbnb.account_identities WHERE issuer=identity_issuer AND subject=fake_subject) OR
     EXISTS(SELECT 1 FROM neon_auth.session WHERE id=fake_session::uuid) THEN
    RAISE EXCEPTION 'Pinned synthetic fixture or unmapped denial markers differ';
  END IF;
  SELECT oid INTO STRICT owner_oid FROM pg_roles WHERE rolname='neondb_owner';
  SELECT oid INTO STRICT cloud_admin_oid FROM pg_roles WHERE rolname='cloud_admin';
  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  SELECT oid INTO STRICT factor_oid FROM pg_roles WHERE rolname=factor_role;
  SELECT * INTO STRICT role_row FROM pg_roles WHERE oid=app_oid;
  IF NOT role_row.rolcanlogin OR role_row.rolsuper OR role_row.rolcreatedb OR role_row.rolcreaterole OR
     role_row.rolreplication OR role_row.rolbypassrls OR role_row.rolinherit OR role_row.rolconnlimit IS DISTINCT FROM 4 OR
     (role_row.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) IS DISTINCT FROM true OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=app_oid) OR
     (SELECT count(*) FROM pg_auth_members WHERE roleid=app_oid) IS DISTINCT FROM 1 OR
     NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=owner_oid AND roleid=app_oid AND
       grantor=cloud_admin_oid AND admin_option IS TRUE AND inherit_option IS FALSE AND set_option IS FALSE) THEN
    RAISE EXCEPTION 'Pinned application principal boundary differs';
  END IF;
  SELECT array_agg(p.oid ORDER BY p.oid) INTO app_functions FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
      AND has_function_privilege(app_oid,p.oid,'EXECUTE');
  SELECT array_agg(p.oid ORDER BY p.oid) INTO factor_functions FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
      AND has_function_privilege(factor_oid,p.oid,'EXECUTE');
  SELECT array_agg(v ORDER BY v) INTO expected_app_functions FROM unnest(ARRAY[
    to_regprocedure('groundbnb.read_membership(text,text)')::oid,
    to_regprocedure('groundbnb.read_profile(text,text)')::oid,
    to_regprocedure('groundbnb.read_profile_operation(text,text,uuid)')::oid,
    to_regprocedure('groundbnb.save_profile(text,text,uuid,bigint,jsonb)')::oid,
    to_regprocedure('groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)')::oid,
    to_regprocedure('groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)')::oid]) AS x(v);
  SELECT array_agg(v ORDER BY v) INTO expected_factor_functions FROM unnest(ARRAY[
    to_regprocedure('groundbnb.read_factor_challenge_state(text,text,text,timestamptz)')::oid,
    to_regprocedure('groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer)')::oid,
    to_regprocedure('groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer)')::oid,
    to_regprocedure('groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer)')::oid,
    to_regprocedure('groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text)')::oid]) AS x(v);
  IF app_functions IS DISTINCT FROM expected_app_functions OR factor_functions IS DISTINCT FROM expected_factor_functions OR
     has_function_privilege(app_oid,'groundbnb.read_factor_enrollment_context(text,text,text,timestamptz)','EXECUTE') OR
     has_function_privilege(factor_oid,'groundbnb.read_factor_enrollment_context(text,text,text,timestamptz)','EXECUTE') OR
     has_schema_privilege(app_oid,'groundbnb','USAGE') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.environment_identity','SELECT') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.schema_migrations','SELECT') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.environment_identity','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_table_privilege(app_oid,'groundbnb.schema_migrations','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_table_privilege(app_oid,'groundbnb.factor_enrollment_operations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_table_privilege(factor_oid,'groundbnb.factor_enrollment_operations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     EXISTS(SELECT 1 FROM aclexplode(COALESCE((SELECT c.relacl FROM pg_class c
       WHERE c.oid='groundbnb.factor_enrollment_operations'::regclass),acldefault('r',owner_oid))) acl
       WHERE acl.grantee=0 OR acl.grantee<>owner_oid OR acl.is_grantable) THEN
    RAISE EXCEPTION 'Pinned app/factor allowlists or enrollment-table ACL differ';
  END IF;
  SELECT array_agg(p.oid ORDER BY p.oid) INTO enrollment_functions FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND p.proname IN
      ('read_factor_enrollment_context','read_pending_factor_for_enrollment','begin_factor_enrollment',
       'record_factor_enrollment_attempt','verify_factor_enrollment','read_factor_enrollment_receipt');
  SELECT array_agg(v ORDER BY v) INTO expected_enrollment_functions FROM unnest(ARRAY[
    to_regprocedure('groundbnb.read_factor_enrollment_context(text,text,text,timestamptz)')::oid,
    to_regprocedure('groundbnb.read_pending_factor_for_enrollment(text,text,text,timestamptz,uuid,uuid,uuid,bigint)')::oid,
    to_regprocedure('groundbnb.begin_factor_enrollment(text,text,text,timestamptz,uuid,bigint,bigint,uuid,uuid,bytea,text,jsonb)')::oid,
    to_regprocedure('groundbnb.record_factor_enrollment_attempt(text,text,text,timestamptz,uuid,uuid,uuid,uuid,bigint,bytea,text)')::oid,
    to_regprocedure('groundbnb.verify_factor_enrollment(text,text,text,timestamptz,uuid,uuid,uuid,uuid,bigint,bytea,bigint)')::oid,
    to_regprocedure('groundbnb.read_factor_enrollment_receipt(text,text,text,timestamptz,uuid,text,uuid,uuid,bigint)')::oid]) AS x(v);
  IF enrollment_functions IS DISTINCT FROM expected_enrollment_functions OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname IN
        ('read_factor_enrollment_context','read_pending_factor_for_enrollment','begin_factor_enrollment',
         'record_factor_enrollment_attempt','verify_factor_enrollment','read_factor_enrollment_receipt') AND
         (p.proowner IS DISTINCT FROM owner_oid OR p.prosecdef IS DISTINCT FROM true OR
          p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
          has_function_privilege(app_oid,p.oid,'EXECUTE') OR has_function_privilege(factor_oid,p.oid,'EXECUTE') OR
          EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
            WHERE acl.grantee=0 OR acl.grantee<>p.proowner OR acl.privilege_type<>'EXECUTE' OR acl.is_grantable))) THEN
    RAISE EXCEPTION 'Enrollment entrypoints are not the exact private SECURITY DEFINER set';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='groundbnb' AND p.proname='_guard_factor_enrollment_operation' AND p.prorettype='trigger'::regtype) IS DISTINCT FROM 1 OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname='_guard_factor_enrollment_operation' AND
         (p.proowner IS DISTINCT FROM owner_oid OR p.prosecdef IS DISTINCT FROM false OR
          p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
          has_function_privilege(app_oid,p.oid,'EXECUTE') OR has_function_privilege(factor_oid,p.oid,'EXECUTE') OR
          EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
            WHERE acl.grantee=0 OR acl.grantee<>p.proowner OR acl.is_grantable))) OR
     (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid='groundbnb.factor_enrollment_operations'::regclass AND NOT t.tgisinternal) IS DISTINCT FROM 1 OR
     NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid='groundbnb.factor_enrollment_operations'::regclass AND
       NOT t.tgisinternal AND t.tgname='factor_enrollment_operation_immutable' AND
       t.tgfoid=to_regprocedure('groundbnb._guard_factor_enrollment_operation()')) THEN
    RAISE EXCEPTION 'Enrollment receipt immutability guard differs';
  END IF;

  SELECT count(*) INTO operations_before FROM groundbnb.factor_enrollment_operations;
  SELECT count(*) INTO challenges_before FROM groundbnb.factor_challenge_operations;
  SELECT count(*) INTO epochs_before FROM groundbnb.account_security_epochs;
  SELECT count(*) INTO events_before FROM groundbnb.security_epoch_events;
  SELECT count(*) INTO factors_before FROM groundbnb.privileged_factor_enrollments;
  SELECT count(*) INTO recoveries_before FROM groundbnb.privileged_recovery_records;
  SELECT count(*) INTO steps_before FROM groundbnb.accepted_factor_steps;
  SELECT count(*) INTO attestations_before FROM groundbnb.privileged_factor_attestations;
  SELECT count(*) INTO attempts_before FROM groundbnb.factor_attempt_windows;
  SELECT count(*) INTO audits_before FROM groundbnb.privileged_factor_audit;
  SELECT count(*) INTO activity_before FROM groundbnb.privileged_session_activity;

  failed:=false;
  BEGIN
    PERFORM groundbnb.read_factor_enrollment_context(identity_issuer,fake_subject,fake_session,clock_timestamp()+interval '1 hour');
    failed:=true;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM IS DISTINCT FROM 'Factor enrollment owner or session unavailable' THEN RAISE; END IF;
  END;
  IF failed THEN RAISE EXCEPTION 'Unmapped context unexpectedly returned'; END IF;
  failed:=false;
  BEGIN
    PERFORM groundbnb.read_pending_factor_for_enrollment(identity_issuer,fake_subject,fake_session,
      clock_timestamp()+interval '1 hour',begin_op,fake_account,candidate_factor,1);
    failed:=true;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM IS DISTINCT FROM 'Pending factor unavailable' THEN RAISE; END IF;
  END;
  IF failed THEN RAISE EXCEPTION 'Unmapped pending-factor read unexpectedly returned'; END IF;
  result:=groundbnb.begin_factor_enrollment(identity_issuer,fake_subject,fake_session,clock_timestamp()+interval '1 hour',
    fake_account,0,1,candidate_factor,begin_op,fake_fingerprint,'synthetic-key',
    jsonb_build_object('version',1,'keyId','synthetic-key','nonce','AAAAAAAAAAAAAAAA',
      'ciphertext',repeat('A',43),'tag',repeat('A',22)));
  IF result->>'status' IS DISTINCT FROM 'rejected' THEN RAISE EXCEPTION 'Unmapped begin was not denied'; END IF;
  result:=groundbnb.record_factor_enrollment_attempt(identity_issuer,fake_subject,fake_session,clock_timestamp()+interval '1 hour',
    begin_op,attempt_op,fake_account,candidate_factor,1,fake_fingerprint,'invalid');
  IF result->>'status' IS DISTINCT FROM 'unknown' THEN RAISE EXCEPTION 'Unmapped attempt write was not denied'; END IF;
  result:=groundbnb.verify_factor_enrollment(identity_issuer,fake_subject,fake_session,clock_timestamp()+interval '1 hour',
    begin_op,verify_op,fake_account,candidate_factor,1,fake_fingerprint,1);
  IF result->>'status' IS DISTINCT FROM 'unknown' THEN RAISE EXCEPTION 'Unmapped verification write was not denied'; END IF;
  failed:=false;
  BEGIN
    PERFORM groundbnb.read_factor_enrollment_receipt(identity_issuer,fake_subject,fake_session,
      clock_timestamp()+interval '1 hour',verify_op,'verify',fake_account,candidate_factor,1);
    failed:=true;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM IS DISTINCT FROM 'Factor enrollment receipt unavailable' THEN RAISE; END IF;
  END;
  IF failed THEN RAISE EXCEPTION 'Unmapped receipt read unexpectedly returned'; END IF;

  IF (SELECT count(*) FROM groundbnb.factor_enrollment_operations) IS DISTINCT FROM operations_before OR
     (SELECT count(*) FROM groundbnb.factor_challenge_operations) IS DISTINCT FROM challenges_before OR
     (SELECT count(*) FROM groundbnb.account_security_epochs) IS DISTINCT FROM epochs_before OR
     (SELECT count(*) FROM groundbnb.security_epoch_events) IS DISTINCT FROM events_before OR
     (SELECT count(*) FROM groundbnb.privileged_factor_enrollments) IS DISTINCT FROM factors_before OR
     (SELECT count(*) FROM groundbnb.privileged_recovery_records) IS DISTINCT FROM recoveries_before OR
     (SELECT count(*) FROM groundbnb.accepted_factor_steps) IS DISTINCT FROM steps_before OR
     (SELECT count(*) FROM groundbnb.privileged_factor_attestations) IS DISTINCT FROM attestations_before OR
     (SELECT count(*) FROM groundbnb.factor_attempt_windows) IS DISTINCT FROM attempts_before OR
     (SELECT count(*) FROM groundbnb.privileged_factor_audit) IS DISTINCT FROM audits_before OR
     (SELECT count(*) FROM groundbnb.privileged_session_activity) IS DISTINCT FROM activity_before THEN
    RAISE EXCEPTION 'Unmapped closed-path probes changed factor history';
  END IF;
  RAISE NOTICE 'M1_FACTOR_ENROLLMENT_CLOSED_PATHS_ROLLBACK_PENDING';
END $$;
ROLLBACK;
