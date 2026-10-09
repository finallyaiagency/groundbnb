-- M1-01V/W dormant private factor challenge functions. No app grants are added.
BEGIN;
DO $$
DECLARE e record; app_role text; role_record record; receipt_count integer;
BEGIN
  IF current_database()<>'groundbnb' OR session_user<>'neondb_owner' THEN
    RAISE EXCEPTION 'Expected groundbnb as neondb_owner';
  END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  SELECT count(*) INTO receipt_count FROM groundbnb.schema_migrations;
  IF app_role IS NULL OR receipt_count IS DISTINCT FROM 11 OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0003_profile_domain') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0004_profile_operation_status') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0005_profile_records') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0006_profile_transfer') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0007_membership_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0008_provider_reservations') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0009_privileged_factors') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0010_factor_recovery_activity') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0011_membership_reader') OR
     EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0012_factor_service') THEN
    RAISE EXCEPTION 'Requires exact pinned local/preview 0001-0011 baseline';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user") IS DISTINCT FROM 1 OR NOT EXISTS(
      SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic Auth fixture';
  END IF;
  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=app_role;
  IF NOT role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole OR
     role_record.rolreplication OR role_record.rolbypassrls OR role_record.rolinherit OR role_record.rolconnlimit<>4 OR
     (role_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) IS DISTINCT FROM true OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=role_record.oid) OR
     has_database_privilege(role_record.oid,current_database(),'CREATE') OR has_schema_privilege(role_record.oid,'groundbnb','CREATE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.read_profile(text,text)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile(text,text,uuid,bigint,jsonb)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.read_profile_operation(text,text,uuid)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb.read_membership(text,text)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m','f','S') AND c.relname NOT IN ('environment_identity','schema_migrations'))
           OR n.nspname='neon_auth') AND
         (CASE WHEN c.relkind IN ('r','p','v','m','f') THEN has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') ELSE false END OR
          CASE WHEN c.relkind='S' THEN has_sequence_privilege(role_record.oid,c.oid,'USAGE,SELECT,UPDATE') ELSE false END)) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype) AND
       has_function_privilege(role_record.oid,p.oid,'EXECUTE') AND NOT (
         (p.proname='read_profile' AND p.proargtypes='25 25'::oidvector) OR
         (p.proname='save_profile' AND p.proargtypes='25 25 2950 20 3802'::oidvector) OR
         (p.proname='read_profile_operation' AND p.proargtypes='25 25 2950'::oidvector) OR
         (p.proname='save_profile_records' AND p.proargtypes='25 25 2950 20 3802 3802'::oidvector) OR
         (p.proname='save_profile_transfer' AND p.proargtypes='25 25 2950 20 3802 3802'::oidvector))) THEN
    RAISE EXCEPTION 'Pinned app-role function-only ACL baseline differs from approved M1 boundary';
  END IF;
  IF to_regprocedure('groundbnb.read_factor_challenge_state(text,text,text,timestamptz)') IS NOT NULL OR
     to_regprocedure('groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer)') IS NOT NULL OR
     to_regprocedure('groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer)') IS NOT NULL OR
     to_regprocedure('groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer)') IS NOT NULL OR
     to_regprocedure('groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Factor service function already exists without its migration receipt';
  END IF;
END $$;

CREATE TABLE groundbnb.factor_challenge_operations (
  operation_id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  identity_issuer text NOT NULL CHECK (length(identity_issuer) BETWEEN 1 AND 500),
  identity_subject text NOT NULL CHECK (length(identity_subject) BETWEEN 1 AND 200),
  managed_session_id text NOT NULL CHECK (length(managed_session_id) BETWEEN 1 AND 200),
  method text NOT NULL CHECK (method IN ('totp','recovery')),
  operation_kind text NOT NULL CHECK (operation_kind IN ('attempt','totp','recovery')),
  status text NOT NULL CHECK (status IN ('accepted','rejected','unavailable')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(created_at)),
  CHECK ((operation_kind='totp' AND method='totp') OR
    (operation_kind='recovery' AND method='recovery') OR operation_kind='attempt')
);
ALTER TABLE groundbnb.factor_challenge_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON groundbnb.factor_challenge_operations FROM PUBLIC;

CREATE FUNCTION groundbnb._guard_factor_challenge_operation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Factor challenge operation receipts are immutable';
END $$;
CREATE TRIGGER factor_challenge_operation_immutable BEFORE UPDATE OR DELETE
  ON groundbnb.factor_challenge_operations FOR EACH ROW
  EXECUTE FUNCTION groundbnb._guard_factor_challenge_operation();
REVOKE ALL ON FUNCTION groundbnb._guard_factor_challenge_operation() FROM PUBLIC;

-- Locks in canonical order: managed session, account + identity, epoch, factor,
-- account serialization lock (the account row), then operation/source rows.
CREATE FUNCTION groundbnb._factor_lock_identity(
  p_issuer text,p_subject text,p_session_id text,p_session_expires_at timestamptz,p_lock_rows boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE e record; expected_role text; expected_issuer text; session_expiry timestamptz; account_uuid uuid;
BEGIN
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  expected_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  expected_issuer:=CASE e.kind
    WHEN 'local' THEN 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth'
    WHEN 'preview' THEN 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth' END;
  IF expected_role IS NULL OR session_user NOT IN (expected_role,'neondb_owner') OR
     p_issuer IS DISTINCT FROM expected_issuer OR p_subject IS NULL OR length(p_subject) NOT BETWEEN 1 AND 200 OR
     p_session_id IS NULL OR length(p_session_id) NOT BETWEEN 1 AND 200 OR
     p_session_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR
     p_subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR
     p_session_expires_at IS NULL OR NOT isfinite(p_session_expires_at) THEN RETURN NULL; END IF;
  -- Resolve the exact provider session first. Never select or return its token.
  IF p_lock_rows THEN
    SELECT s."expiresAt" INTO session_expiry FROM neon_auth.session s
      WHERE s.id=p_session_id::uuid AND s."userId"=p_subject::uuid FOR UPDATE OF s;
  ELSE
    SELECT s."expiresAt" INTO session_expiry FROM neon_auth.session s
      WHERE s.id=p_session_id::uuid AND s."userId"=p_subject::uuid;
  END IF;
  IF NOT FOUND OR session_expiry IS NULL OR NOT isfinite(session_expiry) OR
     session_expiry<=clock_timestamp() OR p_session_expires_at<=clock_timestamp() OR
     session_expiry<p_session_expires_at THEN RETURN NULL; END IF;
  IF p_lock_rows THEN
    SELECT a.id INTO account_uuid FROM groundbnb.account_identities i
      JOIN groundbnb.accounts a ON a.id=i.account_id
      WHERE i.issuer=p_issuer AND i.subject=p_subject AND i.revoked_at IS NULL AND a.status='active'
        AND a.role IN ('owner','admin') FOR UPDATE OF a,i;
  ELSE
    SELECT a.id INTO account_uuid FROM groundbnb.account_identities i
      JOIN groundbnb.accounts a ON a.id=i.account_id
      WHERE i.issuer=p_issuer AND i.subject=p_subject AND i.revoked_at IS NULL AND a.status='active'
        AND a.role IN ('owner','admin');
  END IF;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN account_uuid;
END $$;
REVOKE ALL ON FUNCTION groundbnb._factor_lock_identity(text,text,text,timestamptz,boolean) FROM PUBLIC;

CREATE FUNCTION groundbnb._factor_bucket_fingerprint() RETURNS bytea
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
  SELECT decode(md5('groundbnb.factor.challenge.account-wide.v1') ||
                md5('groundbnb.factor.challenge.account-wide.v1'),'hex')
$$;
REVOKE ALL ON FUNCTION groundbnb._factor_bucket_fingerprint() FROM PUBLIC;

CREATE FUNCTION groundbnb.read_factor_challenge_state(
  p_issuer text,p_subject text,p_session_id text,p_session_expires_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; epoch_value bigint; factor_row record; limited boolean; window_start timestamptz;
BEGIN
  account_uuid:=groundbnb._factor_lock_identity(p_issuer,p_subject,p_session_id,p_session_expires_at,false);
  IF account_uuid IS NULL THEN RAISE EXCEPTION 'Factor challenge owner or session unavailable'; END IF;
  SELECT security_epoch INTO epoch_value FROM groundbnb.account_security_epochs WHERE account_id=account_uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factor security epoch unavailable'; END IF;
  SELECT * INTO factor_row FROM groundbnb.privileged_factor_enrollments f
    WHERE f.account_id=account_uuid AND f.security_epoch=epoch_value AND f.state='verified';
  IF NOT FOUND THEN RAISE EXCEPTION 'Verified factor unavailable'; END IF;
  window_start:=date_bin(interval '15 minutes',clock_timestamp(),timestamptz '1970-01-01 00:00:00+00');
  SELECT COALESCE(sum(w.attempt_count),0)>=5 OR COALESCE(bool_or(w.blocked_until>clock_timestamp()),false)
    INTO limited FROM groundbnb.factor_attempt_windows w
    WHERE w.account_id=account_uuid AND w.bucket_fingerprint=groundbnb._factor_bucket_fingerprint()
      AND w.window_started_at=window_start;
  RETURN jsonb_build_object(
    'principal',jsonb_build_object('accountId',account_uuid,'issuer',p_issuer,'subject',p_subject,
      'sessionId',p_session_id,'accountStatus','active','role',(SELECT role FROM groundbnb.accounts WHERE id=account_uuid),
      'securityEpoch',epoch_value),
    'currentSecurityEpoch',epoch_value,'accountSuspended',false,'sessionRevoked',false,
    'rateLimited',COALESCE(limited,false),
    'factor',jsonb_build_object('accountId',account_uuid,'factorId',factor_row.factor_id,
      'securityEpoch',epoch_value,'state','verified','keyId',factor_row.envelope_key_id,
      'envelope',factor_row.encrypted_secret,'lastAcceptedStep',(SELECT max(s.accepted_step)
        FROM groundbnb.accepted_factor_steps s WHERE s.account_id=account_uuid AND
          s.factor_id=factor_row.factor_id AND s.security_epoch=epoch_value)),
    'recoveryRecords',COALESCE((SELECT jsonb_agg(jsonb_build_object('recoveryId',r.recovery_id,
      'accountId',r.account_id,'factorId',r.factor_id,'securityEpoch',r.security_epoch,
      'record',jsonb_build_object('version',r.digest_version,
        'salt',translate(rtrim(encode(r.salt,'base64'),'='),'+/','-_'),
        'digest',translate(rtrim(encode(r.recovery_digest,'base64'),'='),'+/','-_'))) ORDER BY r.recovery_id)
      FROM (SELECT * FROM groundbnb.privileged_recovery_records rr WHERE rr.account_id=account_uuid
        AND rr.factor_id=factor_row.factor_id AND rr.security_epoch=epoch_value AND rr.consumed_at IS NULL
        ORDER BY rr.recovery_id LIMIT 100) r),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION groundbnb.read_factor_challenge_state(text,text,text,timestamptz) FROM PUBLIC;

CREATE FUNCTION groundbnb.record_factor_challenge_attempt(
  p_issuer text,p_subject text,p_session_id text,p_session_expires_at timestamptz,
  p_factor_id uuid,p_epoch bigint,p_operation_id uuid,p_method text,p_outcome text,
  p_max_failures integer,p_window_seconds integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; current_epoch bigint; factor_state text; prior record; now_at timestamptz:=clock_timestamp();
  bucket bytea:=groundbnb._factor_bucket_fingerprint(); window_start timestamptz; window_end timestamptz;
  new_count integer; total_count bigint; final_status text; audit_outcome text; audit_reason text;
BEGIN
  account_uuid:=groundbnb._factor_lock_identity(p_issuer,p_subject,p_session_id,p_session_expires_at,true);
  IF account_uuid IS NULL OR p_operation_id IS NULL OR p_factor_id IS NULL OR p_epoch IS NULL OR
     p_method IS NULL OR p_method NOT IN ('totp','recovery') OR p_outcome IS NULL OR p_outcome NOT IN ('rejected','unavailable') OR
     p_max_failures IS DISTINCT FROM 5 OR p_window_seconds IS DISTINCT FROM 900 THEN
    RETURN jsonb_build_object('status','unknown'); END IF;
  SELECT security_epoch INTO current_epoch FROM groundbnb.account_security_epochs WHERE account_id=account_uuid FOR UPDATE;
  IF current_epoch IS DISTINCT FROM p_epoch THEN RETURN jsonb_build_object('status','unknown'); END IF;
  SELECT state INTO factor_state FROM groundbnb.privileged_factor_enrollments
    WHERE account_id=account_uuid AND factor_id=p_factor_id AND security_epoch=p_epoch FOR UPDATE;
  IF factor_state IS DISTINCT FROM 'verified' THEN RETURN jsonb_build_object('status','unknown'); END IF;
  window_start:=date_bin(interval '15 minutes',now_at,timestamptz '1970-01-01 00:00:00+00');
  window_end:=window_start+interval '15 minutes';
  SELECT * INTO prior FROM groundbnb.factor_challenge_operations WHERE operation_id=p_operation_id FOR UPDATE;
  IF FOUND THEN
    IF prior.account_id=account_uuid AND prior.identity_issuer=p_issuer AND prior.identity_subject=p_subject AND
       prior.managed_session_id=p_session_id AND prior.method=p_method AND prior.operation_kind='attempt' THEN
      IF p_session_expires_at<=clock_timestamp() THEN RETURN jsonb_build_object('status','unknown'); END IF;
      RETURN jsonb_build_object('status','recorded');
    END IF;
    RETURN jsonb_build_object('status','unknown');
  END IF;
  now_at:=clock_timestamp();
  IF p_session_expires_at<=now_at THEN RETURN jsonb_build_object('status','unknown'); END IF;
  window_start:=date_bin(interval '15 minutes',now_at,timestamptz '1970-01-01 00:00:00+00');
  window_end:=window_start+interval '15 minutes';
  INSERT INTO groundbnb.factor_attempt_windows(account_id,identity_issuer,identity_subject,bucket_fingerprint,
      window_started_at,window_ends_at,attempt_count,blocked_until,updated_at)
    VALUES(account_uuid,p_issuer,p_subject,bucket,window_start,window_end,1,NULL,now_at)
    ON CONFLICT(account_id,identity_issuer,identity_subject,bucket_fingerprint,window_started_at)
    DO UPDATE SET attempt_count=LEAST(groundbnb.factor_attempt_windows.attempt_count+1,5),
      updated_at=GREATEST(clock_timestamp(),groundbnb.factor_attempt_windows.updated_at+interval '1 microsecond')
    RETURNING attempt_count INTO new_count;
  SELECT COALESCE(sum(attempt_count),0) INTO total_count FROM groundbnb.factor_attempt_windows
    WHERE account_id=account_uuid AND bucket_fingerprint=bucket AND window_started_at=window_start;
  IF total_count>=5 THEN
    UPDATE groundbnb.factor_attempt_windows SET blocked_until=GREATEST(COALESCE(blocked_until,window_end),window_end),
      updated_at=GREATEST(clock_timestamp(),updated_at+interval '1 microsecond')
      WHERE account_id=account_uuid AND identity_issuer=p_issuer AND identity_subject=p_subject AND
        bucket_fingerprint=bucket AND window_started_at=window_start;
    audit_outcome:='rate_limited'; audit_reason:='throttled';
  ELSIF p_outcome='unavailable' THEN audit_outcome:='challenge_rejected'; audit_reason:='unavailable';
  ELSE audit_outcome:='challenge_rejected'; audit_reason:='invalid'; END IF;
  final_status:=CASE WHEN p_outcome='unavailable' THEN 'unavailable' ELSE 'rejected' END;
  INSERT INTO groundbnb.privileged_factor_audit(account_id,factor_id,security_epoch,identity_issuer,
      identity_subject,outcome,reason,occurred_at)
    VALUES(account_uuid,p_factor_id,p_epoch,p_issuer,p_subject,audit_outcome,audit_reason,now_at);
  INSERT INTO groundbnb.factor_challenge_operations(operation_id,account_id,identity_issuer,identity_subject,
      managed_session_id,method,operation_kind,status,created_at)
    VALUES(p_operation_id,account_uuid,p_issuer,p_subject,p_session_id,p_method,'attempt',final_status,now_at);
  RETURN jsonb_build_object('status','recorded');
END $$;
REVOKE ALL ON FUNCTION groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer) FROM PUBLIC;

CREATE FUNCTION groundbnb.consume_factor_totp_candidate(
  p_issuer text,p_subject text,p_session_id text,p_session_expires_at timestamptz,
  p_factor_id uuid,p_epoch bigint,p_matched_step bigint,p_operation_id uuid,
  p_max_failures integer,p_window_seconds integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; current_epoch bigint; factor_state text; receipt record; step_row record;
  now_at timestamptz:=clock_timestamp(); current_step bigint; window_start timestamptz; total_count bigint;
  source_time timestamptz; issued_time timestamptz; expires_time timestamptz; final_status text;
BEGIN
  account_uuid:=groundbnb._factor_lock_identity(p_issuer,p_subject,p_session_id,p_session_expires_at,true);
  IF account_uuid IS NULL OR p_operation_id IS NULL OR p_factor_id IS NULL OR p_epoch IS NULL OR p_matched_step IS NULL OR
     p_max_failures IS DISTINCT FROM 5 OR p_window_seconds IS DISTINCT FROM 900 THEN
    RETURN jsonb_build_object('status','rejected'); END IF;
  SELECT security_epoch INTO current_epoch FROM groundbnb.account_security_epochs WHERE account_id=account_uuid FOR UPDATE;
  IF current_epoch IS DISTINCT FROM p_epoch THEN RETURN jsonb_build_object('status','rejected'); END IF;
  SELECT state INTO factor_state FROM groundbnb.privileged_factor_enrollments
    WHERE account_id=account_uuid AND factor_id=p_factor_id AND security_epoch=p_epoch FOR UPDATE;
  IF factor_state IS DISTINCT FROM 'verified' THEN RETURN jsonb_build_object('status','rejected'); END IF;
  window_start:=date_bin(interval '15 minutes',now_at,timestamptz '1970-01-01 00:00:00+00');
  SELECT * INTO receipt FROM groundbnb.factor_challenge_operations WHERE operation_id=p_operation_id FOR UPDATE;
  IF FOUND THEN
    IF receipt.account_id=account_uuid AND receipt.identity_issuer=p_issuer AND receipt.identity_subject=p_subject AND
       receipt.managed_session_id=p_session_id AND receipt.method='totp' AND receipt.operation_kind='totp' THEN
      IF p_session_expires_at<=clock_timestamp() THEN RETURN jsonb_build_object('status','rejected'); END IF;
      RETURN jsonb_build_object('status',receipt.status);
    END IF;
    RETURN jsonb_build_object('status','rejected');
  END IF;
  now_at:=clock_timestamp();
  IF p_session_expires_at<=now_at THEN RETURN jsonb_build_object('status','rejected'); END IF;
  window_start:=date_bin(interval '15 minutes',now_at,timestamptz '1970-01-01 00:00:00+00');
  SELECT COALESCE(sum(w.attempt_count),0) INTO total_count FROM groundbnb.factor_attempt_windows w
    WHERE w.account_id=account_uuid AND w.bucket_fingerprint=groundbnb._factor_bucket_fingerprint()
      AND w.window_started_at=window_start;
  current_step:=floor(extract(epoch FROM now_at)/30)::bigint;
  IF total_count>=5 OR p_matched_step<current_step-1 OR p_matched_step>current_step+1 OR p_matched_step<0 OR
     EXISTS(SELECT 1 FROM groundbnb.accepted_factor_steps s WHERE s.account_id=account_uuid AND
       s.factor_id=p_factor_id AND s.security_epoch=p_epoch AND s.accepted_step>=p_matched_step) THEN
    final_status:='rejected';
  ELSE
    INSERT INTO groundbnb.accepted_factor_steps(account_id,factor_id,security_epoch,accepted_step,accepted_at)
      VALUES(account_uuid,p_factor_id,p_epoch,p_matched_step,now_at) RETURNING accepted_at INTO source_time;
    issued_time:=clock_timestamp(); expires_time:=LEAST(issued_time+interval '12 hours',p_session_expires_at);
    IF expires_time<=issued_time THEN RAISE EXCEPTION 'Session expired before factor attestation'; END IF;
    INSERT INTO groundbnb.privileged_factor_attestations(account_id,factor_id,security_epoch,challenge_method,accepted_step,
        identity_issuer,identity_subject,managed_session_id,factor_verified_at,issued_at,expires_at)
      VALUES(account_uuid,p_factor_id,p_epoch,'totp',p_matched_step,p_issuer,p_subject,p_session_id,
        source_time,issued_time,expires_time);
    INSERT INTO groundbnb.privileged_session_activity(account_id,identity_issuer,identity_subject,
        managed_session_id,security_epoch,attestation_id,last_activity_at,updated_at)
      SELECT account_uuid,p_issuer,p_subject,p_session_id,p_epoch,a.attestation_id,issued_time,issued_time
        FROM groundbnb.privileged_factor_attestations a WHERE a.account_id=account_uuid AND a.factor_id=p_factor_id
          AND a.security_epoch=p_epoch AND a.accepted_step=p_matched_step
      ON CONFLICT(account_id,identity_issuer,identity_subject,managed_session_id,security_epoch)
      DO UPDATE SET attestation_id=EXCLUDED.attestation_id,
        last_activity_at=EXCLUDED.last_activity_at,updated_at=clock_timestamp();
    INSERT INTO groundbnb.privileged_factor_audit(account_id,factor_id,security_epoch,identity_issuer,
        identity_subject,outcome,reason,occurred_at)
      VALUES(account_uuid,p_factor_id,p_epoch,p_issuer,p_subject,'challenge_accepted','accepted',issued_time);
    final_status:='accepted';
  END IF;
  IF final_status='rejected' THEN
    INSERT INTO groundbnb.factor_attempt_windows(account_id,identity_issuer,identity_subject,bucket_fingerprint,
        window_started_at,window_ends_at,attempt_count,updated_at)
      VALUES(account_uuid,p_issuer,p_subject,groundbnb._factor_bucket_fingerprint(),window_start,
        window_start+interval '15 minutes',1,clock_timestamp())
      ON CONFLICT(account_id,identity_issuer,identity_subject,bucket_fingerprint,window_started_at)
      DO UPDATE SET attempt_count=LEAST(groundbnb.factor_attempt_windows.attempt_count+1,5),
        updated_at=GREATEST(clock_timestamp(),groundbnb.factor_attempt_windows.updated_at+interval '1 microsecond');
    INSERT INTO groundbnb.privileged_factor_audit(account_id,factor_id,security_epoch,identity_issuer,
        identity_subject,outcome,reason,occurred_at)
      VALUES(account_uuid,p_factor_id,p_epoch,p_issuer,p_subject,'challenge_rejected',
        CASE WHEN total_count>=5 THEN 'throttled' ELSE 'replay' END,clock_timestamp());
  END IF;
  INSERT INTO groundbnb.factor_challenge_operations(operation_id,account_id,identity_issuer,identity_subject,
      managed_session_id,method,operation_kind,status,created_at)
    VALUES(p_operation_id,account_uuid,p_issuer,p_subject,p_session_id,'totp','totp',final_status,clock_timestamp());
  RETURN jsonb_build_object('status',final_status);
END $$;
REVOKE ALL ON FUNCTION groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer) FROM PUBLIC;

CREATE FUNCTION groundbnb.consume_factor_recovery_candidate(
  p_issuer text,p_subject text,p_session_id text,p_session_expires_at timestamptz,
  p_factor_id uuid,p_epoch bigint,p_recovery_id uuid,p_operation_id uuid,
  p_max_failures integer,p_window_seconds integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; current_epoch bigint; factor_state text; receipt record; recovery_row record; recovery_found boolean;
  now_at timestamptz:=clock_timestamp(); window_start timestamptz; total_count bigint;
  source_time timestamptz; issued_time timestamptz; expires_time timestamptz; final_status text;
BEGIN
  account_uuid:=groundbnb._factor_lock_identity(p_issuer,p_subject,p_session_id,p_session_expires_at,true);
  IF account_uuid IS NULL OR p_operation_id IS NULL OR p_factor_id IS NULL OR p_epoch IS NULL OR p_recovery_id IS NULL OR
     p_max_failures IS DISTINCT FROM 5 OR p_window_seconds IS DISTINCT FROM 900 THEN
    RETURN jsonb_build_object('status','rejected'); END IF;
  SELECT security_epoch INTO current_epoch FROM groundbnb.account_security_epochs WHERE account_id=account_uuid FOR UPDATE;
  IF current_epoch IS DISTINCT FROM p_epoch THEN RETURN jsonb_build_object('status','rejected'); END IF;
  SELECT state INTO factor_state FROM groundbnb.privileged_factor_enrollments
    WHERE account_id=account_uuid AND factor_id=p_factor_id AND security_epoch=p_epoch FOR UPDATE;
  IF factor_state IS DISTINCT FROM 'verified' THEN RETURN jsonb_build_object('status','rejected'); END IF;
  window_start:=date_bin(interval '15 minutes',now_at,timestamptz '1970-01-01 00:00:00+00');
  SELECT * INTO receipt FROM groundbnb.factor_challenge_operations WHERE operation_id=p_operation_id FOR UPDATE;
  IF FOUND THEN
    IF receipt.account_id=account_uuid AND receipt.identity_issuer=p_issuer AND receipt.identity_subject=p_subject AND
       receipt.managed_session_id=p_session_id AND receipt.method='recovery' AND receipt.operation_kind='recovery' THEN
      IF p_session_expires_at<=clock_timestamp() THEN RETURN jsonb_build_object('status','rejected'); END IF;
      RETURN jsonb_build_object('status',receipt.status);
    END IF;
    RETURN jsonb_build_object('status','rejected');
  END IF;
  SELECT COALESCE(sum(w.attempt_count),0) INTO total_count FROM groundbnb.factor_attempt_windows w
    WHERE w.account_id=account_uuid AND w.bucket_fingerprint=groundbnb._factor_bucket_fingerprint()
      AND w.window_started_at=window_start;
  SELECT * INTO recovery_row FROM groundbnb.privileged_recovery_records r
    WHERE r.recovery_id=p_recovery_id AND r.account_id=account_uuid AND r.factor_id=p_factor_id
      AND r.security_epoch=p_epoch AND r.consumed_at IS NULL FOR UPDATE;
  recovery_found:=FOUND;
  now_at:=clock_timestamp();
  IF p_session_expires_at<=now_at THEN RETURN jsonb_build_object('status','rejected'); END IF;
  window_start:=date_bin(interval '15 minutes',now_at,timestamptz '1970-01-01 00:00:00+00');
  SELECT COALESCE(sum(w.attempt_count),0) INTO total_count FROM groundbnb.factor_attempt_windows w
    WHERE w.account_id=account_uuid AND w.bucket_fingerprint=groundbnb._factor_bucket_fingerprint()
      AND w.window_started_at=window_start;
  IF total_count>=5 OR NOT recovery_found THEN
    final_status:='rejected';
  ELSE
    UPDATE groundbnb.privileged_recovery_records SET consumed_at=clock_timestamp()
      WHERE recovery_id=p_recovery_id RETURNING consumed_at INTO source_time;
    issued_time:=clock_timestamp(); expires_time:=LEAST(issued_time+interval '12 hours',p_session_expires_at);
    IF expires_time<=issued_time THEN RAISE EXCEPTION 'Session expired before factor attestation'; END IF;
    INSERT INTO groundbnb.privileged_factor_attestations(account_id,factor_id,security_epoch,challenge_method,
        recovery_id,identity_issuer,identity_subject,managed_session_id,factor_verified_at,issued_at,expires_at)
      VALUES(account_uuid,p_factor_id,p_epoch,'recovery',p_recovery_id,p_issuer,p_subject,p_session_id,
        source_time,issued_time,expires_time);
    INSERT INTO groundbnb.privileged_session_activity(account_id,identity_issuer,identity_subject,
        managed_session_id,security_epoch,attestation_id,last_activity_at,updated_at)
      SELECT account_uuid,p_issuer,p_subject,p_session_id,p_epoch,a.attestation_id,issued_time,issued_time
        FROM groundbnb.privileged_factor_attestations a WHERE a.account_id=account_uuid AND a.factor_id=p_factor_id
          AND a.security_epoch=p_epoch AND a.recovery_id=p_recovery_id
      ON CONFLICT(account_id,identity_issuer,identity_subject,managed_session_id,security_epoch)
      DO UPDATE SET attestation_id=EXCLUDED.attestation_id,
        last_activity_at=EXCLUDED.last_activity_at,updated_at=clock_timestamp();
    INSERT INTO groundbnb.privileged_factor_audit(account_id,factor_id,security_epoch,identity_issuer,
        identity_subject,outcome,reason,occurred_at)
      VALUES(account_uuid,p_factor_id,p_epoch,p_issuer,p_subject,'recovery_consumed','accepted',issued_time);
    final_status:='accepted';
  END IF;
  IF final_status='rejected' THEN
    INSERT INTO groundbnb.factor_attempt_windows(account_id,identity_issuer,identity_subject,bucket_fingerprint,
        window_started_at,window_ends_at,attempt_count,updated_at)
      VALUES(account_uuid,p_issuer,p_subject,groundbnb._factor_bucket_fingerprint(),window_start,
        window_start+interval '15 minutes',1,clock_timestamp())
      ON CONFLICT(account_id,identity_issuer,identity_subject,bucket_fingerprint,window_started_at)
      DO UPDATE SET attempt_count=LEAST(groundbnb.factor_attempt_windows.attempt_count+1,5),
        updated_at=GREATEST(clock_timestamp(),groundbnb.factor_attempt_windows.updated_at+interval '1 microsecond');
    INSERT INTO groundbnb.privileged_factor_audit(account_id,factor_id,security_epoch,identity_issuer,
        identity_subject,outcome,reason,occurred_at)
      VALUES(account_uuid,p_factor_id,p_epoch,p_issuer,p_subject,'challenge_rejected',
        CASE WHEN total_count>=5 THEN 'throttled' ELSE 'replay' END,clock_timestamp());
  END IF;
  INSERT INTO groundbnb.factor_challenge_operations(operation_id,account_id,identity_issuer,identity_subject,
      managed_session_id,method,operation_kind,status,created_at)
    VALUES(p_operation_id,account_uuid,p_issuer,p_subject,p_session_id,'recovery','recovery',final_status,clock_timestamp());
  RETURN jsonb_build_object('status',final_status);
END $$;
REVOKE ALL ON FUNCTION groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer) FROM PUBLIC;

CREATE FUNCTION groundbnb.read_factor_operation_receipt(
  p_issuer text,p_subject text,p_session_id text,p_session_expires_at timestamptz,p_operation_id uuid,p_method text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; prior record; receipt_status text:='not_found';
BEGIN
  account_uuid:=groundbnb._factor_lock_identity(p_issuer,p_subject,p_session_id,p_session_expires_at,false);
  IF account_uuid IS NULL OR p_operation_id IS NULL OR p_method IS NULL OR p_method NOT IN ('totp','recovery') THEN
    RAISE EXCEPTION 'Factor operation identity unavailable'; END IF;
  SELECT * INTO prior FROM groundbnb.factor_challenge_operations r WHERE r.operation_id=p_operation_id
    AND r.account_id=account_uuid AND r.identity_issuer=p_issuer AND r.identity_subject=p_subject
    AND r.managed_session_id=p_session_id AND r.method=p_method;
  IF FOUND THEN receipt_status:=prior.status; END IF;
  RETURN jsonb_build_object('status',receipt_status,'operationId',p_operation_id,
    'method',p_method,'accountId',account_uuid,'issuer',p_issuer,'subject',p_subject,'sessionId',p_session_id);
END $$;
REVOKE ALL ON FUNCTION groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text) FROM PUBLIC;

DO $$
DECLARE e record; app_role text; app_oid oid;
BEGIN
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE WHEN e.kind='local' THEN 'groundbnb_local_app' ELSE 'groundbnb_preview_app' END;
  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  IF has_table_privilege(app_oid,'groundbnb.factor_challenge_operations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) acl
       WHERE c.oid='groundbnb.factor_challenge_operations'::regclass AND acl.grantee<>c.relowner) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname IN ('_factor_lock_identity','_factor_bucket_fingerprint',
         '_guard_factor_challenge_operation','read_factor_challenge_state','record_factor_challenge_attempt',
         'consume_factor_totp_candidate','consume_factor_recovery_candidate','read_factor_operation_receipt')
       AND has_function_privilege(app_oid,p.oid,'EXECUTE')) OR
     EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE p.pronamespace='groundbnb'::regnamespace AND p.proname IN ('_factor_lock_identity',
         '_factor_bucket_fingerprint','_guard_factor_challenge_operation','read_factor_challenge_state',
         'record_factor_challenge_attempt','consume_factor_totp_candidate','consume_factor_recovery_candidate',
         'read_factor_operation_receipt') AND acl.grantee<>p.proowner AND acl.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'Factor operation table and functions must remain private pending a separate grant';
  END IF;
END $$;
INSERT INTO groundbnb.schema_migrations(version) VALUES('0012_factor_service');
COMMIT;
