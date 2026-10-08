-- Prepared operator acceptance for profile migrations 0003-0006. Do not run until the separate operator gate is approved.
-- Every fixture mutation, operation record, temporary trigger, and audit side effect rolls back.
BEGIN;

DO $guard$
DECLARE environment_row record; binding_count integer;
BEGIN
  IF current_database()<>'groundbnb' OR session_user<>'neondb_owner' THEN
    RAISE EXCEPTION 'Requires groundbnb as neondb_owner';
  END IF;
  SELECT * INTO STRICT environment_row FROM groundbnb.environment_identity WHERE singleton;
  IF NOT ((environment_row.kind='local' AND environment_row.branch_id='br-rough-flower-b8lerkcf') OR
          (environment_row.kind='preview' AND environment_row.branch_id='br-bitter-hall-b8ibnrfy')) THEN
    RAISE EXCEPTION 'Requires an approved pinned synthetic branch';
  END IF;
  IF (SELECT count(*) FROM groundbnb.schema_migrations WHERE version=ANY(ARRAY[
      '0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
      '0005_profile_records','0006_profile_transfer','0007_membership_foundation',
      '0008_provider_reservations','0009_privileged_factors'])) IS DISTINCT FROM 9 OR
     (SELECT count(*) FROM groundbnb.schema_migrations) IS DISTINCT FROM 9 THEN
    RAISE EXCEPTION 'Requires prepared profile and security migration receipts 0001-0009';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user")<>1 OR NOT EXISTS(
      SELECT 1 FROM neon_auth."user" WHERE email=environment_row.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic auth fixture';
  END IF;
  SELECT count(*) INTO binding_count FROM groundbnb.account_identities WHERE revoked_at IS NULL;
  IF binding_count<>1 THEN RAISE EXCEPTION 'Requires exactly one active synthetic profile binding'; END IF;
END
$guard$;

DO $profile_domain$
DECLARE binding record; initial_profile jsonb; current_profile jsonb; result jsonb; status_result jsonb;
  base_revision bigint; latest_revision bigint; first_operation uuid:=gen_random_uuid(); second_operation uuid:=gen_random_uuid();
  first_ack jsonb; invalid_patch jsonb;
BEGIN
  SELECT * INTO STRICT binding FROM groundbnb.account_identities WHERE revoked_at IS NULL;
  result:=groundbnb.read_profile(binding.issuer,binding.subject);
  IF result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Synthetic profile read failed'; END IF;
  initial_profile:=result->'profile';
  base_revision:=(initial_profile->>'revision')::bigint;

  first_ack:=groundbnb.save_profile(binding.issuer,binding.subject,first_operation,base_revision,
    jsonb_build_object('travelerCount',jsonb_build_object('value',1,'answered',true),
      'hasPets',jsonb_build_object('value',false,'answered',true),
      'budgetCurrency',jsonb_build_object('value','USD','answered',true),
      'preferredRegions',jsonb_build_object('value',jsonb_build_array('Café','東京 🚐'),'answered',true)));
  IF first_ack->>'ok' IS DISTINCT FROM 'true' OR
     (first_ack->'profile'->>'revision')::bigint IS DISTINCT FROM base_revision+1 OR
     first_ack->'profile'->'answers'->'travelerCount'->'value' IS DISTINCT FROM '1'::jsonb OR
     first_ack->'profile'->'answers'->'hasPets'->'value' IS DISTINCT FROM 'false'::jsonb OR
     first_ack->'profile'->'answers'->'budgetCurrency'->'value' IS DISTINCT FROM '"USD"'::jsonb OR
     first_ack->'profile'->'answers'->'preferredRegions'->'value' IS DISTINCT FROM '["Café","東京 🚐"]'::jsonb OR
     NOT EXISTS(SELECT 1 FROM groundbnb.profile_operations WHERE operation_id=first_operation AND acknowledgment=first_ack) THEN
    RAISE EXCEPTION 'Typed, currency, UTF-8, revision, or durable acknowledgment check failed';
  END IF;

  result:=groundbnb.save_profile(binding.issuer,binding.subject,first_operation,base_revision,
    jsonb_build_object('travelerCount',jsonb_build_object('value',1,'answered',true),
      'hasPets',jsonb_build_object('value',false,'answered',true),
      'budgetCurrency',jsonb_build_object('value','USD','answered',true),
      'preferredRegions',jsonb_build_object('value',jsonb_build_array('Café','東京 🚐'),'answered',true)));
  status_result:=groundbnb.read_profile_operation(binding.issuer,binding.subject,first_operation);
  IF result IS DISTINCT FROM first_ack OR status_result->>'status' IS DISTINCT FROM 'saved' OR
     status_result->'profile' IS DISTINCT FROM first_ack->'profile' OR
     status_result->'savedAt' IS DISTINCT FROM first_ack->'savedAt' THEN
    RAISE EXCEPTION 'Original profile operation replay/status was not immutable';
  END IF;
  result:=groundbnb.save_profile(binding.issuer,binding.subject,first_operation,base_revision,
    '{"travelerCount":{"value":2,"answered":true}}'::jsonb);
  IF result->>'category' IS DISTINCT FROM 'validation' THEN RAISE EXCEPTION 'Changed profile operation reuse was accepted'; END IF;

  result:=groundbnb.save_profile(binding.issuer,binding.subject,second_operation,base_revision+1,
    '{"travelerCount":{"value":999,"answered":true},"hasPets":{"value":true,"answered":true}}'::jsonb);
  IF result->>'ok' IS DISTINCT FROM 'true' OR result->'profile'->'answers'->'travelerCount'->'value' IS DISTINCT FROM '999'::jsonb THEN
    RAISE EXCEPTION 'Traveler-count upper boundary 999 failed';
  END IF;
  current_profile:=result->'profile';
  latest_revision:=(current_profile->>'revision')::bigint;

  FOREACH invalid_patch IN ARRAY ARRAY[
    '{"travelerCount":{"value":0,"answered":true}}'::jsonb,
    '{"travelerCount":{"value":1000,"answered":true}}'::jsonb,
    '{"budgetCurrency":{"value":"ZZZ","answered":true}}'::jsonb
  ] LOOP
    result:=groundbnb.save_profile(binding.issuer,binding.subject,gen_random_uuid(),latest_revision,invalid_patch);
    IF result->>'category' IS DISTINCT FROM 'validation' OR
       groundbnb.read_profile(binding.issuer,binding.subject)->'profile'->>'revision' IS DISTINCT FROM latest_revision::text THEN
      RAISE EXCEPTION 'Invalid profile boundary mutated canonical state';
    END IF;
  END LOOP;

  status_result:=groundbnb.read_profile_operation(binding.issuer,binding.subject,first_operation);
  current_profile:=groundbnb.read_profile(binding.issuer,binding.subject)->'profile';
  IF status_result->'profile'->>'revision' IS DISTINCT FROM (base_revision+1)::text OR
     (current_profile->>'revision')::bigint IS NULL OR
     (status_result->'profile'->>'revision')::bigint IS NULL OR
     (current_profile->>'revision')::bigint<= (status_result->'profile'->>'revision')::bigint THEN
    RAISE EXCEPTION 'Status did not preserve original acknowledgment after a newer profile revision';
  END IF;
  result:=groundbnb.save_profile(binding.issuer,binding.subject,gen_random_uuid(),base_revision,
    '{"hasPets":{"value":false,"answered":true}}'::jsonb);
  IF result->>'category' IS DISTINCT FROM 'conflict' OR
     (result->>'currentRevision')::bigint IS DISTINCT FROM latest_revision OR
     result->'fieldComparison'->'hasPets'->'current'->'value' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Stale profile conflict comparison failed';
  END IF;
END
$profile_domain$;

DO $records$
DECLARE binding record; result jsonb; status_result jsonb; base_profile jsonb; latest_profile jsonb;
  base_revision bigint; vehicle_id uuid:=gen_random_uuid(); note_id uuid:=gen_random_uuid(); v_operation_id uuid:=gen_random_uuid();
  vehicle_rows jsonb; note_rows jsonb; changed_notes jsonb; tombstone_rows jsonb; unremove_rows jsonb; ack jsonb;
BEGIN
  SELECT * INTO STRICT binding FROM groundbnb.account_identities WHERE revoked_at IS NULL;
  base_profile:=groundbnb.read_profile(binding.issuer,binding.subject)->'profile';
  base_revision:=(base_profile->>'revision')::bigint;
  vehicle_rows:=jsonb_build_array(jsonb_build_object(
    'id',vehicle_id,'name','Synthetic touring vehicle','type','Vessel','ownership','owned','propulsion',NULL,
    'fuelEconomy',jsonb_build_object('value',2.5,'unit','gallons/hour','origin','user'),
    'dimensions',jsonb_build_object('lengthMeters',6.4,'widthMeters',2.1,'heightMeters',NULL),
    'location',NULL,'locationVerifiedAt',NULL));
  note_rows:=jsonb_build_array(jsonb_build_object(
    'id',note_id,'text','Synthetic note: café, 東京 🌊','origin','user','selectedQuoteIds','[]'::jsonb,'userRemoved',false));

  ack:=groundbnb.save_profile_records(binding.issuer,binding.subject,v_operation_id,base_revision,vehicle_rows,note_rows);
  IF ack->>'ok' IS DISTINCT FROM 'true' OR ack->>'operationKind' IS DISTINCT FROM 'profile_records' OR
     (ack->'profile'->>'revision')::bigint IS DISTINCT FROM base_revision+1 OR
     NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ack->'profile'->'vehicles') AS vehicles(value)
       WHERE value->>'id'=vehicle_id::text AND value->'fuelEconomy'->>'unit'='gallons/hour') OR
     NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ack->'profile'->'notes') AS notes(value)
       WHERE value->>'id'=note_id::text AND value->>'text'='Synthetic note: café, 東京 🌊' AND value->>'origin'='user') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.profile_operations po WHERE po.operation_id=v_operation_id AND po.acknowledgment=ack) THEN
    RAISE EXCEPTION 'Atomic vehicle/note record save failed';
  END IF;
  status_result:=groundbnb.read_profile_operation(binding.issuer,binding.subject,v_operation_id);
  IF status_result->>'status' IS DISTINCT FROM 'saved' OR status_result->'profile' IS DISTINCT FROM ack->'profile' THEN
    RAISE EXCEPTION 'Original records status acknowledgment failed';
  END IF;
  changed_notes:=jsonb_set(note_rows,'{0,text}','"Changed retry body"'::jsonb);
  result:=groundbnb.save_profile_records(binding.issuer,binding.subject,v_operation_id,base_revision,vehicle_rows,changed_notes);
  IF result->>'category' IS DISTINCT FROM 'validation' THEN RAISE EXCEPTION 'Changed records operation reuse was accepted'; END IF;
  result:=groundbnb.save_profile_records(binding.issuer,binding.subject,gen_random_uuid(),base_revision,vehicle_rows,note_rows);
  IF result->>'category' IS DISTINCT FROM 'conflict' OR (result->>'currentRevision')::bigint IS DISTINCT FROM base_revision+1 THEN
    RAISE EXCEPTION 'Stale records operation did not report current revision';
  END IF;

  tombstone_rows:=jsonb_build_array(jsonb_build_object(
    'id',note_id,'text','Removed note text','origin','user','selectedQuoteIds','[]'::jsonb,'userRemoved',true));
  result:=groundbnb.save_profile_records(binding.issuer,binding.subject,gen_random_uuid(),base_revision+1,'[]'::jsonb,tombstone_rows);
  IF result->>'ok' IS DISTINCT FROM 'true' OR NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(result->'profile'->'notes') AS notes(value)
      WHERE value->>'id'=note_id::text AND value->'userRemoved'='true'::jsonb AND value->>'text'='Removed note text') THEN
    RAISE EXCEPTION 'Profile note tombstone was not retained';
  END IF;
  unremove_rows:=jsonb_set(tombstone_rows,'{0,userRemoved}','false'::jsonb);
  latest_profile:=result->'profile';
  result:=groundbnb.save_profile_records(binding.issuer,binding.subject,gen_random_uuid(),(latest_profile->>'revision')::bigint,'[]'::jsonb,unremove_rows);
  IF result->>'category' IS DISTINCT FROM 'validation' OR
     NOT (groundbnb.read_profile(binding.issuer,binding.subject)->'profile'->'notes' @>
       jsonb_build_array(jsonb_build_object('id',note_id,'userRemoved',true))) THEN
    RAISE EXCEPTION 'Removed note was recreated or changed';
  END IF;
  status_result:=groundbnb.read_profile_operation(binding.issuer,binding.subject,v_operation_id);
  latest_profile:=groundbnb.read_profile(binding.issuer,binding.subject)->'profile';
  IF status_result->>'status' IS DISTINCT FROM 'saved' OR
     status_result->'profile'->>'revision' IS DISTINCT FROM (base_revision+1)::text OR
     (latest_profile->>'revision')::bigint IS NULL OR
     (latest_profile->>'revision')::bigint<=base_revision+1 THEN
    RAISE EXCEPTION 'Original records acknowledgment changed after a newer profile revision';
  END IF;
END
$records$;

DO $transfer$
DECLARE binding record; result jsonb; status_result jsonb; base_profile jsonb; current_profile jsonb;
  base_revision bigint; transfer_revision bigint; latest_revision bigint; v_operation_id uuid:=gen_random_uuid();
  note_id uuid:=gen_random_uuid(); note_rows jsonb; patch jsonb; ack jsonb;
BEGIN
  SELECT * INTO STRICT binding FROM groundbnb.account_identities WHERE revoked_at IS NULL;
  base_profile:=groundbnb.read_profile(binding.issuer,binding.subject)->'profile';
  base_revision:=(base_profile->>'revision')::bigint;
  patch:='{"budgetAmount":{"value":"0","answered":true}}'::jsonb;
  note_rows:=jsonb_build_array(jsonb_build_object('id',note_id,'text','Transferred synthetic note','origin','user',
    'selectedQuoteIds','[]'::jsonb,'userRemoved',false));
  ack:=groundbnb.save_profile_transfer(binding.issuer,binding.subject,v_operation_id,base_revision,patch,note_rows);
  IF ack->>'ok' IS DISTINCT FROM 'true' OR ack->>'operationKind' IS DISTINCT FROM 'profile_transfer' OR
     (ack->'profile'->>'revision')::bigint IS DISTINCT FROM base_revision+1 OR
     ack->'profile'->'answers'->'budgetAmount'->'value' IS DISTINCT FROM '"0"'::jsonb OR
     NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ack->'profile'->'notes') AS notes(value)
       WHERE value->>'id'=note_id::text AND value->>'text'='Transferred synthetic note' AND value->>'origin'='user') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.profile_operations po WHERE po.operation_id=v_operation_id AND po.acknowledgment=ack) THEN
    RAISE EXCEPTION 'Atomic profile transfer fields/note save failed';
  END IF;
  transfer_revision:=(ack->'profile'->>'revision')::bigint;
  status_result:=groundbnb.read_profile_operation(binding.issuer,binding.subject,v_operation_id);
  IF status_result->>'status' IS DISTINCT FROM 'saved' OR status_result->'profile' IS DISTINCT FROM ack->'profile' THEN
    RAISE EXCEPTION 'Original transfer status acknowledgment failed';
  END IF;
  result:=groundbnb.save_profile_transfer(binding.issuer,binding.subject,v_operation_id,base_revision,
    '{"budgetAmount":{"value":"1","answered":true}}'::jsonb,note_rows);
  IF result->>'category' IS DISTINCT FROM 'validation' THEN RAISE EXCEPTION 'Changed transfer operation reuse was accepted'; END IF;
  result:=groundbnb.save_profile_transfer(binding.issuer,binding.subject,gen_random_uuid(),base_revision,
    '{"homePoint":{"value":{"latitude":1,"longitude":2},"answered":true}}'::jsonb,'[]'::jsonb);
  IF result->>'category' IS DISTINCT FROM 'validation' THEN RAISE EXCEPTION 'Transfer accepted unverified home coordinates'; END IF;

  result:=groundbnb.save_profile(binding.issuer,binding.subject,gen_random_uuid(),transfer_revision,
    '{"hasPets":{"value":false,"answered":true}}'::jsonb);
  IF result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Could not create newer current profile snapshot'; END IF;
  latest_revision:=(result->'profile'->>'revision')::bigint;
  status_result:=groundbnb.read_profile_operation(binding.issuer,binding.subject,v_operation_id);
  current_profile:=groundbnb.read_profile(binding.issuer,binding.subject)->'profile';
  IF status_result->'profile'->>'revision' IS DISTINCT FROM transfer_revision::text OR
     (current_profile->>'revision')::bigint IS NULL OR
     (current_profile->>'revision')::bigint<=transfer_revision OR
     latest_revision IS DISTINCT FROM (current_profile->>'revision')::bigint THEN
    RAISE EXCEPTION 'Transfer status replaced or misreported a newer current profile';
  END IF;
  result:=groundbnb.save_profile_transfer(binding.issuer,binding.subject,gen_random_uuid(),base_revision,
    '{"budgetAmount":{"value":"2","answered":true}}'::jsonb,
    jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'text','Conflict proposal','origin','user',
      'selectedQuoteIds','[]'::jsonb,'userRemoved',false)));
  IF result->>'category' IS DISTINCT FROM 'conflict' OR (result->>'currentRevision')::bigint<>latest_revision OR
     result->'fieldComparison'->'profileFields'->'budgetAmount'->'current'->'value' IS DISTINCT FROM '"0"'::jsonb THEN
    RAISE EXCEPTION 'Stale transfer did not return current field comparison';
  END IF;
END
$transfer$;

DO $foreign_owner$
DECLARE binding record; result jsonb; vehicle_rows jsonb:='[]'::jsonb; note_rows jsonb:='[]'::jsonb;
  other_account uuid; foreign_subject text:='synthetic-expanded-transaction-only-other'; foreign_operation uuid;
BEGIN
  SELECT * INTO STRICT binding FROM groundbnb.account_identities WHERE revoked_at IS NULL;
  result:=groundbnb.read_profile('foreign-issuer',binding.subject);
  IF result->>'category' IS DISTINCT FROM 'auth' THEN RAISE EXCEPTION 'Foreign profile issuer was accepted'; END IF;
  result:=groundbnb.read_profile_operation('foreign-issuer',binding.subject,gen_random_uuid());
  IF result->>'category' IS DISTINCT FROM 'auth' THEN RAISE EXCEPTION 'Foreign operation-status issuer was accepted'; END IF;
  result:=groundbnb.save_profile('foreign-issuer',binding.subject,gen_random_uuid(),0,'{"hasPets":{"value":false,"answered":true}}'::jsonb);
  IF result->>'category' IS DISTINCT FROM 'auth' THEN RAISE EXCEPTION 'Foreign profile write issuer was accepted'; END IF;
  result:=groundbnb.save_profile_records('foreign-issuer',binding.subject,gen_random_uuid(),0,vehicle_rows,note_rows);
  IF result->>'category' IS DISTINCT FROM 'auth' THEN RAISE EXCEPTION 'Foreign records issuer was accepted'; END IF;
  result:=groundbnb.save_profile_transfer('foreign-issuer',binding.subject,gen_random_uuid(),0,'{}'::jsonb,'[]'::jsonb);
  IF result->>'category' IS DISTINCT FROM 'auth' THEN RAISE EXCEPTION 'Foreign transfer issuer was accepted'; END IF;
  result:=groundbnb.read_profile(binding.issuer,'synthetic-unmapped-subject');
  IF result->>'category' IS DISTINCT FROM 'auth' THEN RAISE EXCEPTION 'Unmapped profile subject was accepted'; END IF;

  INSERT INTO groundbnb.accounts DEFAULT VALUES RETURNING id INTO other_account;
  INSERT INTO groundbnb.account_identities(issuer,subject,account_id,verified_email)
    VALUES(binding.issuer,foreign_subject,other_account,'transaction-only@example.test');
  INSERT INTO groundbnb.profiles(account_id) VALUES(other_account);
  result:=groundbnb.read_profile(binding.issuer,foreign_subject);
  IF result->'profile'->>'accountId' IS DISTINCT FROM other_account::text OR
     result->'profile'->>'accountId' IS NOT DISTINCT FROM binding.account_id::text OR
     result->'profile'->'answers' IS DISTINCT FROM '{}'::jsonb THEN
    RAISE EXCEPTION 'Distinct synthetic account identity did not remain isolated';
  END IF;
  SELECT po.operation_id INTO STRICT foreign_operation FROM groundbnb.profile_operations po
    WHERE po.account_id=binding.account_id AND po.request->>'operationKind'='profile_transfer'
    ORDER BY po.saved_at DESC LIMIT 1;
  result:=groundbnb.read_profile_operation(binding.issuer,foreign_subject,foreign_operation);
  IF result->>'status' IS DISTINCT FROM 'not_found' OR result ? 'profile' THEN
    RAISE EXCEPTION 'Foreign account status query exposed another account operation';
  END IF;
END
$foreign_owner$;

CREATE FUNCTION pg_temp.reject_expanded_profile_ack() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'synthetic expanded-profile acknowledgment failure';
END $$;
CREATE TRIGGER synthetic_expanded_profile_ack_failure BEFORE INSERT ON groundbnb.profile_operations
  FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_expanded_profile_ack();

DO $failure_rollback$
DECLARE binding record; before_profile jsonb; after_profile jsonb; expected_revision bigint;
  v_operation_id uuid:=gen_random_uuid(); v_note_id uuid:=gen_random_uuid(); failed boolean:=false;
BEGIN
  SELECT * INTO STRICT binding FROM groundbnb.account_identities WHERE revoked_at IS NULL;
  before_profile:=groundbnb.read_profile(binding.issuer,binding.subject)->'profile';
  expected_revision:=(before_profile->>'revision')::bigint;
  BEGIN
    PERFORM groundbnb.save_profile_transfer(binding.issuer,binding.subject,v_operation_id,expected_revision,
      '{"budgetAmount":{"value":"456.78","answered":true}}'::jsonb,
      jsonb_build_array(jsonb_build_object('id',v_note_id,'text','Must roll back','origin','user',
        'selectedQuoteIds','[]'::jsonb,'userRemoved',false)));
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM IS DISTINCT FROM 'synthetic expanded-profile acknowledgment failure' THEN RAISE; END IF;
    failed:=true;
  END;
  after_profile:=groundbnb.read_profile(binding.issuer,binding.subject)->'profile';
  IF NOT failed OR after_profile IS DISTINCT FROM before_profile OR
     EXISTS(SELECT 1 FROM groundbnb.profile_operations po WHERE po.operation_id=v_operation_id) OR
     EXISTS(SELECT 1 FROM groundbnb.profile_notes pn WHERE pn.note_id=v_note_id) THEN
    RAISE EXCEPTION 'Failed acknowledgment did not roll back profile and transfer note';
  END IF;
END
$failure_rollback$;

SELECT 'M1_PROFILE_EXPANDED_OPERATOR_PASS' AS marker;
ROLLBACK;
