-- Prepared rollback for dormant 0009. Refuses every factor/security history row.
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
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0008_provider_reservations') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0009_privileged_factors') THEN
    RAISE EXCEPTION 'Requires pinned local/preview with migrations 0001-0009 applied';
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
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m') AND c.relname NOT IN ('environment_identity','schema_migrations'))
           OR n.nspname='neon_auth')
         AND has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
    RAISE EXCEPTION 'Pinned application role/function-only ACL baseline differs from approved M1 boundary';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='groundbnb' AND p.proname IN ('_guard_security_epoch','_guard_factor_enrollment_history',
        '_guard_recovery_consumption','_guard_accepted_factor_step','_guard_factor_attestation',
        '_guard_factor_attempt_window','_privileged_factor_audit_append_only',
        '_require_factor_epoch_event','_serialize_factor_attempt_window')
        AND has_function_privilege(role_record.oid,p.oid,'EXECUTE')) THEN
    RAISE EXCEPTION 'Privileged factor helper must remain private';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.account_security_epochs) OR
     EXISTS(SELECT 1 FROM groundbnb.security_epoch_events) OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_factor_enrollments) OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_recovery_records) OR
     EXISTS(SELECT 1 FROM groundbnb.accepted_factor_steps) OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_factor_attestations) OR
     EXISTS(SELECT 1 FROM groundbnb.factor_attempt_windows) OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_factor_audit) THEN
    RAISE EXCEPTION 'Rollback refused: privileged factor, recovery, rate, epoch, or audit history would be lost';
  END IF;
END $$;

DROP TABLE groundbnb.privileged_factor_audit;
DROP TABLE groundbnb.factor_attempt_windows;
DROP TABLE groundbnb.privileged_factor_attestations;
DROP TABLE groundbnb.accepted_factor_steps;
DROP TABLE groundbnb.privileged_recovery_records;
DROP TABLE groundbnb.privileged_factor_enrollments;
DROP TABLE groundbnb.security_epoch_events;
DROP TABLE groundbnb.account_security_epochs;
DROP FUNCTION groundbnb._privileged_factor_audit_append_only();
DROP FUNCTION groundbnb._guard_factor_attempt_window();
DROP FUNCTION groundbnb._serialize_factor_attempt_window();
DROP FUNCTION groundbnb._require_factor_epoch_event();
DROP FUNCTION groundbnb._guard_factor_attestation();
DROP FUNCTION groundbnb._guard_accepted_factor_step();
DROP FUNCTION groundbnb._guard_recovery_consumption();
DROP FUNCTION groundbnb._guard_factor_enrollment_history();
DROP FUNCTION groundbnb._guard_security_epoch();
DROP INDEX groundbnb.account_identity_owner_binding_idx;
DELETE FROM groundbnb.schema_migrations WHERE version='0009_privileged_factors';
COMMIT;
