-- Operator-only factor storage invariants. Require migration receipts 0001-0009; synthetic rows and probes roll back.
BEGIN;
DO $$
DECLARE e record; app_role text; app_oid oid;
  account_a constant uuid:='f1000000-0000-4000-8000-000000000001';
  account_b constant uuid:='f1000000-0000-4000-8000-000000000002';
  factor_a constant uuid:='f2000000-0000-4000-8000-000000000001';
  issuer_a constant text:='urn:groundbnb:operator-test:issuer-a';
  subject_a constant text:='synthetic-factor-operator-subject-a';
  now_at timestamptz:=clock_timestamp();
  failed boolean; repeated boolean; error_constraint text; expected_constraint text;
  fingerprint bytea:=decode(repeat('42',32),'hex');
  envelope constant jsonb:='{"version":1,"keyId":"synthetic-operator-only","nonce":"AAAAAAAAAAAAAAAA","ciphertext":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","tag":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb;
BEGIN
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  IF current_database()<>'groundbnb' OR session_user<>'neondb_owner' OR app_role IS NULL OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0003_profile_domain') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0004_profile_operation_status') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0005_profile_records') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0006_profile_transfer') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0007_membership_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0008_provider_reservations') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0009_privileged_factors') THEN
    RAISE EXCEPTION 'Requires pinned local/preview operator and migrations 0001-0009';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user")<>1 OR NOT EXISTS(
      SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic Auth fixture';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.accounts WHERE id IN (account_a,account_b)) OR
     EXISTS(SELECT 1 FROM groundbnb.account_identities WHERE issuer=issuer_a OR subject=subject_a) THEN
    RAISE EXCEPTION 'Fixed synthetic operator marker already exists';
  END IF;

  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='groundbnb' AND c.relname IN ('account_security_epochs','security_epoch_events',
        'privileged_factor_enrollments','privileged_recovery_records','accepted_factor_steps',
        'privileged_factor_attestations','factor_attempt_windows','privileged_factor_audit')
        AND has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname IN ('_guard_security_epoch','_guard_factor_enrollment_history',
         '_guard_recovery_consumption','_guard_accepted_factor_step','_guard_factor_attestation',
         '_guard_factor_attempt_window','_privileged_factor_audit_append_only',
         '_require_factor_epoch_event','_serialize_factor_attempt_window')
         AND has_function_privilege(app_oid,p.oid,'EXECUTE')) THEN
    RAISE EXCEPTION 'Factor tables or trigger helpers are exposed to the app role';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='groundbnb' AND c.relname IN ('account_security_epochs','security_epoch_events',
        'privileged_factor_enrollments','privileged_recovery_records','accepted_factor_steps',
        'privileged_factor_attestations','factor_attempt_windows','privileged_factor_audit')
        AND (NOT c.relrowsecurity OR c.relforcerowsecurity)) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE n.nspname='groundbnb' AND p.proname IN ('_guard_security_epoch','_guard_factor_enrollment_history',
         '_guard_recovery_consumption','_guard_accepted_factor_step','_guard_factor_attestation',
         '_guard_factor_attempt_window','_privileged_factor_audit_append_only',
         '_require_factor_epoch_event','_serialize_factor_attempt_window')
         AND acl.grantee=0 AND acl.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'Factor RLS or PUBLIC helper boundary differs from migration';
  END IF;

  INSERT INTO groundbnb.accounts(id,display_name) VALUES
    (account_a,'Synthetic factor operator A'),(account_b,'Synthetic factor operator B');
  INSERT INTO groundbnb.account_identities(issuer,subject,account_id,verified_email,provider) VALUES
    (issuer_a,subject_a,account_a,'factor-operator-a@example.test','synthetic-operator'),
    (issuer_a,'synthetic-factor-operator-subject-b',account_b,'factor-operator-b@example.test','synthetic-operator');
  INSERT INTO groundbnb.account_security_epochs(account_id,security_epoch) VALUES(account_a,0),(account_b,0);

  -- A pending factor at a non-current epoch must fail its deferred owner/epoch check.
  failed:=false;
  BEGIN
    INSERT INTO groundbnb.privileged_factor_enrollments(factor_id,account_id,security_epoch,state,
      envelope_key_id,encrypted_secret,created_at)
    VALUES('f2000000-0000-4000-8000-000000000002',account_a,1,'pending',
      'synthetic-operator-only',envelope,now_at);
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN raise_exception THEN
    failed:=SQLERRM='Active factor enrollment must use the current account epoch';
  END;
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT failed THEN RAISE EXCEPTION 'Non-current factor enrollment epoch was accepted'; END IF;

  -- 0009 has no INSERT trigger for the pending-only transition guard; direct verified-insert
  -- rejection remains unproven here and must be added to the next factor migration gate.
  INSERT INTO groundbnb.privileged_factor_enrollments(factor_id,account_id,security_epoch,state,
    envelope_key_id,encrypted_secret,created_at)
  VALUES(factor_a,account_a,0,'pending','synthetic-operator-only',envelope,now_at);
  UPDATE groundbnb.privileged_factor_enrollments SET state='verified',verified_at=clock_timestamp()
    WHERE factor_id=factor_a AND account_id=account_a;
  INSERT INTO groundbnb.accepted_factor_steps(account_id,factor_id,security_epoch,accepted_step,accepted_at)
  VALUES(account_a,factor_a,0,17000000,clock_timestamp());
  INSERT INTO groundbnb.privileged_factor_attestations(attestation_id,account_id,factor_id,security_epoch,
    accepted_step,identity_issuer,identity_subject,managed_session_id,factor_verified_at,issued_at,expires_at)
  VALUES('f3000000-0000-4000-8000-000000000001',account_a,factor_a,0,17000000,
    issuer_a,subject_a,'synthetic-managed-session-a',now_at,clock_timestamp(),clock_timestamp()+interval '12 hours');

  -- A new accepted step can re-challenge in the same managed session and epoch.
  INSERT INTO groundbnb.accepted_factor_steps(account_id,factor_id,security_epoch,accepted_step,accepted_at)
  VALUES(account_a,factor_a,0,17000001,clock_timestamp());
  INSERT INTO groundbnb.privileged_factor_attestations(attestation_id,account_id,factor_id,security_epoch,
    accepted_step,identity_issuer,identity_subject,managed_session_id,factor_verified_at,issued_at,expires_at)
  VALUES('f3000000-0000-4000-8000-000000000002',account_a,factor_a,0,17000001,
    issuer_a,subject_a,'synthetic-managed-session-a',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '12 hours');
  IF (SELECT count(*) FROM groundbnb.privileged_factor_attestations
      WHERE account_id=account_a AND managed_session_id='synthetic-managed-session-a')<>2 THEN
    RAISE EXCEPTION 'Same-session rechallenge did not retain two distinct attestations';
  END IF;
  SELECT c.conname INTO STRICT expected_constraint FROM pg_constraint c
    WHERE c.conrelid='groundbnb.privileged_factor_attestations'::regclass AND c.contype='u' AND
      ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(attnum,ord)
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum ORDER BY k.ord)=
      ARRAY['account_id','factor_id','security_epoch','accepted_step']::text[];
  failed:=false;
  BEGIN
    INSERT INTO groundbnb.privileged_factor_attestations(attestation_id,account_id,factor_id,security_epoch,
      accepted_step,identity_issuer,identity_subject,managed_session_id,factor_verified_at,issued_at,expires_at)
    VALUES('f3000000-0000-4000-8000-000000000003',account_a,factor_a,0,17000000,
      issuer_a,subject_a,'synthetic-managed-session-a',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '12 hours');
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS error_constraint=CONSTRAINT_NAME;
    failed:=error_constraint=expected_constraint;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'Accepted factor step replay created another attestation'; END IF;

  SELECT c.conname INTO STRICT expected_constraint FROM pg_constraint c
    WHERE c.conrelid='groundbnb.accepted_factor_steps'::regclass AND
      c.confrelid='groundbnb.privileged_factor_enrollments'::regclass AND c.contype='f' AND
      ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(attnum,ord)
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum ORDER BY k.ord)=
      ARRAY['factor_id','account_id','security_epoch']::text[];
  failed:=false;
  BEGIN
    INSERT INTO groundbnb.accepted_factor_steps(account_id,factor_id,security_epoch,accepted_step)
    VALUES(account_b,factor_a,0,17000002);
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS error_constraint=CONSTRAINT_NAME;
    failed:=error_constraint=expected_constraint;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'Cross-owner accepted factor step was accepted'; END IF;

  -- Recovery data is fixed synthetic hash material; no recovery code is used or printed.
  INSERT INTO groundbnb.privileged_recovery_records(recovery_id,account_id,factor_id,security_epoch,
    digest_version,salt,recovery_digest,created_at)
  VALUES('f4000000-0000-4000-8000-000000000001',account_a,factor_a,0,1,
    decode(repeat('31',16),'hex'),decode(repeat('52',32),'hex'),clock_timestamp());
  UPDATE groundbnb.privileged_recovery_records SET consumed_at=clock_timestamp()
    WHERE recovery_id='f4000000-0000-4000-8000-000000000001' AND consumed_at IS NULL;
  repeated:=false;
  BEGIN
    UPDATE groundbnb.privileged_recovery_records SET consumed_at=clock_timestamp()+interval '1 second'
      WHERE recovery_id='f4000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN raise_exception THEN
    repeated:=SQLERRM='Recovery records may be consumed once and cannot be rewritten';
  END;
  IF NOT repeated OR (SELECT count(*) FROM groundbnb.privileged_recovery_records
      WHERE recovery_id='f4000000-0000-4000-8000-000000000001' AND consumed_at IS NOT NULL)<>1 THEN
    RAISE EXCEPTION 'Recovery row was not one-use';
  END IF;

  INSERT INTO groundbnb.factor_attempt_windows(account_id,identity_issuer,identity_subject,bucket_fingerprint,
    window_started_at,window_ends_at,attempt_count,updated_at)
  VALUES(account_a,issuer_a,subject_a,fingerprint,now_at,now_at+interval '5 minutes',1,now_at);
  failed:=false;
  BEGIN
    INSERT INTO groundbnb.factor_attempt_windows(account_id,identity_issuer,identity_subject,bucket_fingerprint,
      window_started_at,window_ends_at,attempt_count,updated_at)
    VALUES(account_a,issuer_a,subject_a,fingerprint,now_at+interval '1 minute',now_at+interval '6 minutes',1,now_at);
  EXCEPTION WHEN raise_exception THEN
    failed:=SQLERRM='Factor attempt windows cannot overlap for the same owner bucket';
  END;
  IF NOT failed THEN RAISE EXCEPTION 'Overlapping factor rate window was accepted'; END IF;
  INSERT INTO groundbnb.factor_attempt_windows(account_id,identity_issuer,identity_subject,bucket_fingerprint,
    window_started_at,window_ends_at,attempt_count,updated_at)
  VALUES(account_b,issuer_a,'synthetic-factor-operator-subject-b',fingerprint,
    now_at,now_at+interval '5 minutes',1,now_at);

  -- Each deferred failure is forced in a savepoint; then constraints return to deferred mode.
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  failed:=false;
  BEGIN
    UPDATE groundbnb.account_security_epochs SET security_epoch=1,updated_at=clock_timestamp()
      WHERE account_id=account_a;
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN raise_exception THEN
    failed:=SQLERRM='Security epoch increment requires its append-only event';
  END;
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT failed THEN RAISE EXCEPTION 'Epoch increment without event was accepted'; END IF;

  failed:=false;
  BEGIN
    UPDATE groundbnb.privileged_factor_enrollments SET state='revoked',revoked_at=clock_timestamp()
      WHERE factor_id=factor_a AND account_id=account_a;
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN raise_exception THEN
    failed:=SQLERRM='Factor revocation requires a newer security epoch and matching event';
  END;
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT failed THEN RAISE EXCEPTION 'Factor revocation without newer epoch/event was accepted'; END IF;

  UPDATE groundbnb.account_security_epochs SET security_epoch=1,updated_by=account_a,updated_at=clock_timestamp()
    WHERE account_id=account_a;
  INSERT INTO groundbnb.security_epoch_events(account_id,previous_epoch,new_epoch,actor_account_id,reason,occurred_at)
  VALUES(account_a,0,1,account_a,'factor_revocation',clock_timestamp());
  UPDATE groundbnb.privileged_factor_enrollments SET state='revoked',revoked_at=clock_timestamp()
    WHERE factor_id=factor_a AND account_id=account_a;
  SET CONSTRAINTS ALL IMMEDIATE;
  IF (SELECT security_epoch FROM groundbnb.account_security_epochs WHERE account_id=account_a)<>1 OR
     NOT EXISTS(SELECT 1 FROM groundbnb.privileged_factor_enrollments
       WHERE factor_id=factor_a AND state='revoked' AND security_epoch=0) OR
     EXISTS(SELECT 1 FROM groundbnb.privileged_factor_attestations a JOIN groundbnb.account_security_epochs s USING(account_id)
       WHERE a.account_id=account_a AND a.security_epoch=s.security_epoch) THEN
    RAISE EXCEPTION 'Epoch reset did not invalidate old factor attestations';
  END IF;
  SET CONSTRAINTS ALL DEFERRED;
END $$;

SELECT 'privileged_factor_invariants_passed_rollback_pending' AS result;
ROLLBACK;
