-- Proposed M1 access change: action-time client approval required before Run.
-- Run separately on pinned preview/local groundbnb databases only.
-- Dormant principals for the later profile migration; no password or login.
BEGIN;
DO $$
DECLARE
  environment_kind text;
  environment_branch text;
  app_role text;
  role_record record;
BEGIN
  IF current_database() <> 'groundbnb' THEN
    RAISE EXCEPTION 'Expected groundbnb database';
  END IF;
  SELECT kind, branch_id INTO STRICT environment_kind, environment_branch
    FROM groundbnb.environment_identity WHERE singleton;
  app_role := CASE
    WHEN environment_kind = 'preview' AND environment_branch = 'br-bitter-hall-b8ibnrfy'
      THEN 'groundbnb_preview_app'
    WHEN environment_kind = 'local' AND environment_branch = 'br-rough-flower-b8lerkcf'
      THEN 'groundbnb_local_app'
    ELSE NULL END;
  IF app_role IS NULL OR NOT EXISTS (
    SELECT 1 FROM groundbnb.schema_migrations WHERE version = '0001_environment'
  ) THEN
    RAISE EXCEPTION 'M1 requires the pinned synthetic branch and M0 baseline';
  END IF;
  -- Refuse collisions. Do not alter/reuse a probe, provider-managed or existing role.
  EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 4', app_role);
  EXECUTE format('GRANT CONNECT ON DATABASE groundbnb TO %I', app_role);
  EXECUTE format('GRANT USAGE ON SCHEMA groundbnb TO %I', app_role);
  EXECUTE format('GRANT SELECT ON groundbnb.environment_identity, groundbnb.schema_migrations TO %I', app_role);
  EXECUTE format('ALTER ROLE %I SET default_transaction_read_only = on', app_role);
  EXECUTE format('ALTER ROLE %I SET statement_timeout = %L', app_role, '5s');
  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname = app_role;
  IF role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb
    OR role_record.rolcreaterole OR role_record.rolreplication OR role_record.rolbypassrls
    OR role_record.rolinherit OR role_record.rolconnlimit <> 4
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = role_record.oid)
    OR has_database_privilege(role_record.oid, current_database(), 'CREATE')
    OR has_schema_privilege(role_record.oid, 'groundbnb', 'CREATE')
    OR has_table_privilege(role_record.oid, 'groundbnb.environment_identity', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_table_privilege(role_record.oid, 'groundbnb.schema_migrations', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_table_privilege(role_record.oid, 'groundbnb.synthetic_identities', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'neon_auth' AND c.relkind IN ('r','p','v','m')
        AND has_table_privilege(role_record.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    ) THEN
    RAISE EXCEPTION 'M1 dormant app role privilege assertion failed';
  END IF;
END $$;
COMMIT;

-- No profile/trip/Auth/control read/write, default future-table grants, role membership,
-- production/recovery change or existing probe change. Future profile migration grants
-- and distinct client-entered credentials need their own reviewed activation gate.
