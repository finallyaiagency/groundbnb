-- Remove only an unused dormant 0014 enrollment contract; preserve factor history.
BEGIN;
DO $$
DECLARE e record; app_role text; factor_role text; app_oid oid; factor_oid oid;
  owner_oid oid; cloud_admin_oid oid; app_record record; factor_record record;
  receipt_count integer; app_functions oid[]; factor_functions oid[];
  expected_app_functions oid[]; expected_factor_functions oid[];
BEGIN
  IF current_database() IS DISTINCT FROM 'groundbnb' OR session_user IS DISTINCT FROM 'neondb_owner' OR
     current_user IS DISTINCT FROM 'neondb_owner' THEN
    RAISE EXCEPTION 'Expected groundbnb as neondb_owner';
  END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  factor_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_factor_service'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_factor_service' END;
  SELECT count(*) INTO receipt_count FROM groundbnb.schema_migrations;
  IF app_role IS NULL OR factor_role IS NULL OR receipt_count IS DISTINCT FROM 14 OR
     (SELECT count(*) FROM groundbnb.schema_migrations WHERE version=ANY(ARRAY[
       '0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
       '0005_profile_records','0006_profile_transfer','0007_membership_foundation','0008_provider_reservations',
       '0009_privileged_factors','0010_factor_recovery_activity','0011_membership_reader',
       '0012_factor_service','0013_factor_service_principal','0014_factor_enrollment']::text[])) IS DISTINCT FROM 14 OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname IN
        ('read_factor_enrollment_context','read_pending_factor_for_enrollment','begin_factor_enrollment',
         'record_factor_enrollment_attempt','verify_factor_enrollment','read_factor_enrollment_receipt') AND
        (p.proowner IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='neondb_owner') OR
         p.prosecdef IS DISTINCT FROM true OR
         p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
         has_function_privilege(app_role,p.oid,'EXECUTE') OR has_function_privilege(factor_role,p.oid,'EXECUTE') OR
         EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
           WHERE acl.grantee=0 OR acl.grantee<>p.proowner OR acl.privilege_type<>'EXECUTE' OR acl.is_grantable))) OR
     (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname IN
        ('read_factor_enrollment_context','read_pending_factor_for_enrollment','begin_factor_enrollment',
         'record_factor_enrollment_attempt','verify_factor_enrollment','read_factor_enrollment_receipt')) IS DISTINCT FROM 6 THEN
    RAISE EXCEPTION 'Requires exact pinned local/preview 0001-0014 private dormant baseline';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname='_guard_factor_enrollment_operation' AND p.prorettype='trigger'::regtype) IS DISTINCT FROM 1 OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname='_guard_factor_enrollment_operation' AND
         (p.proowner IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='neondb_owner') OR
          p.prosecdef IS DISTINCT FROM false OR
          p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
          has_function_privilege(app_role,p.oid,'EXECUTE') OR has_function_privilege(factor_role,p.oid,'EXECUTE') OR
          EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
            WHERE acl.grantee=0 OR acl.grantee<>p.proowner OR acl.is_grantable))) OR
     (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid='groundbnb.factor_enrollment_operations'::regclass AND NOT t.tgisinternal) IS DISTINCT FROM 1 OR
     NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid='groundbnb.factor_enrollment_operations'::regclass AND
       NOT t.tgisinternal AND t.tgname='factor_enrollment_operation_immutable' AND
       t.tgfoid=to_regprocedure('groundbnb._guard_factor_enrollment_operation()')) THEN
    RAISE EXCEPTION 'Enrollment receipt immutability guard differs';
  END IF;
  SELECT oid INTO STRICT owner_oid FROM pg_roles WHERE rolname='neondb_owner';
  SELECT oid INTO STRICT cloud_admin_oid FROM pg_roles WHERE rolname='cloud_admin';
  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  SELECT oid INTO STRICT factor_oid FROM pg_roles WHERE rolname=factor_role;
  SELECT * INTO STRICT app_record FROM pg_roles WHERE oid=app_oid;
  SELECT * INTO STRICT factor_record FROM pg_roles WHERE oid=factor_oid;
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
  IF NOT app_record.rolcanlogin OR app_record.rolsuper OR app_record.rolcreatedb OR app_record.rolcreaterole OR
     app_record.rolreplication OR app_record.rolbypassrls OR app_record.rolinherit OR
     app_record.rolconnlimit IS DISTINCT FROM 4 OR
     (app_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) IS DISTINCT FROM true OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=app_oid) OR
     (SELECT count(*) FROM pg_auth_members WHERE roleid=app_oid) IS DISTINCT FROM 1 OR
     NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=owner_oid AND roleid=app_oid AND
       grantor=cloud_admin_oid AND admin_option IS TRUE AND inherit_option IS FALSE AND set_option IS FALSE) OR
     app_functions IS DISTINCT FROM expected_app_functions OR
     factor_record.rolcanlogin IS DISTINCT FROM false OR factor_record.rolsuper OR factor_record.rolcreatedb OR
     factor_record.rolcreaterole OR factor_record.rolreplication OR factor_record.rolbypassrls OR factor_record.rolinherit OR
     factor_record.rolconnlimit IS DISTINCT FROM 2 OR factor_record.rolconfig IS NOT NULL OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=factor_oid) OR
     (SELECT count(*) FROM pg_auth_members WHERE roleid=factor_oid) IS DISTINCT FROM 1 OR
     NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=owner_oid AND roleid=factor_oid AND
       grantor=cloud_admin_oid AND admin_option IS TRUE AND inherit_option IS FALSE AND set_option IS FALSE) OR
     factor_functions IS DISTINCT FROM expected_factor_functions OR
     has_database_privilege(app_oid,current_database(),'CREATE') OR has_schema_privilege(app_oid,'groundbnb','CREATE') OR
     has_schema_privilege(app_oid,'groundbnb','USAGE') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.environment_identity','SELECT') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.schema_migrations','SELECT') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.environment_identity','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_table_privilege(app_oid,'groundbnb.schema_migrations','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_schema_privilege(factor_oid,'groundbnb','CREATE') OR has_schema_privilege(factor_oid,'groundbnb','USAGE') IS DISTINCT FROM true OR
     EXISTS(SELECT 1 FROM aclexplode(COALESCE((SELECT c.relacl FROM pg_class c
       WHERE c.oid='groundbnb.factor_enrollment_operations'::regclass),acldefault('r',owner_oid))) acl
       WHERE acl.grantee=0 OR acl.grantee<>owner_oid OR acl.is_grantable) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relname NOT IN ('environment_identity','schema_migrations')) OR n.nspname='neon_auth')
         AND c.relkind IN ('r','p','v','m','f','S') AND
         (CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
            has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          ELSE false END OR CASE WHEN c.relkind='S' THEN
            has_sequence_privilege(app_oid,c.oid,'USAGE,SELECT,UPDATE') ELSE false END)) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname IN ('groundbnb','neon_auth') AND c.relkind IN ('r','p','v','m','f','S') AND
         (CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
            has_table_privilege(factor_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          ELSE false END OR CASE WHEN c.relkind='S' THEN
            has_sequence_privilege(factor_oid,c.oid,'USAGE,SELECT,UPDATE') ELSE false END)) THEN
    RAISE EXCEPTION 'Pinned app/factor access or principal boundary differs';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.factor_enrollment_operations) OR
     EXISTS(SELECT 1 FROM groundbnb.factor_challenge_operations) OR
     EXISTS(SELECT 1 FROM groundbnb.account_security_epochs) OR
     EXISTS(SELECT 1 FROM groundbnb.security_epoch_events) OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_factor_enrollments) OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_recovery_records) OR
     EXISTS(SELECT 1 FROM groundbnb.accepted_factor_steps) OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_factor_attestations) OR
     EXISTS(SELECT 1 FROM groundbnb.factor_attempt_windows) OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_factor_audit) OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_session_activity) THEN
    RAISE EXCEPTION 'Rollback refused: factor or lifecycle history would be lost';
  END IF;
END $$;

DROP FUNCTION groundbnb.read_factor_enrollment_receipt(text,text,text,timestamptz,uuid,text,uuid,uuid,bigint);
DROP FUNCTION groundbnb.verify_factor_enrollment(text,text,text,timestamptz,uuid,uuid,uuid,uuid,bigint,bytea,bigint);
DROP FUNCTION groundbnb.record_factor_enrollment_attempt(text,text,text,timestamptz,uuid,uuid,uuid,uuid,bigint,bytea,text);
DROP FUNCTION groundbnb.begin_factor_enrollment(text,text,text,timestamptz,uuid,bigint,bigint,uuid,uuid,bytea,text,jsonb);
DROP FUNCTION groundbnb.read_pending_factor_for_enrollment(text,text,text,timestamptz,uuid,uuid,uuid,bigint);
DROP FUNCTION groundbnb.read_factor_enrollment_context(text,text,text,timestamptz);
DROP TRIGGER factor_enrollment_operation_immutable ON groundbnb.factor_enrollment_operations;
DROP FUNCTION groundbnb._guard_factor_enrollment_operation();
DROP TABLE groundbnb.factor_enrollment_operations;
DELETE FROM groundbnb.schema_migrations WHERE version='0014_factor_enrollment';
COMMIT;
