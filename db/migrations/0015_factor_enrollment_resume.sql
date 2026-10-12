-- M1-01AG dormant same-session pending-factor material-resume writer.
-- No function grants, credential activation, keys, route wiring, or live execution.
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
  app_role:=CASE WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  factor_role:=CASE WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_factor_service'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_factor_service' END;
  SELECT count(*) INTO receipt_count FROM groundbnb.schema_migrations;
  IF app_role IS NULL OR factor_role IS NULL OR receipt_count IS DISTINCT FROM 14 OR
     (SELECT count(*) FROM groundbnb.schema_migrations WHERE version=ANY(ARRAY[
       '0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
       '0005_profile_records','0006_profile_transfer','0007_membership_foundation','0008_provider_reservations',
       '0009_privileged_factors','0010_factor_recovery_activity','0011_membership_reader',
       '0012_factor_service','0013_factor_service_principal','0014_factor_enrollment']::text[])) IS DISTINCT FROM 14 OR
     EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0015_factor_enrollment_resume') OR
     to_regclass('groundbnb.factor_enrollment_operations') IS NULL OR
     to_regprocedure('groundbnb.record_factor_enrollment_material_release(text,text,text,timestamptz,uuid,uuid,uuid,uuid,bigint,text,bytea)') IS NOT NULL OR
     to_regprocedure('groundbnb.read_factor_enrollment_material_receipt(text,text,text,timestamptz,uuid,uuid,uuid,bigint,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Requires exact pinned local/preview 0001-0014 baseline';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='groundbnb.factor_enrollment_operations'::regclass
       AND c.contype='c' AND c.conname='factor_enrollment_operations_check' AND
       regexp_replace(lower(pg_get_constraintdef(c.oid)), '[[:space:]]+', '', 'g') =
         'check((isfinite(created_at)andisfinite(completed_at)and(completed_at>=created_at)))') OR
     NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='groundbnb.factor_enrollment_operations'::regclass
       AND c.contype='c' AND c.conname='factor_enrollment_operations_operation_kind_check' AND
       regexp_replace(lower(pg_get_constraintdef(c.oid)), '[[:space:]]+', '', 'g') =
         'check((operation_kind=any(array[''begin''::text,''verify''::text])))') OR
     NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='groundbnb.factor_enrollment_operations'::regclass
       AND c.contype='c' AND c.conname='factor_enrollment_operations_status_check' AND
       regexp_replace(lower(pg_get_constraintdef(c.oid)), '[[:space:]]+', '', 'g') =
         'check((status=any(array[''pending''::text,''rejected''::text,''verified''::text])))') OR
     NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='groundbnb.factor_enrollment_operations'::regclass
       AND c.contype='c' AND c.conname='factor_enrollment_operations_check1' AND
       regexp_replace(lower(pg_get_constraintdef(c.oid)), '[[:space:]]+', '', 'g') =
         'check((((operation_kind=''begin''::text)and(status=''pending''::text))or((operation_kind=''verify''::text)and(status=any(array[''rejected''::text,''verified''::text])))))') THEN
    RAISE EXCEPTION 'Enrollment receipt timestamp or lifecycle check differs';
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
  SELECT array_agg(p.oid ORDER BY p.oid) INTO app_functions FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND has_function_privilege(app_oid,p.oid,'EXECUTE');
  SELECT array_agg(p.oid ORDER BY p.oid) INTO factor_functions FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='groundbnb' AND has_function_privilege(factor_oid,p.oid,'EXECUTE');
  SELECT array_agg(v ORDER BY v) INTO expected_app_functions FROM unnest(ARRAY[
    to_regprocedure('groundbnb.read_membership(text,text)')::oid,
    to_regprocedure('groundbnb.read_profile(text,text)')::oid,
    to_regprocedure('groundbnb.read_profile_operation(text,text,uuid)')::oid,
    to_regprocedure('groundbnb.save_profile(text,text,uuid,bigint,jsonb)')::oid,
    to_regprocedure('groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)')::oid,
    to_regprocedure('groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)')::oid,
    to_regprocedure('groundbnb.refuse_production_synthetic_seed()')::oid]) AS x(v);
  SELECT array_agg(v ORDER BY v) INTO expected_factor_functions FROM unnest(ARRAY[
    to_regprocedure('groundbnb.read_factor_challenge_state(text,text,text,timestamptz)')::oid,
    to_regprocedure('groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer)')::oid,
    to_regprocedure('groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer)')::oid,
    to_regprocedure('groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer)')::oid,
    to_regprocedure('groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text)')::oid,
    to_regprocedure('groundbnb.refuse_production_synthetic_seed()')::oid]) AS x(v);
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
     has_database_privilege(factor_oid,current_database(),'CONNECT') IS DISTINCT FROM true OR
     has_database_privilege(factor_oid,current_database(),'CREATE') OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=factor_oid) OR
     (SELECT count(*) FROM pg_auth_members WHERE roleid=factor_oid) IS DISTINCT FROM 1 OR
     NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=owner_oid AND roleid=factor_oid AND
       grantor=cloud_admin_oid AND admin_option IS TRUE AND inherit_option IS FALSE AND set_option IS FALSE) OR
     factor_functions IS DISTINCT FROM expected_factor_functions OR
     NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
       WHERE p.oid=to_regprocedure('groundbnb.refuse_production_synthetic_seed()') AND
         p.prorettype='trigger'::regtype AND p.proowner=owner_oid AND p.prosecdef IS FALSE AND
         p.proconfig IS NULL AND l.lanname='plpgsql' AND p.proacl IS NULL AND
         EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
           WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE' AND NOT acl.is_grantable)) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE n.nspname='groundbnb' AND p.oid<>to_regprocedure('groundbnb.refuse_production_synthetic_seed()') AND
         acl.grantee=0 AND acl.privilege_type='EXECUTE') OR
     has_database_privilege(app_oid,current_database(),'CREATE') OR has_schema_privilege(app_oid,'groundbnb','CREATE') OR
     has_schema_privilege(app_oid,'groundbnb','USAGE') IS DISTINCT FROM true OR
     has_schema_privilege(factor_oid,'groundbnb','CREATE') OR has_schema_privilege(factor_oid,'groundbnb','USAGE') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.environment_identity','SELECT') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.schema_migrations','SELECT') IS DISTINCT FROM true OR
     has_table_privilege(app_oid,'groundbnb.environment_identity','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_table_privilege(app_oid,'groundbnb.schema_migrations','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relname NOT IN ('environment_identity','schema_migrations')) OR n.nspname='neon_auth')
         AND c.relkind IN ('r','p','v','m','f','S') AND
         (CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
            has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          ELSE false END OR CASE WHEN c.relkind='S' THEN
            has_sequence_privilege(app_oid,c.oid,'USAGE,SELECT,UPDATE') ELSE false END)) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname IN ('groundbnb','neon_auth') AND c.relkind IN ('r','p','v','m','f','S') AND
         (CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
            has_table_privilege(factor_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          ELSE false END OR CASE WHEN c.relkind='S' THEN
            has_sequence_privilege(factor_oid,c.oid,'USAGE,SELECT,UPDATE') ELSE false END)) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='groundbnb' AND c.relname IN ('environment_identity','schema_migrations') AND
         c.relkind IN ('r','p','v','m','f') AND
         (has_any_column_privilege(app_oid,c.oid,'INSERT') OR has_any_column_privilege(app_oid,c.oid,'UPDATE') OR
          has_any_column_privilege(app_oid,c.oid,'REFERENCES'))) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relname NOT IN ('environment_identity','schema_migrations')) OR n.nspname='neon_auth')
         AND c.relkind IN ('r','p','v','m','f') AND
         (has_any_column_privilege(app_oid,c.oid,'SELECT') OR has_any_column_privilege(app_oid,c.oid,'INSERT') OR
          has_any_column_privilege(app_oid,c.oid,'UPDATE') OR has_any_column_privilege(app_oid,c.oid,'REFERENCES'))) OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname IN ('groundbnb','neon_auth') AND c.relkind IN ('r','p','v','m','f') AND
         (has_any_column_privilege(factor_oid,c.oid,'SELECT') OR has_any_column_privilege(factor_oid,c.oid,'INSERT') OR
          has_any_column_privilege(factor_oid,c.oid,'UPDATE') OR has_any_column_privilege(factor_oid,c.oid,'REFERENCES'))) THEN
    RAISE EXCEPTION 'Pinned app/factor role boundary differs';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='groundbnb' AND p.proname IN
        ('read_factor_challenge_state','record_factor_challenge_attempt','consume_factor_totp_candidate',
         'consume_factor_recovery_candidate','read_factor_operation_receipt')) IS DISTINCT FROM 5 OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname IN
        ('read_factor_challenge_state','record_factor_challenge_attempt','consume_factor_totp_candidate',
         'consume_factor_recovery_candidate','read_factor_operation_receipt') AND
         (p.proowner IS DISTINCT FROM owner_oid OR p.prosecdef IS DISTINCT FROM true OR
          p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
          EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
            WHERE acl.grantee=0 OR acl.grantee<>p.proowner AND acl.grantee<>factor_oid OR
              acl.privilege_type<>'EXECUTE' OR acl.is_grantable))) THEN
    RAISE EXCEPTION 'Existing private 0012 factor-function contract differs';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='groundbnb' AND p.proname IN
        ('read_factor_enrollment_context','read_pending_factor_for_enrollment','begin_factor_enrollment',
         'record_factor_enrollment_attempt','verify_factor_enrollment','read_factor_enrollment_receipt')) IS DISTINCT FROM 6 OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname IN
        ('read_factor_enrollment_context','read_pending_factor_for_enrollment','begin_factor_enrollment',
         'record_factor_enrollment_attempt','verify_factor_enrollment','read_factor_enrollment_receipt') AND
        (p.proowner IS DISTINCT FROM owner_oid OR p.prosecdef IS DISTINCT FROM true OR
         p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
         has_function_privilege(app_oid,p.oid,'EXECUTE') OR has_function_privilege(factor_oid,p.oid,'EXECUTE') OR
         EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
           WHERE acl.grantee=0 OR acl.grantee<>p.proowner OR acl.privilege_type<>'EXECUTE' OR acl.is_grantable))) OR
     EXISTS(SELECT 1 FROM aclexplode(COALESCE((SELECT c.relacl FROM pg_class c
       WHERE c.oid='groundbnb.factor_enrollment_operations'::regclass),acldefault('r',owner_oid))) acl
       WHERE acl.grantee=0 OR acl.grantee<>owner_oid OR acl.is_grantable) OR
     has_table_privilege(app_oid,'groundbnb.factor_enrollment_operations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_table_privilege(factor_oid,'groundbnb.factor_enrollment_operations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_database_privilege(factor_oid,current_database(),'CONNECT') IS DISTINCT FROM true OR
     has_database_privilege(factor_oid,current_database(),'CREATE') THEN
    RAISE EXCEPTION 'Existing enrollment surface or receipt table ACL differs';
  END IF;
END $$;

ALTER TABLE groundbnb.factor_enrollment_operations
  DROP CONSTRAINT factor_enrollment_operations_operation_kind_check,
  DROP CONSTRAINT factor_enrollment_operations_status_check,
  DROP CONSTRAINT factor_enrollment_operations_check1;
ALTER TABLE groundbnb.factor_enrollment_operations
  ADD COLUMN begin_operation_id uuid,
  ADD CONSTRAINT factor_enrollment_operations_begin_operation_fk
    FOREIGN KEY(begin_operation_id) REFERENCES groundbnb.factor_enrollment_operations(operation_id) ON DELETE RESTRICT,
  ADD CONSTRAINT factor_enrollment_operations_resume_begin_check
    CHECK ((operation_kind='resume' AND begin_operation_id IS NOT NULL) OR
           (operation_kind IN ('begin','verify') AND begin_operation_id IS NULL)),
  ADD CONSTRAINT factor_enrollment_operations_operation_begin_key UNIQUE(operation_id,begin_operation_id),
  ADD CONSTRAINT factor_enrollment_operations_operation_kind_check
    CHECK (operation_kind IN ('begin','verify','resume')),
  ADD CONSTRAINT factor_enrollment_operations_status_check
    CHECK (status IN ('pending','rejected','verified','released')),
  ADD CONSTRAINT factor_enrollment_operations_resume_check
    CHECK ((operation_kind='begin' AND status='pending') OR
           (operation_kind='verify' AND status IN ('rejected','verified')) OR
           (operation_kind='resume' AND status IN ('rejected','released')));

ALTER TABLE groundbnb.privileged_factor_audit
  ADD COLUMN resume_operation_id uuid,
  ADD COLUMN begin_operation_id uuid,
  ADD CONSTRAINT privileged_factor_audit_resume_operation_fk
    FOREIGN KEY(resume_operation_id,begin_operation_id)
    REFERENCES groundbnb.factor_enrollment_operations(operation_id,begin_operation_id) ON DELETE RESTRICT,
  ADD CONSTRAINT privileged_factor_audit_resume_operation_check
    CHECK ((resume_operation_id IS NULL AND begin_operation_id IS NULL AND outcome<>'enrollment_material_released') OR
           (resume_operation_id IS NOT NULL AND begin_operation_id IS NOT NULL AND
            outcome IN ('enrollment_material_released','rate_limited')));
ALTER TABLE groundbnb.privileged_factor_audit
  DROP CONSTRAINT privileged_factor_audit_outcome_check,
  ADD CONSTRAINT privileged_factor_audit_outcome_check
    CHECK (outcome IN ('challenge_accepted','challenge_rejected','recovery_consumed',
      'enrollment_started','enrollment_verified','enrollment_material_released','factor_revoked',
      'factor_reset','rate_limited','attestation_revoked'));

CREATE FUNCTION groundbnb.record_factor_enrollment_material_release(
  p_issuer text,p_subject text,p_session_id text,p_session_expires_at timestamptz,
  p_begin_operation_id uuid,p_operation_id uuid,p_expected_account_id uuid,p_expected_factor_id uuid,
  p_expected_security_epoch bigint,p_expected_envelope_key_id text,p_request_fingerprint bytea
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; current_epoch bigint; factor_row record; begin_row record; prior record;
  now_at timestamptz; window_start timestamptz; window_end timestamptz; total_count bigint;
  updated_count integer; limited boolean; fingerprint_text text; outcome_value text; reason_value text;
  receipt_status text; newly_committed boolean:=false;
BEGIN
  fingerprint_text:=CASE WHEN p_request_fingerprint IS NULL THEN NULL ELSE
    translate(rtrim(encode(p_request_fingerprint,'base64'),E'\n='),'+/','-_') END;
  account_uuid:=groundbnb._factor_lock_identity(p_issuer,p_subject,p_session_id,p_session_expires_at,true);
  IF account_uuid IS NULL THEN
    RETURN jsonb_build_object('status','unknown','operationId',p_operation_id,'kind','resume',
      'accountId',p_expected_account_id,'factorId',p_expected_factor_id,'securityEpoch',p_expected_security_epoch,
      'requestFingerprint',fingerprint_text,'beginOperationId',p_begin_operation_id,'newlyCommitted',false);
  END IF;
  IF p_operation_id IS NULL OR p_begin_operation_id IS NULL OR p_request_fingerprint IS NULL OR
     octet_length(p_request_fingerprint) IS DISTINCT FROM 32 OR p_expected_account_id IS DISTINCT FROM account_uuid OR
     p_expected_factor_id IS NULL OR p_expected_security_epoch IS NULL OR p_expected_security_epoch<0 OR
     p_expected_envelope_key_id IS NULL OR p_expected_envelope_key_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' THEN
    RETURN jsonb_build_object('status','rejected','operationId',p_operation_id,'kind','resume',
      'accountId',account_uuid,'factorId',p_expected_factor_id,'securityEpoch',p_expected_security_epoch,
      'requestFingerprint',fingerprint_text,'beginOperationId',p_begin_operation_id,'newlyCommitted',false);
  END IF;
  SELECT security_epoch INTO current_epoch FROM groundbnb.account_security_epochs
    WHERE account_id=account_uuid FOR UPDATE;
  IF NOT FOUND THEN current_epoch:=0; END IF;
  SELECT * INTO factor_row FROM groundbnb.privileged_factor_enrollments f
    WHERE f.account_id=account_uuid AND f.factor_id=p_expected_factor_id FOR UPDATE;
  SELECT * INTO prior FROM groundbnb.factor_enrollment_operations o WHERE o.operation_id=p_operation_id FOR UPDATE;
  IF FOUND THEN
    IF prior.account_id=account_uuid AND prior.identity_issuer=p_issuer AND prior.identity_subject=p_subject AND
       prior.managed_session_id=p_session_id AND prior.operation_kind='resume' AND prior.status IN ('released','rejected') AND
       prior.begin_operation_id=p_begin_operation_id AND prior.request_fingerprint=p_request_fingerprint AND
       prior.factor_id=p_expected_factor_id AND prior.security_epoch=p_expected_security_epoch THEN
      RETURN jsonb_build_object('status',prior.status,'operationId',prior.operation_id,'kind','resume',
        'accountId',prior.account_id,'factorId',prior.factor_id,'securityEpoch',prior.security_epoch,
        'requestFingerprint',fingerprint_text,'beginOperationId',prior.begin_operation_id,'newlyCommitted',false);
    END IF;
    RETURN jsonb_build_object('status','rejected','operationId',p_operation_id,'kind','resume',
      'accountId',account_uuid,'factorId',p_expected_factor_id,'securityEpoch',p_expected_security_epoch,
      'requestFingerprint',fingerprint_text,'beginOperationId',p_begin_operation_id,'newlyCommitted',false);
  END IF;
  SELECT * INTO begin_row FROM groundbnb.factor_enrollment_operations o
    WHERE o.operation_id=p_begin_operation_id AND o.account_id=account_uuid AND
      o.identity_issuer=p_issuer AND o.identity_subject=p_subject AND o.managed_session_id=p_session_id AND
      o.operation_kind='begin' AND o.status='pending' AND o.factor_id=p_expected_factor_id AND
      o.security_epoch=p_expected_security_epoch;
  IF current_epoch IS DISTINCT FROM p_expected_security_epoch OR NOT FOUND OR
     factor_row.account_id IS DISTINCT FROM account_uuid OR factor_row.security_epoch IS DISTINCT FROM current_epoch OR
     factor_row.state IS DISTINCT FROM 'pending' OR factor_row.envelope_key_id IS DISTINCT FROM p_expected_envelope_key_id OR
     factor_row.encrypted_secret->>'keyId' IS DISTINCT FROM p_expected_envelope_key_id OR
     begin_row.operation_id IS DISTINCT FROM p_begin_operation_id OR p_session_expires_at<=clock_timestamp() THEN
    RETURN jsonb_build_object('status','rejected','operationId',p_operation_id,'kind','resume',
      'accountId',account_uuid,'factorId',p_expected_factor_id,'securityEpoch',p_expected_security_epoch,
      'requestFingerprint',fingerprint_text,'beginOperationId',p_begin_operation_id,'newlyCommitted',false);
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
  SELECT COALESCE(sum(w.attempt_count),0),
    COALESCE(bool_or(w.blocked_until>now_at),false)
    INTO total_count,limited FROM groundbnb.factor_attempt_windows w
    WHERE w.account_id=account_uuid AND w.bucket_fingerprint=groundbnb._factor_bucket_fingerprint()
      AND w.window_started_at=window_start;
  limited:=limited OR total_count>=5;
  IF limited THEN
    UPDATE groundbnb.factor_attempt_windows SET blocked_until=GREATEST(COALESCE(blocked_until,window_end),window_end),
      updated_at=GREATEST(clock_timestamp(),updated_at+interval '1 microsecond')
      WHERE account_id=account_uuid AND identity_issuer=p_issuer AND identity_subject=p_subject AND
        bucket_fingerprint=groundbnb._factor_bucket_fingerprint() AND window_started_at=window_start;
    outcome_value:='rate_limited'; reason_value:='throttled'; receipt_status:='rejected';
  ELSE
    outcome_value:='enrollment_material_released'; reason_value:='accepted'; receipt_status:='released';
    newly_committed:=true;
  END IF;
  INSERT INTO groundbnb.factor_enrollment_operations(operation_id,account_id,identity_issuer,identity_subject,
      managed_session_id,operation_kind,request_fingerprint,factor_id,security_epoch,status,
      created_at,completed_at,begin_operation_id)
    VALUES(p_operation_id,account_uuid,p_issuer,p_subject,p_session_id,'resume',p_request_fingerprint,
      p_expected_factor_id,p_expected_security_epoch,receipt_status,now_at,clock_timestamp(),p_begin_operation_id);
  INSERT INTO groundbnb.privileged_factor_audit(account_id,actor_account_id,factor_id,security_epoch,
      identity_issuer,identity_subject,outcome,reason,occurred_at,resume_operation_id,begin_operation_id)
    VALUES(account_uuid,account_uuid,p_expected_factor_id,p_expected_security_epoch,p_issuer,p_subject,
      outcome_value,reason_value,clock_timestamp(),p_operation_id,p_begin_operation_id);
  IF p_session_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Factor enrollment session expired'; END IF;
  RETURN jsonb_build_object('status',receipt_status,'operationId',p_operation_id,'kind','resume',
    'accountId',account_uuid,'factorId',p_expected_factor_id,'securityEpoch',p_expected_security_epoch,
    'requestFingerprint',fingerprint_text,'beginOperationId',p_begin_operation_id,'newlyCommitted',newly_committed);
END $$;
REVOKE ALL ON FUNCTION groundbnb.record_factor_enrollment_material_release(text,text,text,timestamptz,uuid,uuid,uuid,uuid,bigint,text,bytea) FROM PUBLIC;

CREATE FUNCTION groundbnb.read_factor_enrollment_material_receipt(
  p_issuer text,p_subject text,p_session_id text,p_session_expires_at timestamptz,
  p_operation_id uuid,p_expected_account_id uuid,p_expected_factor_id uuid,
  p_expected_security_epoch bigint,p_expected_begin_operation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; receipt record;
BEGIN
  account_uuid:=groundbnb._factor_lock_identity(p_issuer,p_subject,p_session_id,p_session_expires_at,false);
  IF account_uuid IS NULL OR p_session_expires_at<=clock_timestamp() THEN
    RAISE EXCEPTION 'Factor enrollment receipt unavailable';
  END IF;
  IF p_operation_id IS NULL OR p_expected_account_id IS DISTINCT FROM account_uuid OR
     p_expected_begin_operation_id IS NULL THEN
    RETURN jsonb_build_object('status','not_found','operationId',p_operation_id,'kind','resume',
      'accountId',account_uuid,'issuer',p_issuer,'subject',p_subject,'sessionId',p_session_id,
      'factorId',NULL,'securityEpoch',NULL,'beginOperationId',p_expected_begin_operation_id,'requestFingerprint',NULL);
  END IF;
  SELECT * INTO receipt FROM groundbnb.factor_enrollment_operations o
    WHERE o.operation_id=p_operation_id AND o.account_id=account_uuid AND
      o.identity_issuer=p_issuer AND o.identity_subject=p_subject AND o.managed_session_id=p_session_id AND
      o.operation_kind='resume' AND o.begin_operation_id=p_expected_begin_operation_id;
  IF p_session_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Factor enrollment receipt unavailable'; END IF;
  IF NOT FOUND OR receipt.factor_id IS DISTINCT FROM p_expected_factor_id OR
     receipt.security_epoch IS DISTINCT FROM p_expected_security_epoch THEN
    RETURN jsonb_build_object('status','not_found','operationId',p_operation_id,'kind','resume',
      'accountId',account_uuid,'issuer',p_issuer,'subject',p_subject,'sessionId',p_session_id,
      'factorId',NULL,'securityEpoch',NULL,'beginOperationId',p_expected_begin_operation_id,'requestFingerprint',NULL);
  END IF;
  RETURN jsonb_build_object('status',receipt.status,'operationId',receipt.operation_id,'kind','resume',
    'accountId',receipt.account_id,'issuer',receipt.identity_issuer,'subject',receipt.identity_subject,
    'sessionId',receipt.managed_session_id,'factorId',receipt.factor_id,'securityEpoch',receipt.security_epoch,
    'beginOperationId',receipt.begin_operation_id,
    'requestFingerprint',translate(rtrim(encode(receipt.request_fingerprint,'base64'),E'\n='),'+/','-_'));
END $$;
REVOKE ALL ON FUNCTION groundbnb.read_factor_enrollment_material_receipt(text,text,text,timestamptz,uuid,uuid,uuid,bigint,uuid) FROM PUBLIC;

DO $$
DECLARE app_role text; factor_role text; owner_oid oid; app_oid oid; factor_oid oid;
BEGIN
  SELECT CASE WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
      WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END,
    CASE WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_factor_service'
      WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_factor_service' END
    INTO app_role,factor_role FROM groundbnb.environment_identity e WHERE singleton;
  SELECT oid INTO STRICT owner_oid FROM pg_roles WHERE rolname='neondb_owner';
  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  SELECT oid INTO STRICT factor_oid FROM pg_roles WHERE rolname=factor_role;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='groundbnb' AND p.proname IN
       ('read_factor_enrollment_context','read_pending_factor_for_enrollment','begin_factor_enrollment',
        'record_factor_enrollment_attempt','verify_factor_enrollment','read_factor_enrollment_receipt',
        'record_factor_enrollment_material_release','read_factor_enrollment_material_receipt')) IS DISTINCT FROM 8 OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='groundbnb' AND p.proname IN
        ('read_factor_enrollment_context','read_pending_factor_for_enrollment','begin_factor_enrollment',
         'record_factor_enrollment_attempt','verify_factor_enrollment','read_factor_enrollment_receipt',
         'record_factor_enrollment_material_release','read_factor_enrollment_material_receipt') AND
        (p.proowner IS DISTINCT FROM owner_oid OR p.prosecdef IS DISTINCT FROM true OR
         p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
         has_function_privilege(app_oid,p.oid,'EXECUTE') OR has_function_privilege(factor_oid,p.oid,'EXECUTE') OR
         EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
           WHERE acl.grantee=0 OR acl.grantee<>p.proowner OR acl.privilege_type<>'EXECUTE' OR acl.is_grantable))) OR
     has_table_privilege(app_oid,'groundbnb.factor_enrollment_operations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_table_privilege(factor_oid,'groundbnb.factor_enrollment_operations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
    RAISE EXCEPTION 'Enrollment resume functions or table must remain private and dormant';
  END IF;
END $$;

INSERT INTO groundbnb.schema_migrations(version) VALUES('0015_factor_enrollment_resume');
COMMIT;
