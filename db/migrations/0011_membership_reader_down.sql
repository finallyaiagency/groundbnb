-- Prepared rollback for 0011. Removes only its private reader and receipt.
BEGIN;
DO $$
DECLARE e record; app_role text; role_record record; function_oid oid; function_owner oid; receipt_count integer;
BEGIN
  IF current_database()<>'groundbnb' OR session_user<>'neondb_owner' THEN
    RAISE EXCEPTION 'Expected groundbnb as neondb_owner';
  END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  SELECT count(*) INTO receipt_count FROM groundbnb.schema_migrations;
  IF app_role IS NULL OR receipt_count IS DISTINCT FROM 11 OR
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
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0011_membership_reader') THEN
    RAISE EXCEPTION 'Requires pinned local/preview with exact 0001-0011 baseline';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user") IS DISTINCT FROM 1 OR NOT EXISTS(
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
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_patch(jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_records(jsonb,jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_account(text,text)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_snapshot(uuid)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m') AND c.relname NOT IN ('environment_identity','schema_migrations'))
           OR n.nspname='neon_auth')
         AND has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
    RAISE EXCEPTION 'Pinned app-role function-only ACL baseline differs from approved M1 boundary';
  END IF;
  SELECT p.oid,p.proowner INTO STRICT function_oid,function_owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND p.proname='read_membership' AND p.proargtypes='25 25'::oidvector;
  IF has_function_privilege(role_record.oid,function_oid,'EXECUTE') OR EXISTS(
      SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
        WHERE p.oid=function_oid AND acl.grantee<>function_owner) THEN
    RAISE EXCEPTION 'Rollback refused: membership reader has unexpected EXECUTE grants';
  END IF;
END $$;

DROP FUNCTION groundbnb.read_membership(text,text);
DELETE FROM groundbnb.schema_migrations WHERE version='0011_membership_reader';
COMMIT;
