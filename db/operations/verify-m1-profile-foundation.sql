-- Operator-only invariant checks. All fixture mutations and failure injection roll back.
BEGIN;
DO $$
DECLARE binding record; before_snapshot jsonb; ack jsonb; result jsonb; operation_uuid uuid:=gen_random_uuid();
  other_account uuid; saved_revision bigint; original_status text;
BEGIN
  IF current_database()<>'groundbnb' OR session_user<>'neondb_owner' OR NOT EXISTS (
    SELECT 1 FROM groundbnb.environment_identity WHERE singleton AND
      ((kind='local' AND branch_id='br-rough-flower-b8lerkcf') OR
       (kind='preview' AND branch_id='br-bitter-hall-b8ibnrfy'))
  ) THEN RAISE EXCEPTION 'Requires approved synthetic operator environment'; END IF;
  SELECT * INTO STRICT binding FROM groundbnb.account_identities;
  before_snapshot:=groundbnb.read_profile(binding.issuer,binding.subject)->'profile';
  saved_revision:=(before_snapshot->>'revision')::bigint;
  ack:=groundbnb.save_profile(binding.issuer,binding.subject,operation_uuid,saved_revision,
    '{"hasPets":{"value":false,"answered":true},"preferredRegions":{"value":[],"answered":true}}');
  IF ack->>'ok' IS DISTINCT FROM 'true' OR (ack->'profile'->>'revision')::bigint<>saved_revision+1 OR
    ack->'profile'->'answers'->'hasPets'->'value'<>'false'::jsonb OR
    ack->'profile'->'answers'->'preferredRegions'->'value'<>'[]'::jsonb OR
    NOT EXISTS (SELECT 1 FROM groundbnb.profile_operations WHERE operation_id=operation_uuid AND acknowledgment=ack) THEN
    RAISE EXCEPTION 'Atomic save/acknowledgment failed'; END IF;
  IF groundbnb.save_profile(binding.issuer,binding.subject,operation_uuid,saved_revision,
    '{"preferredRegions":{"answered":true,"value":[]},"hasPets":{"answered":true,"value":false}}')<>ack THEN
    RAISE EXCEPTION 'Identical operation replay failed'; END IF;
  result:=groundbnb.save_profile(binding.issuer,binding.subject,operation_uuid,saved_revision,
    '{"hasPets":{"value":true,"answered":true}}');
  IF result->>'category' IS DISTINCT FROM 'validation' THEN RAISE EXCEPTION 'Changed replay accepted'; END IF;
  result:=groundbnb.save_profile(binding.issuer,binding.subject,gen_random_uuid(),saved_revision,
    '{"hasPets":{"value":true,"answered":true}}');
  IF result->>'category' IS DISTINCT FROM 'conflict' OR result->'fieldComparison'->'hasPets'->'current'->'value'<>'false'::jsonb THEN
    RAISE EXCEPTION 'Stale conflict comparison failed'; END IF;
  result:=groundbnb.save_profile(binding.issuer,binding.subject,gen_random_uuid(),saved_revision+1,
    '{"accountId":{"value":"foreign","answered":true}}');
  IF result->>'category' IS DISTINCT FROM 'validation' THEN RAISE EXCEPTION 'Client authority accepted'; END IF;
  IF groundbnb.read_profile('foreign-issuer',binding.subject)->>'category' IS DISTINCT FROM 'auth' OR
     groundbnb.read_profile(binding.issuer,'synthetic-unmapped-subject')->>'category' IS DISTINCT FROM 'auth' THEN
    RAISE EXCEPTION 'Foreign issuer/subject accepted'; END IF;
  INSERT INTO groundbnb.accounts DEFAULT VALUES RETURNING id INTO other_account;
  INSERT INTO groundbnb.account_identities(issuer,subject,account_id,verified_email)
    VALUES(binding.issuer,'synthetic-transaction-only-other',other_account,'transaction-only@example.test');
  INSERT INTO groundbnb.profiles(account_id) VALUES(other_account);
  result:=groundbnb.read_profile(binding.issuer,'synthetic-transaction-only-other');
  IF result->'profile'->>'accountId'<>other_account::text OR result->'profile'->'answers'<>'{}'::jsonb THEN
    RAISE EXCEPTION 'Account identity isolation failed'; END IF;
  SELECT status INTO original_status FROM groundbnb.accounts WHERE id=binding.account_id;
  UPDATE groundbnb.accounts SET status='suspended' WHERE id=binding.account_id;
  IF groundbnb.read_profile(binding.issuer,binding.subject)->>'category' IS DISTINCT FROM 'auth' OR
     groundbnb.save_profile(binding.issuer,binding.subject,operation_uuid,saved_revision,
       '{"hasPets":{"value":false,"answered":true},"preferredRegions":{"value":[],"answered":true}}')->>'category' IS DISTINCT FROM 'auth' THEN
    RAISE EXCEPTION 'Suspension permits read/replay'; END IF;
  UPDATE groundbnb.accounts SET status=original_status WHERE id=binding.account_id;
  UPDATE groundbnb.account_identities SET revoked_at=clock_timestamp() WHERE account_id=binding.account_id;
  IF groundbnb.read_profile(binding.issuer,binding.subject)->>'category' IS DISTINCT FROM 'auth' THEN
    RAISE EXCEPTION 'Revoked binding accepted'; END IF;
  UPDATE groundbnb.account_identities SET revoked_at=NULL WHERE account_id=binding.account_id;
END $$;
CREATE FUNCTION pg_temp.reject_profile_ack() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'synthetic acknowledgment failure'; END $$;
CREATE TRIGGER synthetic_ack_failure BEFORE INSERT ON groundbnb.profile_operations
  FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_profile_ack();
DO $$
DECLARE binding record; before_snapshot jsonb; failed boolean:=false;
BEGIN
  SELECT * INTO STRICT binding FROM groundbnb.account_identities WHERE subject<>'synthetic-transaction-only-other';
  before_snapshot:=groundbnb.read_profile(binding.issuer,binding.subject)->'profile';
  BEGIN
    PERFORM groundbnb.save_profile(binding.issuer,binding.subject,gen_random_uuid(),
      (before_snapshot->>'revision')::bigint,'{"hasPets":{"value":true,"answered":true}}');
  EXCEPTION WHEN raise_exception THEN failed:=true; END;
  IF NOT failed OR groundbnb.read_profile(binding.issuer,binding.subject)->'profile'<>before_snapshot THEN
    RAISE EXCEPTION 'Failed acknowledgment did not roll back profile'; END IF;
END $$;
SELECT 'profile_invariants_passed_rollback_pending' AS result;
ROLLBACK;

-- Metadata-only catalog output; never expose subject/email/profile content.
SELECT e.kind,e.branch_id,r.rolname,r.rolcanlogin,
  (SELECT count(*) FROM groundbnb.accounts) AS accounts,
  (SELECT count(*) FROM groundbnb.profile_operations) AS retained_operations,
  has_function_privilege(r.oid,'groundbnb.read_profile(text,text)','EXECUTE') AS profile_read,
  has_function_privilege(r.oid,'groundbnb.save_profile(text,text,uuid,bigint,jsonb)','EXECUTE') AS profile_save,
  NOT has_table_privilege(r.oid,'groundbnb.accounts','SELECT,INSERT,UPDATE,DELETE') AS direct_accounts_denied,
  NOT has_table_privilege(r.oid,'groundbnb.profile_answers','SELECT,INSERT,UPDATE,DELETE') AS direct_answers_denied,
  NOT has_function_privilege(r.oid,'groundbnb._profile_snapshot(uuid)','EXECUTE') AS helper_denied
FROM groundbnb.environment_identity e JOIN pg_roles r ON r.rolname=CASE e.kind
  WHEN 'local' THEN 'groundbnb_local_app' WHEN 'preview' THEN 'groundbnb_preview_app' END WHERE e.singleton;
