-- Prepared only: owner-scoped read of the original durable save acknowledgment.
BEGIN;
DO $$
DECLARE e record; app_role text; role_record record;
BEGIN
  IF current_database()<>'groundbnb' THEN RAISE EXCEPTION 'Expected groundbnb database'; END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role := CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app'
    ELSE NULL END;
  IF app_role IS NULL OR NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0003_profile_domain') OR
     EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0004_profile_operation_status') THEN
    RAISE EXCEPTION 'Requires the pinned local/preview branch with M0/M1-01D and M1-01F and no prior operation-status migration';
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
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_patch(jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_account(text,text)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_snapshot(uuid)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relname NOT IN ('environment_identity','schema_migrations')) OR n.nspname='neon_auth')
       AND c.relkind IN ('r','p','v','m') AND has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
    RAISE EXCEPTION 'Pinned application role baseline/ACL differs from the approved M1-01D boundary';
  END IF;
END $$;

CREATE FUNCTION groundbnb.read_profile_operation(identity_issuer text,identity_subject text,operation_uuid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; acknowledgment_json jsonb;
BEGIN
  account_uuid:=groundbnb._profile_account(identity_issuer,identity_subject);
  IF account_uuid IS NULL THEN RETURN jsonb_build_object('ok',false,'category','auth'); END IF;
  IF operation_uuid IS NULL THEN RETURN jsonb_build_object('ok',false,'category','validation'); END IF;
  SELECT acknowledgment INTO acknowledgment_json FROM groundbnb.profile_operations
    WHERE account_id=account_uuid AND operation_id=operation_uuid;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'status','not_found','operationId',operation_uuid); END IF;
  RETURN acknowledgment_json || jsonb_build_object('status','saved');
END $$;
REVOKE ALL ON FUNCTION groundbnb.read_profile_operation(text,text,uuid) FROM PUBLIC;
DO $$
DECLARE app_role text; app_oid oid;
BEGIN
  SELECT CASE kind WHEN 'local' THEN 'groundbnb_local_app' ELSE 'groundbnb_preview_app' END
    INTO STRICT app_role FROM groundbnb.environment_identity WHERE singleton;
  EXECUTE format('GRANT EXECUTE ON FUNCTION groundbnb.read_profile_operation(text,text,uuid) TO %I',app_role);
  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  IF NOT has_function_privilege(app_oid,'groundbnb.read_profile_operation(text,text,uuid)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE n.nspname='groundbnb' AND p.proname='read_profile_operation' AND acl.grantee=0 AND acl.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'Operation-status ACL assertion failed';
  END IF;
END $$;
INSERT INTO groundbnb.schema_migrations(version) VALUES('0004_profile_operation_status');
COMMIT;
