-- M1-01V/W rollback-only closed-path acceptance for exact 0012.
-- Uses a deliberately unmapped synthetic subject and checks only that a fixed marker session ID is absent.
-- Never reads/returns session credential values, creates Auth sessions, inserts factor history, or grants access.
-- Preparation only; execute only after separate exact-branch approval.
BEGIN;
DO $$
DECLARE
  e record; app_role text; app_oid oid; owner_oid oid; role_record record;
  identity_issuer text; fake_subject constant text:='10000000-0000-4000-8000-000000000001';
  fake_session constant text:='10000000-0000-4000-8000-000000000002';
  op_totp constant uuid:='10000000-0000-4000-8000-000000000003';
  op_recovery constant uuid:='10000000-0000-4000-8000-000000000004';
  op_attempt constant uuid:='10000000-0000-4000-8000-000000000005';
  function_signature text; function_oid oid; function_owner oid; function_config text[];
  result jsonb; failed boolean; observed_error text; expires_at timestamptz:=clock_timestamp()+interval '1 hour';
  op_count bigint; observed_attempts bigint; audit_count bigint;
BEGIN
  IF current_database() IS DISTINCT FROM 'groundbnb' OR session_user IS DISTINCT FROM 'neondb_owner' THEN
    RAISE EXCEPTION 'Requires groundbnb as neondb_owner';
  END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  identity_issuer:=CASE e.kind
    WHEN 'local' THEN 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth'
    WHEN 'preview' THEN 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth' END;
  IF app_role IS NULL OR
     (SELECT count(*) FROM groundbnb.schema_migrations) IS DISTINCT FROM 12 OR
     (SELECT count(*) FROM groundbnb.schema_migrations WHERE version IN (
       '0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
       '0005_profile_records','0006_profile_transfer','0007_membership_foundation',
       '0008_provider_reservations','0009_privileged_factors','0010_factor_recovery_activity',
       '0011_membership_reader','0012_factor_service')) IS DISTINCT FROM 12 THEN
    RAISE EXCEPTION 'Requires exact pinned local/preview migration baseline 0001-0012';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user") IS DISTINCT FROM 1 OR NOT EXISTS(
      SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic Auth fixture';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.account_identities
      WHERE issuer=identity_issuer AND subject=fake_subject) THEN
    RAISE EXCEPTION 'Closed-path subject marker is unexpectedly mapped';
  END IF;
  IF EXISTS(SELECT 1 FROM neon_auth.session WHERE id=fake_session::uuid) THEN
    RAISE EXCEPTION 'Closed-path session marker unexpectedly exists';
  END IF;

  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=app_role;
  app_oid:=role_record.oid;
  SELECT oid INTO STRICT owner_oid FROM pg_roles WHERE rolname='neondb_owner';
  IF NOT role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole OR
     role_record.rolreplication OR role_record.rolbypassrls OR role_record.rolinherit OR
     role_record.rolconnlimit IS DISTINCT FROM 4 OR
     (role_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) IS DISTINCT FROM true OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=app_oid) OR
     has_database_privilege(app_oid,current_database(),'CREATE') OR has_schema_privilege(app_oid,'groundbnb','CREATE') OR
     COALESCE((SELECT array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
         AND has_function_privilege(app_oid,p.oid,'EXECUTE')),ARRAY[]::text[]) IS DISTINCT FROM
       ARRAY['groundbnb.read_profile(text,text)',
             'groundbnb.read_profile_operation(text,text,uuid)',
             'groundbnb.save_profile(text,text,uuid,bigint,jsonb)',
             'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)',
             'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)']::text[] OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m','f','S') AND c.relname NOT IN ('environment_identity','schema_migrations'))
           OR n.nspname='neon_auth') AND
         (CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
            has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') ELSE false END OR
          CASE WHEN c.relkind='S' THEN
            has_sequence_privilege(app_oid,c.oid,'USAGE') OR has_sequence_privilege(app_oid,c.oid,'SELECT') OR
            has_sequence_privilege(app_oid,c.oid,'UPDATE') ELSE false END)) OR
     has_table_privilege(app_oid,'groundbnb.factor_challenge_operations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
    RAISE EXCEPTION 'Pinned restricted application ACL baseline differs';
  END IF;

  FOREACH function_signature IN ARRAY ARRAY[
    'groundbnb.read_factor_challenge_state(text,text,text,timestamptz)',
    'groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer)',
    'groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer)',
    'groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer)',
    'groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text)',
    'groundbnb._factor_lock_identity(text,text,text,timestamptz,boolean)',
    'groundbnb._factor_bucket_fingerprint()',
    'groundbnb._guard_factor_challenge_operation()'
  ] LOOP
    SELECT p.oid,p.proowner,p.proconfig INTO STRICT function_oid,function_owner,function_config
      FROM pg_proc p WHERE p.oid=to_regprocedure(function_signature)::oid;
    IF function_owner IS DISTINCT FROM owner_oid OR has_function_privilege(app_oid,function_oid,'EXECUTE') OR
       EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
         aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
         WHERE p.oid=function_oid AND acl.grantee<>function_owner AND acl.privilege_type='EXECUTE') THEN
      RAISE EXCEPTION 'A factor-service function has an unexpected owner or EXECUTE grant';
    END IF;
    IF function_signature LIKE 'groundbnb.read_factor_challenge_state(%' OR
       function_signature LIKE 'groundbnb.record_factor_challenge_attempt(%' OR
       function_signature LIKE 'groundbnb.consume_factor_totp_candidate(%' OR
       function_signature LIKE 'groundbnb.consume_factor_recovery_candidate(%' OR
       function_signature LIKE 'groundbnb.read_factor_operation_receipt(%' OR
       function_signature LIKE 'groundbnb._factor_lock_identity(%' THEN
      IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=function_oid) OR
         (function_config @> ARRAY['search_path=pg_catalog, pg_temp']) IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Factor SECURITY DEFINER configuration differs';
      END IF;
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid='groundbnb.factor_challenge_operations'::regclass
       AND c.relrowsecurity AND NOT c.relforcerowsecurity) OR
     EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) acl
       WHERE c.oid='groundbnb.factor_challenge_operations'::regclass AND acl.grantee<>c.relowner) THEN
    RAISE EXCEPTION 'Factor operation table is not private and RLS-enabled';
  END IF;

  SELECT count(*) INTO op_count FROM groundbnb.factor_challenge_operations;
  SELECT COALESCE(sum(attempt_count),0) INTO observed_attempts FROM groundbnb.factor_attempt_windows;
  SELECT count(*) INTO audit_count FROM groundbnb.privileged_factor_audit;

  -- The fake UUID subject is deliberately unmapped; only the fixed absent ID is passed to the private probes.
  failed:=false;
  BEGIN
    result:=groundbnb.read_factor_challenge_state(identity_issuer,fake_subject,fake_session,expires_at);
    RAISE EXCEPTION 'Expected an unmapped synthetic session to be denied';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS observed_error=MESSAGE_TEXT;
    IF observed_error='Expected an unmapped synthetic session to be denied' THEN RAISE; END IF;
    failed:=observed_error='Factor challenge owner or session unavailable';
  END;
  IF NOT failed THEN RAISE EXCEPTION 'Challenge state did not fail closed'; END IF;

  result:=groundbnb.record_factor_challenge_attempt(identity_issuer,fake_subject,fake_session,expires_at,
    '10000000-0000-4000-8000-000000000006',0,op_attempt,'totp','rejected',5,900);
  IF result->>'status' IS DISTINCT FROM 'unknown' THEN RAISE EXCEPTION 'Unmapped failed-attempt call was not closed'; END IF;
  result:=groundbnb.consume_factor_totp_candidate(identity_issuer,fake_subject,fake_session,expires_at,
    '10000000-0000-4000-8000-000000000006',0,1,op_totp,5,900);
  IF result->>'status' IS DISTINCT FROM 'rejected' THEN RAISE EXCEPTION 'Unmapped TOTP consume was not rejected'; END IF;
  result:=groundbnb.consume_factor_recovery_candidate(identity_issuer,fake_subject,fake_session,expires_at,
    '10000000-0000-4000-8000-000000000006',0,'10000000-0000-4000-8000-000000000007',op_recovery,5,900);
  IF result->>'status' IS DISTINCT FROM 'rejected' THEN RAISE EXCEPTION 'Unmapped recovery consume was not rejected'; END IF;

  failed:=false;
  BEGIN
    result:=groundbnb.read_factor_operation_receipt(identity_issuer,fake_subject,fake_session,expires_at,op_totp,'totp');
    RAISE EXCEPTION 'Expected an unmapped receipt lookup to be denied';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS observed_error=MESSAGE_TEXT;
    IF observed_error='Expected an unmapped receipt lookup to be denied' THEN RAISE; END IF;
    failed:=observed_error='Factor operation identity unavailable';
  END;
  IF NOT failed THEN RAISE EXCEPTION 'Operation receipt lookup did not fail closed'; END IF;

  IF (SELECT count(*) FROM groundbnb.factor_challenge_operations) IS DISTINCT FROM op_count OR
     (SELECT COALESCE(sum(attempt_count),0) FROM groundbnb.factor_attempt_windows) IS DISTINCT FROM observed_attempts OR
     (SELECT count(*) FROM groundbnb.privileged_factor_audit) IS DISTINCT FROM audit_count THEN
    RAISE EXCEPTION 'Closed-path operator probes changed durable factor history';
  END IF;
END $$;
SELECT 'M1_FACTOR_SERVICE_CLOSED_PATHS_ROLLBACK_PENDING' AS result;
ROLLBACK;
