-- Enable managed Neon Auth on an already identified synthetic preview/local branch.
-- Neon service initializes its own neon_auth schema; never grant this to an app role.
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'groundbnb' OR
     NOT EXISTS (SELECT 1 FROM groundbnb.environment_identity WHERE singleton AND kind IN ('preview', 'local')) THEN
    RAISE EXCEPTION 'Neon Auth repair requires an identified nonproduction groundbnb database';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'neon_service' AND NOT rolcanlogin) THEN
    RAISE EXCEPTION 'Expected internal Neon service role is absent or has login enabled';
  END IF;
END $$;
GRANT CREATE ON DATABASE groundbnb TO neon_service;
COMMIT;
