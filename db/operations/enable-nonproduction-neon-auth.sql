-- Enable managed Neon Auth on an already identified synthetic preview/local branch.
-- Neon service initializes its own neon_auth schema; never grant this to an app role.
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'groundbnb' OR
     NOT EXISTS (
       SELECT 1 FROM groundbnb.environment_identity
       WHERE singleton AND (
         (kind = 'preview' AND branch_id = 'br-bitter-hall-b8ibnrfy') OR
         (kind = 'local' AND branch_id = 'br-rough-flower-b8lerkcf')
       )
     ) THEN
    RAISE EXCEPTION 'Neon Auth repair requires an identified nonproduction groundbnb database';
  END IF;
  -- Live preflight confirms this provider-managed service role has LOGIN.
  -- Do not change role attributes or grant to any application role.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'neon_service' AND NOT rolsuper) THEN
    RAISE EXCEPTION 'Expected non-superuser Neon service role is absent';
  END IF;
END $$;
GRANT CREATE ON DATABASE groundbnb TO neon_service;
COMMIT;
