-- Prepared rollback for 0005. It refuses to discard any normalized record or record-operation acknowledgment.
BEGIN;
DO $$
DECLARE e record; app_role text; role_record record; applied timestamptz;
BEGIN
  IF current_database()<>'groundbnb' THEN RAISE EXCEPTION 'Expected groundbnb database'; END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  SELECT applied_at INTO STRICT applied FROM groundbnb.schema_migrations WHERE version='0005_profile_records';
  IF app_role IS NULL OR NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0003_profile_domain') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0004_profile_operation_status') THEN
    RAISE EXCEPTION 'Requires the pinned local/preview branch with migrations 0001-0005 applied';
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
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_records(jsonb,jsonb)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relname NOT IN ('environment_identity','schema_migrations')) OR n.nspname='neon_auth')
       AND c.relkind IN ('r','p','v','m') AND has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
    RAISE EXCEPTION 'Pinned application role baseline/ACL differs from approved M1 profile boundary';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.profile_vehicles) OR EXISTS(SELECT 1 FROM groundbnb.profile_notes) OR
     EXISTS(SELECT 1 FROM groundbnb.profile_operations WHERE request->>'operationKind'='profile_records') THEN
    RAISE EXCEPTION 'Rollback refused: normalized records or profile-record operation acknowledgments would be lost';
  END IF;
END $$;

-- Restore the exact 0003 snapshot contract before removing the normalized tables.
CREATE OR REPLACE FUNCTION groundbnb._profile_snapshot(account_uuid uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp AS $$
  SELECT jsonb_build_object('accountId',p.account_id,'revision',p.revision,
    'createdAt',p.created_at,'updatedAt',p.updated_at,'answers',COALESCE((
      SELECT jsonb_object_agg(a.field,jsonb_build_object('value',a.value,'answered',a.answered,
        'scope',a.scope,'updatedAt',a.updated_at)) FROM groundbnb.profile_answers a WHERE a.account_id=p.account_id
    ),'{}'::jsonb)) FROM groundbnb.profiles p WHERE p.account_id=account_uuid
$$;
DROP FUNCTION groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb);
DROP FUNCTION groundbnb._valid_profile_records(jsonb,jsonb);
DROP TABLE groundbnb.profile_vehicles;
DROP TABLE groundbnb.profile_notes;
DELETE FROM groundbnb.schema_migrations WHERE version='0005_profile_records';
COMMIT;
