-- Read-only catalog assertions as the operator, before credential activation.
-- Direct login/read/denial tests are separate; SET ROLE is not available to this operator.
DO $$
DECLARE
  environment_kind text;
  expected_role text;
  role_record record;
BEGIN
  SELECT kind INTO STRICT environment_kind FROM groundbnb.environment_identity WHERE singleton;
  expected_role := CASE environment_kind
    WHEN 'production' THEN 'groundbnb_production_probe'
    WHEN 'preview' THEN 'groundbnb_preview_probe'
    WHEN 'local' THEN 'groundbnb_local_probe'
    WHEN 'recovery' THEN 'groundbnb_recovery_reader'
    ELSE NULL END;
  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname = expected_role;
  IF role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb
     OR role_record.rolcreaterole OR role_record.rolbypassrls OR role_record.rolreplication
     OR role_record.rolinherit OR role_record.rolconnlimit <> 4
     OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = role_record.oid)
     OR has_database_privilege(role_record.oid, current_database(), 'CREATE')
     OR has_schema_privilege(role_record.oid, 'groundbnb', 'CREATE')
     OR NOT has_table_privilege(role_record.oid, 'groundbnb.environment_identity', 'SELECT')
     OR NOT has_table_privilege(role_record.oid, 'groundbnb.schema_migrations', 'SELECT')
     OR has_table_privilege(role_record.oid, 'groundbnb.environment_identity', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR has_table_privilege(role_record.oid, 'groundbnb.schema_migrations', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR has_table_privilege(role_record.oid, 'groundbnb.synthetic_identities', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR NOT COALESCE(role_record.rolconfig, ARRAY[]::text[]) @> ARRAY['default_transaction_read_only=on','statement_timeout=5s'] THEN
    RAISE EXCEPTION 'M0 limited-role catalog assertion failed';
  END IF;
  IF to_regclass('neon_auth."user"') IS NOT NULL THEN
    IF has_table_privilege(role_record.oid, 'neon_auth."user"', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_table_privilege(role_record.oid, 'neon_auth.session', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
      RAISE EXCEPTION 'M0 probe must not access auth users/sessions';
    END IF;
  END IF;
  IF environment_kind = 'recovery' THEN
    IF NOT has_table_privilege(role_record.oid, 'recovery_control.events', 'SELECT')
       OR has_table_privilege(role_record.oid, 'recovery_control.events', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
      RAISE EXCEPTION 'M0 recovery role must read controls without modifying them';
    END IF;
  END IF;
END $$;

SELECT e.kind, e.branch_id, r.rolname, r.rolcanlogin,
       has_table_privilege(r.oid, 'groundbnb.environment_identity', 'SELECT') AS metadata_read,
       has_table_privilege(r.oid, 'groundbnb.environment_identity', 'UPDATE') AS metadata_write,
       pg_has_role(r.oid, 'neon_superuser', 'MEMBER') AS neon_admin
FROM groundbnb.environment_identity e JOIN pg_roles r ON r.rolname = CASE e.kind
  WHEN 'production' THEN 'groundbnb_production_probe'
  WHEN 'preview' THEN 'groundbnb_preview_probe'
  WHEN 'local' THEN 'groundbnb_local_probe'
  WHEN 'recovery' THEN 'groundbnb_recovery_reader' END
WHERE e.singleton;
