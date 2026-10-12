-- Reversal is limited to an untouched synthetic foundation. Requires reviewed rollback authorization.
BEGIN;
DO $$
BEGIN
  IF current_database()<>'groundbnb' OR NOT EXISTS (
    SELECT 1 FROM groundbnb.environment_identity WHERE singleton AND
      ((kind='local' AND branch_id='br-rough-flower-b8lerkcf') OR
       (kind='preview' AND branch_id='br-bitter-hall-b8ibnrfy'))
  ) OR (SELECT count(*) FROM groundbnb.accounts)<>1 OR
    EXISTS (SELECT 1 FROM groundbnb.profile_operations) OR EXISTS (SELECT 1 FROM groundbnb.profile_answers) OR
    EXISTS (SELECT 1 FROM groundbnb.accounts WHERE role<>'member' OR status<>'active') OR
    EXISTS (SELECT 1 FROM groundbnb.account_identities WHERE verified_email NOT LIKE '%@example.test' OR revoked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Rollback requires untouched pinned synthetic foundation';
  END IF;
END $$;
DROP FUNCTION groundbnb.save_profile(text,text,uuid,bigint,jsonb),groundbnb.read_profile(text,text);
DROP FUNCTION groundbnb._profile_account(text,text),groundbnb._profile_snapshot(uuid),groundbnb._valid_profile_patch(jsonb);
DROP TABLE groundbnb.profile_operations,groundbnb.profile_answers,groundbnb.profiles,groundbnb.account_identities,groundbnb.accounts;
DELETE FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation';
COMMIT;
