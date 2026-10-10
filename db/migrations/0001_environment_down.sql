-- Destructive rollback for an empty/synthetic test branch only. Never run on production.
BEGIN;
DROP SCHEMA groundbnb CASCADE;
COMMIT;
