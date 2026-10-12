-- M1-01AE dormant enrollment writer contract. No grants or credential activation.
BEGIN;
DO $$
DECLARE e record; app_role text; factor_role text; app_oid oid; factor_oid oid;
  owner_oid oid; cloud_admin_oid oid; app_record record; factor_record record;
  receipt_count integer; app_functions oid[]; factor_functions oid[];
  expected_app_functions oid[]; expected_factor_functions oid[];
BEGIN
  IF current_database() IS DISTINCT FROM 'groundbnb' OR session_user IS DISTINCT FROM 'neondb_owner' OR
     current_user IS DISTINCT FROM 'neondb_owner' THEN
    RAISE EXCEPTION 'Expected groundbnb as neondb_owner';
  END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  factor_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_factor_service'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_factor_service' END;
  SELECT count(*) INTO receipt_count FROM groundbnb.schema_migrations;
  IF app_role IS NULL OR factor_role IS NULL OR receipt_count IS DISTINCT FROM 13 OR
     (SELECT count(*) FROM groundbnb.schema_migrations WHERE version=ANY(ARRAY[
       '0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
       '0005_profile_records','0006_profile_transfer','0007_membership_foundation','0008_provider_reservations',
       '0009_privileged_factors','0010_factor_recovery_activity','0011_membership_reader',
       '0012_factor_service','0013_factor_service_principal']::text[])) IS DISTINCT FROM 13 OR
     EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0014_factor_enrollment') OR
     to_regclass('groundbnb.factor_enrollment_operations') IS NOT NULL OR
     to_regprocedure('groundbnb.read_factor_enrollment_context(text,text,text,timestamptz)') IS NOT NULL OR
     to_regprocedure('groundbnb.read_pending_factor_for_enrollment(text,text,text,timestamptz,uuid,uuid,uuid,bigint)') IS NOT NULL OR
     to_regprocedure('groundbnb.begin_factor_enrollment(text,text,text,timestamptz,uuid,bigint,bigint,uuid,uuid,bytea,text,jsonb)') IS NOT NULL OR
     to_regprocedure('groundbnb.record_factor_enrollment_attempt(text,text,text,timestamptz,uuid,uuid,uuid,uuid,bigint,bytea,text)') IS NOT NULL OR
     to_regprocedure('groundbnb.verify_factor_enrollment(text,text,text,timestamptz,uuid,uuid,uuid,uuid,bigint,bytea,bigint)') IS NOT NULL OR
     to_regprocedure('groundbnb.read_factor_enrollment_receipt(text,text,text,timestamptz,uuid,text,uuid,uuid,bigint)') IS NOT NULL THEN
    RAISE EXCEPTION 'Requires exact pinned local/preview 0001-0013 baseline';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user") IS DISTINCT FROM 1 OR NOT EXISTS(
      SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic Auth fixture';
  END IF;
  SELECT oid INTO STRICT owner_oid FROM pg_roles WHERE rolname='neondb_owner';
  SELECT oid INTO STRICT cloud_admin_oid FROM pg_roles WHERE rolname='cloud_admin';
  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  SELECT oid INTO STRICT factor_oid FROM pg_roles WHERE rolname=factor_role;
  SELECT * INTO STRICT app_record FROM pg_roles WHERE oid=app_oid;
  SELECT * INTO STRICT factor_record FROM pg_roles WHERE oid=factor_oid;
  SELECT array_agg(p.oid ORDER BY p.oid)
    INTO app_functions FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
      AND has_function_privilege(app_oid,p.oid,'EXECUTE');
  SELECT array_agg(p.oid ORDER BY p.oid)
    INTO factor_functions FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
      AND has_function_privilege(factor_oid,p.oid,'EXECUTE');
  SELECT array_agg(v ORDER BY v) INTO expected_app_functions FROM unnest(ARRAY[
    to_regprocedure('groundbnb.read_membership(text,text)')::oid,
    to_regprocedure('groundbnb.read_profile(text,text)')::oid,
    to_regprocedure('groundbnb.read_profile_operation(text,text,uuid)')::oid,
    to_regprocedure('groundbnb.save_profile(text,text,uuid,bigint,jsonb)')::oid,
    to_regprocedure('groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)')::oid,
    to_regprocedure('groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)')::oid]) AS x(v);
  SELECT array_agg(v ORDER BY v) INTO expected_factor_functions FROM unnest(ARRAY[
    to_regprocedure('groundbnb.read_factor_challenge_state(text,text,text,timestamptz)')::oid,
    to_regprocedure('groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer)')::oid,
    to_regprocedure('groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer)')::oid,
    to_regprocedure('groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer)')::oid,
    to_regprocedure('groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text)')::oid]) AS x(v);
  IF NOT app_record.rolcanlogin OR app_record.rolsuper OR app_record.rolcreatedb OR app_record.rolcreaterole OR
     app_record.rolreplication OR app_record.rolbypassrls OR app_record.rolinherit OR
     app_record.rolconnlimit IS DISTINCT FROM 4 OR
     (app_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) IS DISTINCT FROM true OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=app_oid) OR
     (SELECT count(*) FROM pg_auth_members WHERE roleid=app_oid) IS DISTINCT FROM 1 OR
     NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=owner_oid AND roleid=app_oid AND
       grantor=cloud_admin_oid AND admin_option IS TRUE AND inherit_option IS FALSE AND set_option IS FALSE) OR
     app_functions IS DISTINCT FROM expected_app_functions OR
     factor_record.rolcanlogin IS DISTINCT FROM false OR factor_record.rolsuper OR factor_record.rolcreatedb OR
     factor_record.rolcreaterole OR factor_record.rolreplication OR factor_record.rolbypassrls OR factor_record.rolinherit OR
     factor_record.rolconnlimit IS DISTINCT FROM 2 OR factor_record.rolconfig IS NOT NULL OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=factor_oid) OR
     (SELECT count(*) FROM pg_auth_members WHERE roleid=factor_oid) IS DISTINCT FROM 1 OR
     NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=owner_oid AND roleid=factor_oid AND
       grantor=cloud_admin_oid AND admin_option IS TRUE AND inherit_option IS FALSE AND set_option IS FALSE) OR
     factor_functions IS DISTINCT FROM expected_factor_functions OR
     has_database_privilege(app_oid,current_database(),'CREATE') OR has_schema_privilege(app_oid,'groundbnb','CREATE') OR
     has_schema_privilege(app_oid,'groundbnb','USAGE') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.environment_identity','SELECT') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.schema_migrations','SELECT') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.environment_identity','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_table_privilege(app_oid,'groundbnb.schema_migrations','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_schema_privilege(factor_oid,'groundbnb','CREATE') OR
     has_schema_privilege(factor_oid,'groundbnb','USAGE') IS DISTINCT FROM true OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m','f') AND
                 c.relname NOT IN ('environment_identity','schema_migrations')) OR
              (n.nspname='neon_auth' AND c.relkind IN ('r','p','v','m','f')))
         AND CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
           has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') ELSE false END) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname IN ('groundbnb','neon_auth') AND c.relkind='S' AND
         (has_sequence_privilege(app_oid,c.oid,'USAGE') OR has_sequence_privilege(app_oid,c.oid,'SELECT') OR
          has_sequence_privilege(app_oid,c.oid,'UPDATE'))) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname IN ('groundbnb','neon_auth') AND c.relkind IN ('r','p','v','m','f','S') AND
         (CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
            has_table_privilege(factor_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          ELSE false END OR CASE WHEN c.relkind='S' THEN
            has_sequence_privilege(factor_oid,c.oid,'USAGE,SELECT,UPDATE') ELSE false END)) THEN
    RAISE EXCEPTION 'Pinned app/factor role baseline or exact creator membership differs';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='groundbnb' AND p.proname IN
        ('read_factor_challenge_state','record_factor_challenge_attempt','consume_factor_totp_candidate',
         'consume_factor_recovery_candidate','read_factor_operation_receipt') AND
        (p.proowner IS DISTINCT FROM owner_oid OR p.prosecdef IS DISTINCT FROM true OR
         p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
         EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
           WHERE acl.grantee=0 OR acl.grantee<>p.proowner AND acl.grantee<>factor_oid OR
             acl.privilege_type<>'EXECUTE' OR acl.is_grantable))) OR
     (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname IN
         ('read_factor_challenge_state','record_factor_challenge_attempt','consume_factor_totp_candidate',
          'consume_factor_recovery_candidate','read_factor_operation_receipt')) IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'Existing private 0012 factor-function contract differs';
  END IF;
END $$;

CREATE TABLE groundbnb.factor_enrollment_operations (
  operation_id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  identity_issuer text NOT NULL CHECK (length(identity_issuer) BETWEEN 1 AND 500),
  identity_subject text NOT NULL CHECK (length(identity_subject) BETWEEN 1 AND 200),
  managed_session_id text NOT NULL CHECK (length(managed_session_id) BETWEEN 1 AND 200),
  operation_kind text NOT NULL CHECK (operation_kind IN ('begin','verify')),
  request_fingerprint bytea NOT NULL CHECK (octet_length(request_fingerprint)=32),
  factor_id uuid NOT NULL,
  security_epoch bigint NOT NULL CHECK (security_epoch>=0),
  status text NOT NULL CHECK (status IN ('pending','rejected','verified')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(identity_issuer,identity_subject,account_id)
    REFERENCES groundbnb.account_identities(issuer,subject,account_id) ON DELETE RESTRICT,
  FOREIGN KEY(factor_id,account_id,security_epoch)
    REFERENCES groundbnb.privileged_factor_enrollments(factor_id,account_id,security_epoch) ON DELETE RESTRICT,
  CHECK (isfinite(created_at) AND isfinite(completed_at) AND completed_at>=created_at),
  CHECK ((operation_kind='begin' AND status='pending') OR
         (operation_kind='verify' AND status IN ('rejected','verified')))
);
CREATE INDEX factor_enrollment_operations_owner_time_idx
  ON groundbnb.factor_enrollment_operations(account_id,created_at DESC);
ALTER TABLE groundbnb.factor_enrollment_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON groundbnb.factor_enrollment_operations FROM PUBLIC;
DO $$
DECLARE owner_oid oid; app_role text; factor_role text; e record;
BEGIN
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  factor_role:=CASE WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_factor_service'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_factor_service' END;
  SELECT oid INTO STRICT owner_oid FROM pg_roles WHERE rolname='neondb_owner';
  IF app_role IS NULL OR factor_role IS NULL OR
     EXISTS(SELECT 1 FROM aclexplode(COALESCE((SELECT c.relacl FROM pg_class c
       WHERE c.oid='groundbnb.factor_enrollment_operations'::regclass),acldefault('r',owner_oid))) acl
       WHERE acl.grantee=0 OR acl.grantee<>owner_oid OR acl.is_grantable) OR
     has_table_privilege(app_role,'groundbnb.factor_enrollment_operations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_table_privilege(factor_role,'groundbnb.factor_enrollment_operations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
    RAISE EXCEPTION 'Enrollment receipt table must remain owner-only';
  END IF;
END $$;
COMMENT ON TABLE groundbnb.factor_enrollment_operations IS
  'Immutable, owner/session-bound lifecycle receipts. Contains no OTP, secret envelope, key, provisioning payload, or raw error.';

CREATE FUNCTION groundbnb._guard_factor_enrollment_operation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Factor enrollment operation receipts are immutable';
END $$;
CREATE TRIGGER factor_enrollment_operation_immutable BEFORE UPDATE OR DELETE
  ON groundbnb.factor_enrollment_operations FOR EACH ROW
  EXECUTE FUNCTION groundbnb._guard_factor_enrollment_operation();
REVOKE ALL ON FUNCTION groundbnb._guard_factor_enrollment_operation() FROM PUBLIC;

CREATE FUNCTION groundbnb.read_factor_enrollment_context(
  p_issuer text,p_subject text,p_session_id text,p_session_expires_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; role_value text; epoch_value bigint; live_count bigint; factor_row record;
  begin_row record; factor_json jsonb; rate_limited boolean; window_start timestamptz; now_at timestamptz;
BEGIN
  account_uuid:=groundbnb._factor_lock_identity(p_issuer,p_subject,p_session_id,p_session_expires_at,false);
  IF account_uuid IS NULL THEN RAISE EXCEPTION 'Factor enrollment owner or session unavailable'; END IF;
  SELECT role INTO role_value FROM groundbnb.accounts WHERE id=account_uuid AND status='active';
  IF role_value IS NULL OR role_value NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Factor enrollment owner or session unavailable';
  END IF;
  now_at:=clock_timestamp();
  SELECT security_epoch INTO epoch_value FROM groundbnb.account_security_epochs WHERE account_id=account_uuid;
  IF NOT FOUND THEN epoch_value:=0; END IF;
  SELECT count(*) INTO live_count FROM groundbnb.privileged_factor_enrollments f
    WHERE f.account_id=account_uuid AND f.state IN ('pending','verified');
  factor_json:=NULL;
  IF live_count=1 THEN
    SELECT * INTO factor_row FROM groundbnb.privileged_factor_enrollments f
      WHERE f.account_id=account_uuid AND f.state IN ('pending','verified');
    IF factor_row.security_epoch=epoch_value THEN
      SELECT * INTO begin_row FROM groundbnb.factor_enrollment_operations o
        WHERE o.account_id=account_uuid AND o.factor_id=factor_row.factor_id AND
          o.security_epoch=epoch_value AND o.operation_kind='begin' AND o.status='pending';
      IF FOUND THEN
        factor_json:=jsonb_build_object('factorId',factor_row.factor_id,'securityEpoch',factor_row.security_epoch,
          'state',factor_row.state,'lastAcceptedStep',(SELECT max(s.accepted_step)
            FROM groundbnb.accepted_factor_steps s WHERE s.account_id=account_uuid AND
              s.factor_id=factor_row.factor_id AND s.security_epoch=epoch_value),
          'beginOperationId',begin_row.operation_id,
          'requestFingerprint',translate(rtrim(encode(begin_row.request_fingerprint,'base64'),E'=\n'),'+/','-_'),
          'sessionAttested',CASE WHEN factor_row.state='verified' THEN EXISTS(
            SELECT 1 FROM groundbnb.privileged_factor_attestations a JOIN groundbnb.privileged_session_activity s
              ON s.attestation_id=a.attestation_id AND s.account_id=a.account_id AND
                 s.identity_issuer=a.identity_issuer AND s.identity_subject=a.identity_subject AND
                 s.managed_session_id=a.managed_session_id AND s.security_epoch=a.security_epoch
              WHERE a.account_id=account_uuid AND a.factor_id=factor_row.factor_id AND
                a.security_epoch=epoch_value AND a.identity_issuer=p_issuer AND
                a.identity_subject=p_subject AND a.managed_session_id=p_session_id AND
                a.revoked_at IS NULL AND a.issued_at<=now_at AND a.factor_verified_at<=now_at AND a.expires_at>now_at AND
                a.factor_verified_at>=now_at-interval '12 hours' AND s.last_activity_at<=now_at AND
                s.last_activity_at>=now_at-interval '30 minutes' AND s.last_activity_at<=a.expires_at AND
                s.last_activity_at>=a.issued_at AND s.last_activity_at<=a.factor_verified_at+interval '12 hours')
            ELSE false END);
      END IF;
    END IF;
  END IF;
  window_start:=date_bin(interval '15 minutes',now_at,timestamptz '1970-01-01 00:00:00+00');
  SELECT COALESCE(sum(w.attempt_count),0)>=5 OR COALESCE(bool_or(w.blocked_until>now_at),false)
    INTO rate_limited FROM groundbnb.factor_attempt_windows w
    WHERE w.account_id=account_uuid AND w.bucket_fingerprint=groundbnb._factor_bucket_fingerprint()
      AND w.window_started_at=window_start;
  IF p_session_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Factor enrollment session expired'; END IF;
  RETURN jsonb_build_object('accountId',account_uuid,'role',role_value,'accountStatus','active',
    'securityEpoch',epoch_value,'anyLiveFactor',live_count>0,'rateLimited',COALESCE(rate_limited,false),
    'factor',factor_json);
END $$;
REVOKE ALL ON FUNCTION groundbnb.read_factor_enrollment_context(text,text,text,timestamptz) FROM PUBLIC;

CREATE FUNCTION groundbnb.read_pending_factor_for_enrollment(
  p_issuer text,p_subject text,p_session_id text,p_session_expires_at timestamptz,
  p_begin_operation_id uuid,p_expected_account_id uuid,p_expected_factor_id uuid,p_expected_security_epoch bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; current_epoch bigint; factor_row record; begin_row record;
  now_at timestamptz;
BEGIN
  account_uuid:=groundbnb._factor_lock_identity(p_issuer,p_subject,p_session_id,p_session_expires_at,false);
  IF account_uuid IS NULL OR p_expected_account_id IS DISTINCT FROM account_uuid OR
     p_begin_operation_id IS NULL OR p_expected_factor_id IS NULL OR p_expected_security_epoch IS NULL THEN
    RAISE EXCEPTION 'Pending factor unavailable';
  END IF;
  SELECT security_epoch INTO current_epoch FROM groundbnb.account_security_epochs WHERE account_id=account_uuid;
  IF current_epoch IS DISTINCT FROM p_expected_security_epoch THEN RAISE EXCEPTION 'Pending factor unavailable'; END IF;
  SELECT * INTO STRICT begin_row FROM groundbnb.factor_enrollment_operations o
    WHERE o.operation_id=p_begin_operation_id AND o.account_id=account_uuid AND
      o.identity_issuer=p_issuer AND o.identity_subject=p_subject AND o.managed_session_id=p_session_id AND
      o.operation_kind='begin' AND o.status='pending' AND o.factor_id=p_expected_factor_id AND
      o.security_epoch=p_expected_security_epoch;
  SELECT * INTO STRICT factor_row FROM groundbnb.privileged_factor_enrollments f
    WHERE f.account_id=account_uuid AND f.factor_id=p_expected_factor_id AND
      f.security_epoch=p_expected_security_epoch AND f.state='pending';
  now_at:=clock_timestamp();
  IF p_session_expires_at<=now_at THEN RAISE EXCEPTION 'Pending factor unavailable'; END IF;
  RETURN jsonb_build_object('accountId',account_uuid,'factorId',factor_row.factor_id,
    'securityEpoch',factor_row.security_epoch,'state',factor_row.state,'keyId',factor_row.envelope_key_id,
    'envelope',factor_row.encrypted_secret,'lastAcceptedStep',(SELECT max(s.accepted_step)
      FROM groundbnb.accepted_factor_steps s WHERE s.account_id=account_uuid AND
        s.factor_id=factor_row.factor_id AND s.security_epoch=factor_row.security_epoch),
    'beginOperationId',begin_row.operation_id,
    'requestFingerprint',translate(rtrim(encode(begin_row.request_fingerprint,'base64'),E'=\n'),'+/','-_'));
END $$;
REVOKE ALL ON FUNCTION groundbnb.read_pending_factor_for_enrollment(text,text,text,timestamptz,uuid,uuid,uuid,bigint) FROM PUBLIC;

CREATE FUNCTION groundbnb.begin_factor_enrollment(
  p_issuer text,p_subject text,p_session_id text,p_session_expires_at timestamptz,
  p_expected_account_id uuid,p_expected_current_epoch bigint,p_target_epoch bigint,
  p_candidate_factor_id uuid,p_operation_id uuid,p_request_fingerprint bytea,
  p_envelope_key_id text,p_encrypted_secret jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; epoch_value bigint; prior record; prior_factor_state text; live_count bigint;
  now_at timestamptz; window_start timestamptz; total_count bigint; limited boolean;
  fingerprint_text text; status_value text:='rejected';
BEGIN
  fingerprint_text:=CASE WHEN p_request_fingerprint IS NULL THEN NULL ELSE
    translate(rtrim(encode(p_request_fingerprint,'base64'),E'=\n'),'+/','-_') END;
  account_uuid:=groundbnb._factor_lock_identity(p_issuer,p_subject,p_session_id,p_session_expires_at,true);
  IF account_uuid IS NULL OR p_expected_account_id IS DISTINCT FROM account_uuid OR
     p_expected_current_epoch IS NULL OR p_target_epoch IS NULL OR p_candidate_factor_id IS NULL OR
     p_operation_id IS NULL OR p_request_fingerprint IS NULL OR octet_length(p_request_fingerprint)<>32 OR
     p_envelope_key_id IS NULL OR p_envelope_key_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' OR
     jsonb_typeof(p_encrypted_secret) IS DISTINCT FROM 'object' OR
     (p_encrypted_secret-ARRAY['version','keyId','nonce','ciphertext','tag']::text[]) IS DISTINCT FROM '{}'::jsonb OR
     NOT (p_encrypted_secret ?& ARRAY['version','keyId','nonce','ciphertext','tag']::text[]) OR
     p_encrypted_secret->'version' IS DISTINCT FROM '1'::jsonb OR
     p_encrypted_secret->>'keyId' IS DISTINCT FROM p_envelope_key_id OR
     COALESCE(p_encrypted_secret->>'nonce' ~ '^[A-Za-z0-9_-]{16}$',false) IS DISTINCT FROM true OR
     COALESCE(p_encrypted_secret->>'ciphertext' ~ '^[A-Za-z0-9_-]{43,138}$',false) IS DISTINCT FROM true OR
     COALESCE(p_encrypted_secret->>'tag' ~ '^[A-Za-z0-9_-]{22}$',false) IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('status','rejected','operationId',p_operation_id,'kind','begin',
      'accountId',p_expected_account_id,'factorId',p_candidate_factor_id,'securityEpoch',p_target_epoch,
      'requestFingerprint',fingerprint_text);
  END IF;
  SELECT security_epoch INTO epoch_value FROM groundbnb.account_security_epochs
    WHERE account_id=account_uuid FOR UPDATE;
  IF NOT FOUND THEN epoch_value:=0; END IF;
  SELECT count(*) INTO live_count FROM groundbnb.privileged_factor_enrollments f
    WHERE f.account_id=account_uuid AND f.state IN ('pending','verified');
  IF live_count>0 THEN
    PERFORM 1 FROM groundbnb.privileged_factor_enrollments f
      WHERE f.account_id=account_uuid AND f.state IN ('pending','verified') FOR UPDATE;
  END IF;
  SELECT * INTO prior FROM groundbnb.factor_enrollment_operations o WHERE o.operation_id=p_operation_id;
  IF FOUND THEN
    SELECT state INTO prior_factor_state FROM groundbnb.privileged_factor_enrollments
      WHERE account_id=account_uuid AND factor_id=prior.factor_id AND security_epoch=prior.security_epoch FOR UPDATE;
    IF prior.account_id=account_uuid AND prior.identity_issuer=p_issuer AND prior.identity_subject=p_subject AND
       prior.managed_session_id=p_session_id AND prior.operation_kind='begin' AND prior.status='pending' AND
       prior.request_fingerprint=p_request_fingerprint AND prior.factor_id=p_candidate_factor_id AND
       prior.security_epoch=p_target_epoch AND p_target_epoch=epoch_value AND prior_factor_state='pending' AND
       p_session_expires_at>clock_timestamp() THEN
      status_value:='committed';
    END IF;
    RETURN jsonb_build_object('status',status_value,'operationId',p_operation_id,'kind','begin',
      'accountId',account_uuid,'factorId',p_candidate_factor_id,'securityEpoch',p_target_epoch,
      'requestFingerprint',fingerprint_text);
  END IF;
  IF epoch_value>=9223372036854775807 THEN
    RETURN jsonb_build_object('status','rejected','operationId',p_operation_id,'kind','begin',
      'accountId',account_uuid,'factorId',p_candidate_factor_id,'securityEpoch',p_target_epoch,
      'requestFingerprint',fingerprint_text);
  END IF;
  IF p_expected_current_epoch IS DISTINCT FROM epoch_value OR p_target_epoch IS DISTINCT FROM epoch_value+1 OR
     live_count<>0 OR p_session_expires_at<=clock_timestamp() THEN
    RETURN jsonb_build_object('status','rejected','operationId',p_operation_id,'kind','begin',
      'accountId',account_uuid,'factorId',p_candidate_factor_id,'securityEpoch',p_target_epoch,
      'requestFingerprint',fingerprint_text);
  END IF;
  now_at:=clock_timestamp();
  window_start:=date_bin(interval '15 minutes',now_at,timestamptz '1970-01-01 00:00:00+00');
  SELECT COALESCE(sum(w.attempt_count),0)>=5 OR COALESCE(bool_or(w.blocked_until>now_at),false)
    INTO limited FROM groundbnb.factor_attempt_windows w
    WHERE w.account_id=account_uuid AND w.bucket_fingerprint=groundbnb._factor_bucket_fingerprint()
      AND w.window_started_at=window_start;
  IF COALESCE(limited,false) THEN
    RETURN jsonb_build_object('status','rejected','operationId',p_operation_id,'kind','begin',
      'accountId',account_uuid,'factorId',p_candidate_factor_id,'securityEpoch',p_target_epoch,
      'requestFingerprint',fingerprint_text);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM groundbnb.account_security_epochs WHERE account_id=account_uuid) THEN
    INSERT INTO groundbnb.account_security_epochs(account_id,security_epoch,updated_at)
      VALUES(account_uuid,0,now_at);
  END IF;
  UPDATE groundbnb.account_security_epochs SET security_epoch=p_target_epoch,
      updated_at=GREATEST(clock_timestamp(),updated_at+interval '1 microsecond'),updated_by=account_uuid
    WHERE account_id=account_uuid AND security_epoch=p_expected_current_epoch;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factor enrollment epoch changed'; END IF;
  INSERT INTO groundbnb.security_epoch_events(account_id,previous_epoch,new_epoch,actor_account_id,reason,occurred_at)
    VALUES(account_uuid,p_expected_current_epoch,p_target_epoch,account_uuid,'factor_enrollment',clock_timestamp());
  INSERT INTO groundbnb.privileged_factor_enrollments(factor_id,account_id,security_epoch,state,
      envelope_key_id,encrypted_secret,created_at)
    VALUES(p_candidate_factor_id,account_uuid,p_target_epoch,'pending',p_envelope_key_id,p_encrypted_secret,clock_timestamp());
  INSERT INTO groundbnb.factor_enrollment_operations(operation_id,account_id,identity_issuer,identity_subject,
      managed_session_id,operation_kind,request_fingerprint,factor_id,security_epoch,status,created_at,completed_at)
    VALUES(p_operation_id,account_uuid,p_issuer,p_subject,p_session_id,'begin',p_request_fingerprint,
      p_candidate_factor_id,p_target_epoch,'pending',clock_timestamp(),clock_timestamp());
  INSERT INTO groundbnb.privileged_factor_audit(account_id,actor_account_id,factor_id,security_epoch,
      identity_issuer,identity_subject,outcome,reason,occurred_at)
    VALUES(account_uuid,account_uuid,p_candidate_factor_id,p_target_epoch,p_issuer,p_subject,
      'enrollment_started','accepted',clock_timestamp());
  IF p_session_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Factor enrollment session expired'; END IF;
  RETURN jsonb_build_object('status','committed','operationId',p_operation_id,'kind','begin',
    'accountId',account_uuid,'factorId',p_candidate_factor_id,'securityEpoch',p_target_epoch,
    'requestFingerprint',fingerprint_text);
END $$;
REVOKE ALL ON FUNCTION groundbnb.begin_factor_enrollment(text,text,text,timestamptz,uuid,bigint,bigint,uuid,uuid,bytea,text,jsonb) FROM PUBLIC;

CREATE FUNCTION groundbnb.record_factor_enrollment_attempt(
  p_issuer text,p_subject text,p_session_id text,p_session_expires_at timestamptz,
  p_begin_operation_id uuid,p_operation_id uuid,p_expected_account_id uuid,p_expected_factor_id uuid,
  p_expected_security_epoch bigint,p_request_fingerprint bytea,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; current_epoch bigint; factor_state text; begin_row record; prior record;
  now_at timestamptz; window_start timestamptz; window_end timestamptz; total_count bigint;
  updated_count integer; audit_outcome text; audit_reason text; fingerprint_text text; writer_status text;
BEGIN
  fingerprint_text:=CASE WHEN p_request_fingerprint IS NULL THEN NULL ELSE
    translate(rtrim(encode(p_request_fingerprint,'base64'),E'=\n'),'+/','-_') END;
  account_uuid:=groundbnb._factor_lock_identity(p_issuer,p_subject,p_session_id,p_session_expires_at,true);
  IF account_uuid IS NULL THEN
    RETURN jsonb_build_object('status','unknown','operationId',p_operation_id,'kind','verify',
      'accountId',p_expected_account_id,'factorId',p_expected_factor_id,
      'securityEpoch',p_expected_security_epoch,'requestFingerprint',fingerprint_text);
  END IF;
  SELECT security_epoch INTO current_epoch FROM groundbnb.account_security_epochs
    WHERE account_id=account_uuid FOR UPDATE;
  SELECT state INTO factor_state FROM groundbnb.privileged_factor_enrollments
    WHERE account_id=account_uuid AND factor_id=p_expected_factor_id AND
      security_epoch=p_expected_security_epoch FOR UPDATE;
  SELECT * INTO begin_row FROM groundbnb.factor_enrollment_operations o
    WHERE o.operation_id=p_begin_operation_id AND o.account_id=account_uuid AND
      o.identity_issuer=p_issuer AND o.identity_subject=p_subject AND o.managed_session_id=p_session_id AND
      o.operation_kind='begin' AND o.status='pending' AND o.factor_id=p_expected_factor_id AND
      o.security_epoch=p_expected_security_epoch;
  IF p_operation_id IS NULL OR p_request_fingerprint IS NULL OR octet_length(p_request_fingerprint)<>32 OR
     p_reason IS NULL OR p_reason NOT IN ('invalid','replay','expired','unavailable','throttled') OR
     p_expected_account_id IS DISTINCT FROM account_uuid OR current_epoch IS DISTINCT FROM p_expected_security_epoch OR
     factor_state IS DISTINCT FROM 'pending' OR NOT FOUND THEN
    RETURN jsonb_build_object('status','rejected','operationId',p_operation_id,'kind','verify',
      'accountId',account_uuid,'factorId',p_expected_factor_id,'securityEpoch',p_expected_security_epoch,
      'requestFingerprint',fingerprint_text);
  END IF;
  SELECT * INTO prior FROM groundbnb.factor_enrollment_operations o WHERE o.operation_id=p_operation_id;
  IF FOUND THEN
    writer_status:=CASE WHEN prior.account_id=account_uuid AND prior.identity_issuer=p_issuer AND
      prior.identity_subject=p_subject AND prior.managed_session_id=p_session_id AND
      prior.operation_kind='verify' AND prior.status='rejected' AND prior.request_fingerprint=p_request_fingerprint AND
      prior.factor_id=p_expected_factor_id AND prior.security_epoch=p_expected_security_epoch THEN 'recorded' ELSE 'rejected' END;
    RETURN jsonb_build_object('status',writer_status,'operationId',p_operation_id,'kind','verify',
      'accountId',account_uuid,'factorId',p_expected_factor_id,'securityEpoch',p_expected_security_epoch,
      'requestFingerprint',fingerprint_text);
  END IF;
  IF p_session_expires_at<=clock_timestamp() THEN
    RETURN jsonb_build_object('status','unknown','operationId',p_operation_id,'kind','verify',
      'accountId',account_uuid,'factorId',p_expected_factor_id,'securityEpoch',p_expected_security_epoch,
      'requestFingerprint',fingerprint_text);
  END IF;
  now_at:=clock_timestamp();
  window_start:=date_bin(interval '15 minutes',now_at,timestamptz '1970-01-01 00:00:00+00');
  window_end:=window_start+interval '15 minutes';
  INSERT INTO groundbnb.factor_attempt_windows(account_id,identity_issuer,identity_subject,bucket_fingerprint,
      window_started_at,window_ends_at,attempt_count,updated_at)
    VALUES(account_uuid,p_issuer,p_subject,groundbnb._factor_bucket_fingerprint(),window_start,window_end,1,now_at)
    ON CONFLICT(account_id,identity_issuer,identity_subject,bucket_fingerprint,window_started_at)
    DO UPDATE SET attempt_count=GREATEST(groundbnb.factor_attempt_windows.attempt_count,
        LEAST(groundbnb.factor_attempt_windows.attempt_count+1,5)),
      updated_at=GREATEST(clock_timestamp(),groundbnb.factor_attempt_windows.updated_at+interval '1 microsecond')
    RETURNING attempt_count INTO updated_count;
  SELECT COALESCE(sum(w.attempt_count),0) INTO total_count FROM groundbnb.factor_attempt_windows w
    WHERE w.account_id=account_uuid AND w.bucket_fingerprint=groundbnb._factor_bucket_fingerprint()
      AND w.window_started_at=window_start;
  IF total_count>=5 THEN
    UPDATE groundbnb.factor_attempt_windows SET blocked_until=GREATEST(COALESCE(blocked_until,window_end),window_end),
      updated_at=GREATEST(clock_timestamp(),updated_at+interval '1 microsecond')
      WHERE account_id=account_uuid AND identity_issuer=p_issuer AND identity_subject=p_subject AND
        bucket_fingerprint=groundbnb._factor_bucket_fingerprint() AND window_started_at=window_start;
    audit_outcome:='rate_limited'; audit_reason:='throttled';
  ELSE
    audit_outcome:='challenge_rejected';
    audit_reason:=CASE WHEN p_reason='throttled' THEN 'unavailable' ELSE p_reason END;
  END IF;
  INSERT INTO groundbnb.privileged_factor_audit(account_id,actor_account_id,factor_id,security_epoch,
      identity_issuer,identity_subject,outcome,reason,occurred_at)
    VALUES(account_uuid,account_uuid,p_expected_factor_id,p_expected_security_epoch,p_issuer,p_subject,
      audit_outcome,audit_reason,clock_timestamp());
  INSERT INTO groundbnb.factor_enrollment_operations(operation_id,account_id,identity_issuer,identity_subject,
      managed_session_id,operation_kind,request_fingerprint,factor_id,security_epoch,status,created_at,completed_at)
    VALUES(p_operation_id,account_uuid,p_issuer,p_subject,p_session_id,'verify',p_request_fingerprint,
      p_expected_factor_id,p_expected_security_epoch,'rejected',now_at,clock_timestamp());
  IF p_session_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Factor enrollment session expired'; END IF;
  RETURN jsonb_build_object('status','recorded','operationId',p_operation_id,'kind','verify',
    'accountId',account_uuid,'factorId',p_expected_factor_id,'securityEpoch',p_expected_security_epoch,
    'requestFingerprint',fingerprint_text);
END $$;
REVOKE ALL ON FUNCTION groundbnb.record_factor_enrollment_attempt(text,text,text,timestamptz,uuid,uuid,uuid,uuid,bigint,bytea,text) FROM PUBLIC;

CREATE FUNCTION groundbnb.verify_factor_enrollment(
  p_issuer text,p_subject text,p_session_id text,p_session_expires_at timestamptz,
  p_begin_operation_id uuid,p_operation_id uuid,p_expected_account_id uuid,p_expected_factor_id uuid,
  p_expected_security_epoch bigint,p_request_fingerprint bytea,p_matched_step bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; current_epoch bigint; factor_state text; begin_row record; prior record;
  now_at timestamptz; current_step bigint; window_start timestamptz; window_end timestamptz;
  total_count bigint; factor_count bigint; source_time timestamptz; issued_time timestamptz;
  expires_time timestamptz; fingerprint_text text; writer_status text; audit_outcome text; audit_reason text;
BEGIN
  fingerprint_text:=CASE WHEN p_request_fingerprint IS NULL THEN NULL ELSE
    translate(rtrim(encode(p_request_fingerprint,'base64'),E'=\n'),'+/','-_') END;
  account_uuid:=groundbnb._factor_lock_identity(p_issuer,p_subject,p_session_id,p_session_expires_at,true);
  IF account_uuid IS NULL THEN
    RETURN jsonb_build_object('status','unknown','operationId',p_operation_id,'kind','verify',
      'accountId',p_expected_account_id,'factorId',p_expected_factor_id,
      'securityEpoch',p_expected_security_epoch,'requestFingerprint',fingerprint_text);
  END IF;
  SELECT security_epoch INTO current_epoch FROM groundbnb.account_security_epochs
    WHERE account_id=account_uuid FOR UPDATE;
  SELECT state INTO factor_state FROM groundbnb.privileged_factor_enrollments
    WHERE account_id=account_uuid AND factor_id=p_expected_factor_id AND
      security_epoch=p_expected_security_epoch FOR UPDATE;
  SELECT * INTO begin_row FROM groundbnb.factor_enrollment_operations o
    WHERE o.operation_id=p_begin_operation_id AND o.account_id=account_uuid AND
      o.identity_issuer=p_issuer AND o.identity_subject=p_subject AND o.managed_session_id=p_session_id AND
      o.operation_kind='begin' AND o.status='pending' AND o.factor_id=p_expected_factor_id AND
      o.security_epoch=p_expected_security_epoch;
  IF p_expected_account_id IS DISTINCT FROM account_uuid OR p_expected_security_epoch IS DISTINCT FROM current_epoch OR
     NOT FOUND OR p_operation_id IS NULL OR
     p_request_fingerprint IS NULL OR octet_length(p_request_fingerprint)<>32 OR p_matched_step IS NULL OR
     p_matched_step<0 THEN
    RETURN jsonb_build_object('status','rejected','operationId',p_operation_id,'kind','verify',
      'accountId',account_uuid,'factorId',p_expected_factor_id,'securityEpoch',p_expected_security_epoch,
      'requestFingerprint',fingerprint_text);
  END IF;
  SELECT count(*) INTO factor_count FROM groundbnb.privileged_factor_enrollments f
    WHERE f.account_id=account_uuid AND f.state IN ('pending','verified');
  IF factor_count>1 OR (factor_count=0 AND factor_state IS DISTINCT FROM 'verified') THEN
    RETURN jsonb_build_object('status','rejected','operationId',p_operation_id,'kind','verify',
      'accountId',account_uuid,'factorId',p_expected_factor_id,'securityEpoch',p_expected_security_epoch,
      'requestFingerprint',fingerprint_text);
  END IF;
  SELECT * INTO prior FROM groundbnb.factor_enrollment_operations o WHERE o.operation_id=p_operation_id;
  IF FOUND THEN
    IF prior.account_id=account_uuid AND prior.identity_issuer=p_issuer AND prior.identity_subject=p_subject AND
       prior.managed_session_id=p_session_id AND prior.operation_kind='verify' AND
       prior.request_fingerprint=p_request_fingerprint AND prior.factor_id=p_expected_factor_id AND
       prior.security_epoch=p_expected_security_epoch THEN
      writer_status:=CASE WHEN prior.status='verified' AND factor_state='verified' THEN 'committed'
        WHEN prior.status='rejected' THEN 'rejected' ELSE 'rejected' END;
    ELSE
      writer_status:='rejected';
    END IF;
    RETURN jsonb_build_object('status',writer_status,'operationId',p_operation_id,'kind','verify',
      'accountId',account_uuid,'factorId',p_expected_factor_id,'securityEpoch',p_expected_security_epoch,
      'requestFingerprint',fingerprint_text);
  END IF;
  IF factor_state IS DISTINCT FROM 'pending' OR factor_count<>1 THEN
    RETURN jsonb_build_object('status','rejected','operationId',p_operation_id,'kind','verify',
      'accountId',account_uuid,'factorId',p_expected_factor_id,'securityEpoch',p_expected_security_epoch,
      'requestFingerprint',fingerprint_text);
  END IF;
  now_at:=clock_timestamp();
  IF p_session_expires_at<=now_at THEN
    RETURN jsonb_build_object('status','unknown','operationId',p_operation_id,'kind','verify',
      'accountId',account_uuid,'factorId',p_expected_factor_id,'securityEpoch',p_expected_security_epoch,
      'requestFingerprint',fingerprint_text);
  END IF;
  window_start:=date_bin(interval '15 minutes',now_at,timestamptz '1970-01-01 00:00:00+00');
  window_end:=window_start+interval '15 minutes';
  SELECT COALESCE(sum(w.attempt_count),0) INTO total_count FROM groundbnb.factor_attempt_windows w
    WHERE w.account_id=account_uuid AND w.bucket_fingerprint=groundbnb._factor_bucket_fingerprint()
      AND w.window_started_at=window_start;
  current_step:=floor(extract(epoch FROM now_at)/30)::bigint;
  IF total_count>=5 OR p_matched_step<current_step-1 OR p_matched_step>current_step+1 OR
     EXISTS(SELECT 1 FROM groundbnb.accepted_factor_steps s WHERE s.account_id=account_uuid AND
       s.factor_id=p_expected_factor_id AND s.security_epoch=p_expected_security_epoch AND
       s.accepted_step>=p_matched_step) THEN
    INSERT INTO groundbnb.factor_attempt_windows(account_id,identity_issuer,identity_subject,bucket_fingerprint,
        window_started_at,window_ends_at,attempt_count,updated_at)
      VALUES(account_uuid,p_issuer,p_subject,groundbnb._factor_bucket_fingerprint(),window_start,window_end,1,now_at)
      ON CONFLICT(account_id,identity_issuer,identity_subject,bucket_fingerprint,window_started_at)
      DO UPDATE SET attempt_count=GREATEST(groundbnb.factor_attempt_windows.attempt_count,
        LEAST(groundbnb.factor_attempt_windows.attempt_count+1,5)),
        updated_at=GREATEST(clock_timestamp(),groundbnb.factor_attempt_windows.updated_at+interval '1 microsecond');
    SELECT COALESCE(sum(w.attempt_count),0) INTO total_count FROM groundbnb.factor_attempt_windows w
      WHERE w.account_id=account_uuid AND w.bucket_fingerprint=groundbnb._factor_bucket_fingerprint()
        AND w.window_started_at=window_start;
    IF total_count>=5 THEN
      UPDATE groundbnb.factor_attempt_windows SET blocked_until=GREATEST(COALESCE(blocked_until,window_end),window_end),
        updated_at=GREATEST(clock_timestamp(),updated_at+interval '1 microsecond')
        WHERE account_id=account_uuid AND identity_issuer=p_issuer AND identity_subject=p_subject AND
          bucket_fingerprint=groundbnb._factor_bucket_fingerprint() AND window_started_at=window_start;
      audit_outcome:='rate_limited'; audit_reason:='throttled';
    ELSE
      audit_outcome:='challenge_rejected'; audit_reason:=CASE
        WHEN p_matched_step<current_step-1 OR p_matched_step>current_step+1 THEN 'expired' ELSE 'replay' END;
    END IF;
    INSERT INTO groundbnb.privileged_factor_audit(account_id,actor_account_id,factor_id,security_epoch,
        identity_issuer,identity_subject,outcome,reason,occurred_at)
      VALUES(account_uuid,account_uuid,p_expected_factor_id,p_expected_security_epoch,p_issuer,p_subject,
        audit_outcome,audit_reason,clock_timestamp());
    INSERT INTO groundbnb.factor_enrollment_operations(operation_id,account_id,identity_issuer,identity_subject,
        managed_session_id,operation_kind,request_fingerprint,factor_id,security_epoch,status,created_at,completed_at)
      VALUES(p_operation_id,account_uuid,p_issuer,p_subject,p_session_id,'verify',p_request_fingerprint,
        p_expected_factor_id,p_expected_security_epoch,'rejected',now_at,clock_timestamp());
    IF p_session_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Factor enrollment session expired'; END IF;
    RETURN jsonb_build_object('status','rejected','operationId',p_operation_id,'kind','verify',
      'accountId',account_uuid,'factorId',p_expected_factor_id,'securityEpoch',p_expected_security_epoch,
      'requestFingerprint',fingerprint_text);
  END IF;
  INSERT INTO groundbnb.accepted_factor_steps(account_id,factor_id,security_epoch,accepted_step,accepted_at)
    VALUES(account_uuid,p_expected_factor_id,p_expected_security_epoch,p_matched_step,now_at)
    RETURNING accepted_at INTO source_time;
  UPDATE groundbnb.privileged_factor_enrollments SET state='verified',verified_at=source_time
    WHERE account_id=account_uuid AND factor_id=p_expected_factor_id AND
      security_epoch=p_expected_security_epoch AND state='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending factor changed during verification'; END IF;
  issued_time:=clock_timestamp();
  expires_time:=LEAST(issued_time+interval '12 hours',p_session_expires_at);
  IF expires_time<=issued_time THEN RAISE EXCEPTION 'Session expired before factor attestation'; END IF;
  INSERT INTO groundbnb.privileged_factor_attestations(account_id,factor_id,security_epoch,challenge_method,
      accepted_step,identity_issuer,identity_subject,managed_session_id,factor_verified_at,issued_at,expires_at)
    VALUES(account_uuid,p_expected_factor_id,p_expected_security_epoch,'totp',p_matched_step,p_issuer,p_subject,
      p_session_id,source_time,issued_time,expires_time);
  INSERT INTO groundbnb.privileged_session_activity(account_id,identity_issuer,identity_subject,
      managed_session_id,security_epoch,attestation_id,last_activity_at,updated_at)
    SELECT account_uuid,p_issuer,p_subject,p_session_id,p_expected_security_epoch,a.attestation_id,issued_time,issued_time
      FROM groundbnb.privileged_factor_attestations a WHERE a.account_id=account_uuid AND
        a.factor_id=p_expected_factor_id AND a.security_epoch=p_expected_security_epoch AND
        a.accepted_step=p_matched_step AND a.identity_issuer=p_issuer AND
        a.identity_subject=p_subject AND a.managed_session_id=p_session_id
    ON CONFLICT(account_id,identity_issuer,identity_subject,managed_session_id,security_epoch)
    DO UPDATE SET attestation_id=EXCLUDED.attestation_id,last_activity_at=EXCLUDED.last_activity_at,
      updated_at=GREATEST(clock_timestamp(),groundbnb.privileged_session_activity.updated_at+interval '1 microsecond');
  INSERT INTO groundbnb.privileged_factor_audit(account_id,actor_account_id,factor_id,security_epoch,
      identity_issuer,identity_subject,outcome,reason,occurred_at)
    VALUES(account_uuid,account_uuid,p_expected_factor_id,p_expected_security_epoch,p_issuer,p_subject,
      'enrollment_verified','accepted',issued_time);
  INSERT INTO groundbnb.factor_enrollment_operations(operation_id,account_id,identity_issuer,identity_subject,
      managed_session_id,operation_kind,request_fingerprint,factor_id,security_epoch,status,created_at,completed_at)
    VALUES(p_operation_id,account_uuid,p_issuer,p_subject,p_session_id,'verify',p_request_fingerprint,
      p_expected_factor_id,p_expected_security_epoch,'verified',now_at,clock_timestamp());
  IF p_session_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Factor enrollment session expired'; END IF;
  RETURN jsonb_build_object('status','committed','operationId',p_operation_id,'kind','verify',
    'accountId',account_uuid,'factorId',p_expected_factor_id,'securityEpoch',p_expected_security_epoch,
    'requestFingerprint',fingerprint_text);
END $$;
REVOKE ALL ON FUNCTION groundbnb.verify_factor_enrollment(text,text,text,timestamptz,uuid,uuid,uuid,uuid,bigint,bytea,bigint) FROM PUBLIC;

CREATE FUNCTION groundbnb.read_factor_enrollment_receipt(
  p_issuer text,p_subject text,p_session_id text,p_session_expires_at timestamptz,
  p_operation_id uuid,p_kind text,p_expected_account_id uuid,p_expected_factor_id uuid,
  p_expected_security_epoch bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; receipt record;
BEGIN
  account_uuid:=groundbnb._factor_lock_identity(p_issuer,p_subject,p_session_id,p_session_expires_at,false);
  IF account_uuid IS NULL THEN RAISE EXCEPTION 'Factor enrollment receipt unavailable'; END IF;
  IF p_session_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Factor enrollment receipt unavailable'; END IF;
  IF p_operation_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('begin','verify') OR
     p_expected_account_id IS DISTINCT FROM account_uuid THEN
    RETURN jsonb_build_object('status','not_found','operationId',p_operation_id,'kind',p_kind,
      'accountId',account_uuid,'issuer',p_issuer,'subject',p_subject,'sessionId',p_session_id,
      'factorId',NULL,'securityEpoch',NULL,'requestFingerprint',NULL);
  END IF;
  SELECT * INTO receipt FROM groundbnb.factor_enrollment_operations o
    WHERE o.operation_id=p_operation_id AND o.account_id=account_uuid AND
      o.identity_issuer=p_issuer AND o.identity_subject=p_subject AND o.managed_session_id=p_session_id AND
      o.operation_kind=p_kind;
  IF p_session_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Factor enrollment receipt unavailable'; END IF;
  IF NOT FOUND OR (p_expected_factor_id IS NOT NULL AND receipt.factor_id IS DISTINCT FROM p_expected_factor_id) OR
     (p_expected_security_epoch IS NOT NULL AND receipt.security_epoch IS DISTINCT FROM p_expected_security_epoch) THEN
    RETURN jsonb_build_object('status','not_found','operationId',p_operation_id,'kind',p_kind,
      'accountId',account_uuid,'issuer',p_issuer,'subject',p_subject,'sessionId',p_session_id,
      'factorId',NULL,'securityEpoch',NULL,'requestFingerprint',NULL);
  END IF;
  RETURN jsonb_build_object('status',receipt.status,'operationId',receipt.operation_id,
    'kind',receipt.operation_kind,'accountId',receipt.account_id,'issuer',receipt.identity_issuer,
    'subject',receipt.identity_subject,'sessionId',receipt.managed_session_id,'factorId',receipt.factor_id,
    'securityEpoch',receipt.security_epoch,
    'requestFingerprint',translate(rtrim(encode(receipt.request_fingerprint,'base64'),E'=\n'),'+/','-_'));
END $$;
REVOKE ALL ON FUNCTION groundbnb.read_factor_enrollment_receipt(text,text,text,timestamptz,uuid,text,uuid,uuid,bigint) FROM PUBLIC;

DO $$
DECLARE e record; app_role text; factor_role text;
BEGIN
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  factor_role:=CASE WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_factor_service'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_factor_service' END;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='groundbnb' AND p.proname IN
        ('read_factor_enrollment_context','read_pending_factor_for_enrollment','begin_factor_enrollment',
         'record_factor_enrollment_attempt','verify_factor_enrollment','read_factor_enrollment_receipt')) IS DISTINCT FROM 6 OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname IN
        ('read_factor_enrollment_context','read_pending_factor_for_enrollment','begin_factor_enrollment',
         'record_factor_enrollment_attempt','verify_factor_enrollment','read_factor_enrollment_receipt') AND
         (p.proowner IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='neondb_owner') OR
          p.prosecdef IS DISTINCT FROM true OR
          p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
          has_function_privilege(app_role,p.oid,'EXECUTE') OR
          has_function_privilege(factor_role,p.oid,'EXECUTE') OR EXISTS(
            SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
              WHERE acl.grantee=0 OR acl.grantee<>p.proowner OR
                acl.privilege_type<>'EXECUTE' OR acl.is_grantable))) THEN
    RAISE EXCEPTION 'Enrollment functions must remain private and dormant';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='groundbnb' AND p.proname='_guard_factor_enrollment_operation' AND p.prorettype='trigger'::regtype) IS DISTINCT FROM 1 OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname='_guard_factor_enrollment_operation' AND
         (p.proowner IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='neondb_owner') OR
          p.prosecdef IS DISTINCT FROM false OR
          p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
          has_function_privilege(app_role,p.oid,'EXECUTE') OR has_function_privilege(factor_role,p.oid,'EXECUTE') OR
          EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
            WHERE acl.grantee=0 OR acl.grantee<>p.proowner OR acl.is_grantable))) OR
     (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid='groundbnb.factor_enrollment_operations'::regclass AND NOT t.tgisinternal) IS DISTINCT FROM 1 OR
     NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid='groundbnb.factor_enrollment_operations'::regclass AND
       NOT t.tgisinternal AND t.tgname='factor_enrollment_operation_immutable' AND
       t.tgfoid=to_regprocedure('groundbnb._guard_factor_enrollment_operation()')) THEN
    RAISE EXCEPTION 'Enrollment receipt immutability guard differs';
  END IF;
END $$;

INSERT INTO groundbnb.schema_migrations(version) VALUES('0014_factor_enrollment');
COMMIT;
