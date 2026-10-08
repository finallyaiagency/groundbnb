-- Operator-only 0010 recovery/activity acceptance. Synthetic rows and probes roll back.
BEGIN;
DO $$
DECLARE e record; app_role text; app_oid oid; account_test constant uuid:='f5100000-0000-4000-8000-000000000001';
  factor_test constant uuid:='f5200000-0000-4000-8000-000000000001';
  recovery_test constant uuid:='f5300000-0000-4000-8000-000000000001';
  recovery_test_2 constant uuid:='f5300000-0000-4000-8000-000000000002';
  issuer_test constant text:='urn:groundbnb:operator-test:factor-context';
  subject_test constant text:='synthetic-factor-context-subject';
  envelope constant jsonb:='{"version":1,"keyId":"synthetic-operator-only","nonce":"AAAAAAAAAAAAAAAA","ciphertext":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","tag":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb;
  failed boolean; observed_error text; now_at timestamptz:=clock_timestamp(); source_at timestamptz;
BEGIN
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  IF current_database()<>'groundbnb' OR session_user<>'neondb_owner' OR app_role IS NULL OR
     (SELECT count(*) FROM groundbnb.schema_migrations WHERE version IN (
       '0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
       '0005_profile_records','0006_profile_transfer','0007_membership_foundation',
       '0008_provider_reservations','0009_privileged_factors','0010_factor_recovery_activity'))<>10 OR
     (SELECT count(*) FROM groundbnb.schema_migrations)<>10 THEN
    RAISE EXCEPTION 'Requires exact pinned local/preview 0001-0010 baseline';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user")<>1 OR NOT EXISTS(
      SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires sole verified synthetic Auth fixture';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.accounts WHERE id=account_test) OR
     EXISTS(SELECT 1 FROM groundbnb.account_identities WHERE issuer=issuer_test OR subject=subject_test) THEN
    RAISE EXCEPTION 'Fixed synthetic factor-context marker already exists';
  END IF;
  IF has_table_privilege(app_role,'groundbnb.privileged_session_activity','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_table_privilege(app_role,'groundbnb.privileged_factor_attestations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='groundbnb' AND c.relname='privileged_session_activity'
         AND c.relrowsecurity AND NOT c.relforcerowsecurity)<>1 OR
     (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname IN ('_guard_factor_attestation_method',
         '_validate_factor_attestation_source','_guard_privileged_session_activity'))<>3 OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE n.nspname='groundbnb' AND p.proname IN ('_guard_factor_attestation_method',
         '_validate_factor_attestation_source','_guard_privileged_session_activity')
         AND acl.grantee=0 AND acl.privilege_type='EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname IN ('_guard_factor_attestation_method',
         '_validate_factor_attestation_source','_guard_privileged_session_activity')
         AND has_function_privilege(app_oid,p.oid,'EXECUTE')) THEN
    RAISE EXCEPTION 'Privileged context storage is exposed to app role';
  END IF;

  INSERT INTO groundbnb.accounts(id,display_name) VALUES(account_test,'Synthetic factor context');
  INSERT INTO groundbnb.account_identities(issuer,subject,account_id,verified_email,provider)
    VALUES(issuer_test,subject_test,account_test,'factor-context@example.test','synthetic-operator');
  INSERT INTO groundbnb.account_security_epochs(account_id,security_epoch) VALUES(account_test,0);

  -- Direct insertion of an already verified factor must fail before any deferred work.
  failed:=false;
  BEGIN
    INSERT INTO groundbnb.privileged_factor_enrollments(factor_id,account_id,security_epoch,state,
      envelope_key_id,encrypted_secret,created_at,verified_at)
    VALUES(factor_test,account_test,0,'verified','synthetic-operator-only',envelope,now_at,now_at);
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS observed_error=MESSAGE_TEXT;
    failed:=observed_error='Factor enrollment must begin pending';
  END;
  IF NOT failed THEN RAISE EXCEPTION 'Direct verified factor enrollment insert was accepted'; END IF;

  INSERT INTO groundbnb.privileged_factor_enrollments(factor_id,account_id,security_epoch,state,
    envelope_key_id,encrypted_secret,created_at)
    VALUES(factor_test,account_test,0,'pending','synthetic-operator-only',envelope,now_at);
  UPDATE groundbnb.privileged_factor_enrollments SET state='verified',verified_at=clock_timestamp()
    WHERE factor_id=factor_test AND account_id=account_test;
  source_at:=clock_timestamp();
  INSERT INTO groundbnb.privileged_recovery_records(recovery_id,account_id,factor_id,security_epoch,
    digest_version,salt,recovery_digest,created_at)
    VALUES(recovery_test,account_test,factor_test,0,1,decode(repeat('31',16),'hex'),
      decode(repeat('52',32),'hex'),source_at);
  UPDATE groundbnb.privileged_recovery_records SET consumed_at=clock_timestamp()
    WHERE recovery_id=recovery_test AND consumed_at IS NULL RETURNING consumed_at INTO STRICT source_at;
  INSERT INTO groundbnb.privileged_factor_attestations(attestation_id,account_id,factor_id,security_epoch,
    accepted_step,challenge_method,recovery_id,identity_issuer,identity_subject,managed_session_id,
    factor_verified_at,issued_at,expires_at)
    VALUES('f5400000-0000-4000-8000-000000000001',account_test,factor_test,0,NULL,'recovery',recovery_test,
      issuer_test,subject_test,'synthetic-factor-context-session',source_at,clock_timestamp(),clock_timestamp()+interval '12 hours');
  SET CONSTRAINTS ALL IMMEDIATE;
  IF NOT EXISTS(SELECT 1 FROM groundbnb.privileged_factor_attestations
      WHERE attestation_id='f5400000-0000-4000-8000-000000000001' AND accepted_step IS NULL
        AND challenge_method='recovery' AND recovery_id=recovery_test) THEN
    RAISE EXCEPTION 'Consumed recovery did not create its bound challenge attestation';
  END IF;
  INSERT INTO groundbnb.privileged_session_activity(account_id,identity_issuer,identity_subject,
    managed_session_id,security_epoch,attestation_id,last_activity_at)
    VALUES(account_test,issuer_test,subject_test,'synthetic-factor-context-session',0,
      'f5400000-0000-4000-8000-000000000001',clock_timestamp());
  IF NOT EXISTS(SELECT 1 FROM groundbnb.privileged_session_activity
      WHERE account_id=account_test AND security_epoch=0 AND attestation_id='f5400000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Exact attestation activity context was not retained';
  END IF;
  source_at:=clock_timestamp();
  INSERT INTO groundbnb.privileged_recovery_records(recovery_id,account_id,factor_id,security_epoch,
    digest_version,salt,recovery_digest,created_at)
    VALUES(recovery_test_2,account_test,factor_test,0,1,decode(repeat('32',16),'hex'),
      decode(repeat('53',32),'hex'),source_at);
  UPDATE groundbnb.privileged_recovery_records SET consumed_at=clock_timestamp()
    WHERE recovery_id=recovery_test_2 AND consumed_at IS NULL RETURNING consumed_at INTO STRICT source_at;
  INSERT INTO groundbnb.privileged_factor_attestations(attestation_id,account_id,factor_id,security_epoch,
    accepted_step,challenge_method,recovery_id,identity_issuer,identity_subject,managed_session_id,
    factor_verified_at,issued_at,expires_at)
    VALUES('f5400000-0000-4000-8000-000000000002',account_test,factor_test,0,NULL,'recovery',recovery_test_2,
      issuer_test,subject_test,'synthetic-factor-context-session',source_at,clock_timestamp(),clock_timestamp()+interval '12 hours');
  UPDATE groundbnb.privileged_session_activity SET
    attestation_id='f5400000-0000-4000-8000-000000000002',
    last_activity_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE account_id=account_test AND identity_issuer=issuer_test AND identity_subject=subject_test
      AND managed_session_id='synthetic-factor-context-session' AND security_epoch=0;
  IF NOT EXISTS(SELECT 1 FROM groundbnb.privileged_session_activity
      WHERE account_id=account_test AND security_epoch=0 AND attestation_id='f5400000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'Fresh challenge did not replace the bound activity attestation';
  END IF;
END $$;
SELECT 'factor_service_context_passed_rollback_pending' AS result;
ROLLBACK;
