-- M0 baseline. Apply to an empty production database or empty/synthetic branch only.
-- Never create a preview from a data-bearing production branch.
BEGIN;
CREATE SCHEMA IF NOT EXISTS groundbnb;
CREATE TABLE groundbnb.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE groundbnb.environment_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  kind text NOT NULL CHECK (kind IN ('production', 'preview', 'local', 'recovery')),
  branch_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE groundbnb.synthetic_identities (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (email LIKE '%@example.test'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION groundbnb.refuse_production_synthetic_seed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT kind FROM groundbnb.environment_identity WHERE singleton) NOT IN ('preview', 'local') THEN
    RAISE EXCEPTION 'Synthetic seed requires a preview or local environment identity';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER synthetic_seed_guard BEFORE INSERT OR UPDATE ON groundbnb.synthetic_identities
  FOR EACH ROW EXECUTE FUNCTION groundbnb.refuse_production_synthetic_seed();
INSERT INTO groundbnb.schema_migrations(version) VALUES ('0001_environment');
COMMIT;
