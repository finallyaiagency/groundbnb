-- Remove only empty 0012 private factor-service preparation.
BEGIN;
DO $$
DECLARE e record; app_role text; app_oid oid; role_record record; receipt_count integer;
BEGIN
  IF current_database()<>'groundbnb' OR session_user<>'neondb_owner' THEN
    RAISE EXCEPTION 'Expected groundbnb as neondb_owner';
  END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  SELECT count(*) INTO receipt_count FROM groundbnb.schema_migrations;
  IF app_role IS NULL OR receipt_count IS DISTINCT FROM 12 OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0003_profile_domain') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0004_profile_operation_status') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0005_profile_records') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0006_profile_transfer') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0007_membership_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0008_provider_reservations') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0009_privileged_factors') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0010_factor_recovery_activity') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0011_membership_reader') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0012_factor_service') THEN
    RAISE EXCEPTION 'Requires exact pinned local/preview 0001-0012 baseline';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user") IS DISTINCT FROM 1 OR NOT EXISTS(
      SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic Auth fixture';
  END IF;
  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=app_role;
  app_oid:=role_record.oid;
  IF NOT role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole OR
     role_record.rolreplication OR role_record.rolbypassrls OR role_record.rolinherit OR role_record.rolconnlimit<>4 OR
     (role_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) IS DISTINCT FROM true OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=app_oid) OR
     has_database_privilege(app_oid,current_database(),'CREATE') OR has_schema_privilege(app_oid,'groundbnb','CREATE') OR
     has_function_privilege(app_oid,'groundbnb.read_factor_challenge_state(text,text,text,timestamptz)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._factor_lock_identity(text,text,text,timestamptz,boolean)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._factor_bucket_fingerprint()','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._guard_factor_challenge_operation()','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m','f','S') AND c.relname NOT IN ('environment_identity','schema_migrations'))
           OR n.nspname='neon_auth') AND
         (CASE WHEN c.relkind IN ('r','p','v','m','f') THEN has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') ELSE false END OR
          CASE WHEN c.relkind='S' THEN has_sequence_privilege(app_oid,c.oid,'USAGE,SELECT,UPDATE') ELSE false END)) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype) AND
       has_function_privilege(app_oid,p.oid,'EXECUTE') AND NOT (
         (p.proname='read_profile' AND p.proargtypes='25 25'::oidvector) OR
         (p.proname='save_profile' AND p.proargtypes='25 25 2950 20 3802'::oidvector) OR
         (p.proname='read_profile_operation' AND p.proargtypes='25 25 2950'::oidvector) OR
         (p.proname='save_profile_records' AND p.proargtypes='25 25 2950 20 3802 3802'::oidvector) OR
         (p.proname='save_profile_transfer' AND p.proargtypes='25 25 2950 20 3802 3802'::oidvector))) THEN
    RAISE EXCEPTION 'Pinned app-role function-only ACL baseline differs from approved M1 boundary';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.factor_challenge_operations) OR
     EXISTS(SELECT 1 FROM groundbnb.account_security_epochs) OR
     EXISTS(SELECT 1 FROM groundbnb.security_epoch_events) OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_factor_enrollments) OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_recovery_records) OR
     EXISTS(SELECT 1 FROM groundbnb.accepted_factor_steps) OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_factor_attestations) OR
     EXISTS(SELECT 1 FROM groundbnb.factor_attempt_windows) OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_factor_audit) OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_session_activity) THEN
    RAISE EXCEPTION 'Rollback refused: factor history or operation receipts would be lost';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) acl
      WHERE c.oid='groundbnb.factor_challenge_operations'::regclass AND acl.grantee<>c.relowner) THEN
    RAISE EXCEPTION 'Rollback refused: factor receipt table has unexpected grants';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='groundbnb' AND p.proname IN ('_factor_lock_identity','_factor_bucket_fingerprint',
        '_guard_factor_challenge_operation','read_factor_challenge_state','record_factor_challenge_attempt',
        'consume_factor_totp_candidate','consume_factor_recovery_candidate','read_factor_operation_receipt')
        AND has_function_privilege(app_oid,p.oid,'EXECUTE')) OR
     EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE p.pronamespace='groundbnb'::regnamespace AND p.proname IN ('_factor_lock_identity',
        '_factor_bucket_fingerprint','_guard_factor_challenge_operation','read_factor_challenge_state',
        'record_factor_challenge_attempt','consume_factor_totp_candidate','consume_factor_recovery_candidate',
        'read_factor_operation_receipt') AND acl.grantee<>p.proowner AND acl.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'Rollback refused: factor functions have unexpected grants';
  END IF;
END $$;

DROP FUNCTION groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text);
DROP FUNCTION groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer);
DROP FUNCTION groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer);
DROP FUNCTION groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer);
DROP FUNCTION groundbnb.read_factor_challenge_state(text,text,text,timestamptz);
DROP FUNCTION groundbnb._factor_bucket_fingerprint();
DROP FUNCTION groundbnb._factor_lock_identity(text,text,text,timestamptz,boolean);
DROP TRIGGER factor_challenge_operation_immutable ON groundbnb.factor_challenge_operations;
DROP FUNCTION groundbnb._guard_factor_challenge_operation();
DROP TABLE groundbnb.factor_challenge_operations;
DELETE FROM groundbnb.schema_migrations WHERE version='0012_factor_service';
COMMIT;
