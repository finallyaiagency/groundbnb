-- Roll back only empty 0010 recovery/activity preparation; preserve every challenge record.
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
     (SELECT count(*) FROM groundbnb.schema_migrations)<>10 OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0003_profile_domain') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0004_profile_operation_status') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0005_profile_records') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0006_profile_transfer') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0007_membership_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0008_provider_reservations') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0009_privileged_factors') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0010_factor_recovery_activity') THEN
    RAISE EXCEPTION 'Requires pinned local/preview with migrations 0001-0010 applied';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user")<>1 OR NOT EXISTS(
      SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic Auth fixture';
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
    RAISE EXCEPTION 'Pinned app-role or function-only ACL baseline differs from approved boundary';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.privileged_session_activity) OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_factor_attestations WHERE challenge_method='recovery') THEN
    RAISE EXCEPTION 'Rollback refused: recovery attestations or privileged activity history would be lost';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='groundbnb' AND p.proname IN ('_guard_factor_attestation_method',
        '_validate_factor_attestation_source','_guard_privileged_session_activity')
        AND has_function_privilege(role_record.oid,p.oid,'EXECUTE')) THEN
    RAISE EXCEPTION '0010 factor helper must remain private';
  END IF;
END $$;

DROP TABLE groundbnb.privileged_session_activity;
DROP TRIGGER factor_attestation_source_valid ON groundbnb.privileged_factor_attestations;
DROP TRIGGER factor_attestation_method_immutable ON groundbnb.privileged_factor_attestations;
DROP FUNCTION groundbnb._validate_factor_attestation_source();
DROP FUNCTION groundbnb._guard_privileged_session_activity();
DROP FUNCTION groundbnb._guard_factor_attestation_method();
ALTER TABLE groundbnb.privileged_factor_attestations
  DROP CONSTRAINT factor_attestation_activity_binding_unique,
  DROP CONSTRAINT factor_attestation_recovery_one_use,
  DROP CONSTRAINT factor_attestation_recovery_source_fk,
  DROP CONSTRAINT factor_attestation_source_exclusive_check,
  DROP CONSTRAINT factor_attestation_challenge_method_check;
ALTER TABLE groundbnb.privileged_factor_attestations
  ALTER COLUMN accepted_step SET NOT NULL,
  DROP COLUMN recovery_id,
  DROP COLUMN challenge_method;
DROP TRIGGER factor_enrollment_history_guard ON groundbnb.privileged_factor_enrollments;
CREATE TRIGGER factor_enrollment_history_guard BEFORE UPDATE OR DELETE
  ON groundbnb.privileged_factor_enrollments
  FOR EACH ROW EXECUTE FUNCTION groundbnb._guard_factor_enrollment_history();
DELETE FROM groundbnb.schema_migrations WHERE version='0010_factor_recovery_activity';
COMMIT;
