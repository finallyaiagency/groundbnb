-- PROPOSAL: requires specific client approval before execution.
-- Run separately on each pinned branch using the operator account.
-- Creates NOLOGIN roles without passwords. Client activates each credential manually.
-- SQL creation avoids the neon_superuser membership added by Console/API creation.
BEGIN;
DO $$
DECLARE
  environment_kind text;
  environment_branch text;
  role_name text;
BEGIN
  IF current_database() <> 'groundbnb' THEN
    RAISE EXCEPTION 'Expected groundbnb database';
  END IF;
  SELECT kind, branch_id INTO STRICT environment_kind, environment_branch
    FROM groundbnb.environment_identity WHERE singleton;
  role_name := CASE
    WHEN environment_kind = 'production' AND environment_branch = 'br-small-meadow-b8lh69jr'
      THEN 'groundbnb_production_probe'
    WHEN environment_kind = 'preview' AND environment_branch = 'br-bitter-hall-b8ibnrfy'
      THEN 'groundbnb_preview_probe'
    WHEN environment_kind = 'local' AND environment_branch = 'br-rough-flower-b8lerkcf'
      THEN 'groundbnb_local_probe'
    WHEN environment_kind = 'recovery' AND environment_branch = 'br-round-field-b8d4v5o4'
      THEN 'groundbnb_recovery_reader'
    ELSE NULL
  END;
  IF role_name IS NULL THEN
    RAISE EXCEPTION 'Unapproved branch identity';
  END IF;
  -- Refuse collisions; never alter an existing principal silently.
  EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 4', role_name);
  EXECUTE format('GRANT CONNECT ON DATABASE groundbnb TO %I', role_name);
  EXECUTE format('GRANT USAGE ON SCHEMA groundbnb TO %I', role_name);
  EXECUTE format('GRANT SELECT ON groundbnb.environment_identity, groundbnb.schema_migrations TO %I', role_name);
  IF environment_kind = 'recovery' THEN
    EXECUTE format('GRANT USAGE ON SCHEMA recovery_control TO %I', role_name);
    EXECUTE format('GRANT SELECT ON recovery_control.events TO %I', role_name);
  END IF;
  EXECUTE format('ALTER ROLE %I SET default_transaction_read_only = on', role_name);
  EXECUTE format('ALTER ROLE %I SET statement_timeout = %L', role_name, '5s');
END $$;
COMMIT;

-- No roles can sign in until the client supplies a distinct password and LOGIN.
-- No auth, profile, trip, synthetic identity, write, schema-create, membership,
-- or default future-table privileges are granted. App write roles belong to M1.
