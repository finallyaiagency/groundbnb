-- M1-01S dormant factor recovery-source and privileged activity context.
-- No writers, app grants, MFA activation, or customer identity changes are added.
BEGIN;
DO $$
DECLARE e record; app_role text; role_record record;
BEGIN
  IF current_database()<>'groundbnb' THEN RAISE EXCEPTION 'Expected groundbnb database'; END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  IF app_role IS NULL OR
     (SELECT count(*) FROM groundbnb.schema_migrations)<>9 OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0003_profile_domain') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0004_profile_operation_status') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0005_profile_records') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0006_profile_transfer') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0007_membership_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0008_provider_reservations') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0009_privileged_factors') OR
     EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0010_factor_recovery_activity') THEN
    RAISE EXCEPTION 'Requires pinned local/preview with exact 0001-0009 baseline and no prior 0010';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user")<>1 OR NOT EXISTS(
      SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic Auth fixture';
  END IF;
  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=app_role;
  IF NOT role_record.rolcanlogin OR role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole OR
     role_record.rolreplication OR role_record.rolbypassrls OR role_record.rolinherit OR role_record.rolconnlimit<>4 OR
     NOT (role_record.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) OR
     EXISTS(SELECT 1 FROM pg_auth_members WHERE member=role_record.oid) OR
     has_database_privilege(role_record.oid,current_database(),'CREATE') OR has_schema_privilege(role_record.oid,'groundbnb','CREATE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.read_profile(text,text)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile(text,text,uuid,bigint,jsonb)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.read_profile_operation(text,text,uuid)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m') AND c.relname NOT IN ('environment_identity','schema_migrations'))
           OR n.nspname='neon_auth')
         AND has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
    RAISE EXCEPTION 'Pinned app-role or function-only ACL baseline differs from approved boundary';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.privileged_factor_attestations WHERE accepted_step IS NULL) THEN
    RAISE EXCEPTION 'Existing factor attestations do not match the 0009 TOTP-only baseline';
  END IF;
END $$;

-- The pending-only guard function existed in 0009 but its trigger omitted INSERT.
DROP TRIGGER factor_enrollment_history_guard ON groundbnb.privileged_factor_enrollments;
CREATE TRIGGER factor_enrollment_history_guard BEFORE INSERT OR UPDATE OR DELETE
  ON groundbnb.privileged_factor_enrollments
  FOR EACH ROW EXECUTE FUNCTION groundbnb._guard_factor_enrollment_history();

-- Existing rows are TOTP attestations. Recovery attestations bind one consumed
-- recovery row instead of manufacturing a TOTP step.
ALTER TABLE groundbnb.privileged_factor_attestations
  ADD COLUMN challenge_method text NOT NULL DEFAULT 'totp',
  ADD COLUMN recovery_id uuid;
ALTER TABLE groundbnb.privileged_factor_attestations ALTER COLUMN challenge_method DROP DEFAULT;
ALTER TABLE groundbnb.privileged_factor_attestations ALTER COLUMN accepted_step DROP NOT NULL;
ALTER TABLE groundbnb.privileged_factor_attestations
  ADD CONSTRAINT factor_attestation_challenge_method_check
    CHECK (challenge_method IN ('totp','recovery')),
  ADD CONSTRAINT factor_attestation_source_exclusive_check CHECK (
    (challenge_method='totp' AND accepted_step IS NOT NULL AND recovery_id IS NULL) OR
    (challenge_method='recovery' AND accepted_step IS NULL AND recovery_id IS NOT NULL)),
  ADD CONSTRAINT factor_attestation_recovery_source_fk
    FOREIGN KEY(recovery_id,account_id,factor_id,security_epoch)
    REFERENCES groundbnb.privileged_recovery_records(recovery_id,account_id,factor_id,security_epoch) ON DELETE RESTRICT,
  ADD CONSTRAINT factor_attestation_recovery_one_use UNIQUE(recovery_id),
  ADD CONSTRAINT factor_attestation_activity_binding_unique
    UNIQUE(attestation_id,account_id,identity_issuer,identity_subject,managed_session_id,security_epoch);

CREATE FUNCTION groundbnb._guard_factor_attestation_method()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Factor attestation history is retained'; END IF;
  IF ROW(NEW.challenge_method,NEW.recovery_id) IS DISTINCT FROM ROW(OLD.challenge_method,OLD.recovery_id) THEN
    RAISE EXCEPTION 'Factor challenge source is immutable after issuance';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER factor_attestation_method_immutable BEFORE UPDATE OR DELETE
  ON groundbnb.privileged_factor_attestations
  FOR EACH ROW EXECUTE FUNCTION groundbnb._guard_factor_attestation_method();

CREATE FUNCTION groundbnb._validate_factor_attestation_source()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
DECLARE current_epoch bigint; factor_state text; source_verified_at timestamptz;
BEGIN
  SELECT security_epoch INTO current_epoch FROM groundbnb.account_security_epochs WHERE account_id=NEW.account_id;
  SELECT state INTO factor_state FROM groundbnb.privileged_factor_enrollments
    WHERE factor_id=NEW.factor_id AND account_id=NEW.account_id AND security_epoch=NEW.security_epoch;
  IF current_epoch IS NULL OR current_epoch<>NEW.security_epoch OR factor_state IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'Factor attestation requires a verified factor at the current account epoch';
  END IF;
  IF NEW.challenge_method='totp' THEN
    SELECT accepted_at INTO source_verified_at FROM groundbnb.accepted_factor_steps
      WHERE account_id=NEW.account_id AND factor_id=NEW.factor_id
        AND security_epoch=NEW.security_epoch AND accepted_step=NEW.accepted_step;
  ELSE
    SELECT consumed_at INTO source_verified_at FROM groundbnb.privileged_recovery_records
      WHERE recovery_id=NEW.recovery_id AND account_id=NEW.account_id
        AND factor_id=NEW.factor_id AND security_epoch=NEW.security_epoch;
    IF source_verified_at IS NULL OR source_verified_at>NEW.issued_at THEN
      RAISE EXCEPTION 'Recovery attestation requires its consumed owner/factor/epoch source';
    END IF;
  END IF;
  IF source_verified_at IS NULL OR source_verified_at IS DISTINCT FROM NEW.factor_verified_at OR
      NEW.factor_verified_at>NEW.issued_at THEN
    RAISE EXCEPTION 'Factor attestation time must equal its accepted challenge source';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER factor_attestation_source_valid
  AFTER INSERT ON groundbnb.privileged_factor_attestations DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION groundbnb._validate_factor_attestation_source();

CREATE TABLE groundbnb.privileged_session_activity (
  account_id uuid NOT NULL,
  identity_issuer text NOT NULL CHECK (length(identity_issuer) BETWEEN 1 AND 500),
  identity_subject text NOT NULL CHECK (length(identity_subject) BETWEEN 1 AND 200),
  managed_session_id text NOT NULL CHECK (length(managed_session_id) BETWEEN 1 AND 200),
  security_epoch bigint NOT NULL CHECK (security_epoch>=0),
  attestation_id uuid NOT NULL,
  last_activity_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(account_id,identity_issuer,identity_subject,managed_session_id,security_epoch),
  FOREIGN KEY(attestation_id,account_id,identity_issuer,identity_subject,managed_session_id,security_epoch)
    REFERENCES groundbnb.privileged_factor_attestations(attestation_id,account_id,identity_issuer,
      identity_subject,managed_session_id,security_epoch) ON DELETE RESTRICT,
  CHECK (isfinite(last_activity_at) AND isfinite(updated_at))
);
COMMENT ON TABLE groundbnb.privileged_session_activity IS
  'Restricted server context only. Missing activity denies privileged access; activity never refreshes challenge or step-up time.';
CREATE INDEX privileged_session_activity_attestation_idx
  ON groundbnb.privileged_session_activity(attestation_id);

CREATE FUNCTION groundbnb._guard_privileged_session_activity()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
DECLARE observed_now timestamptz:=clock_timestamp(); attestation_row record;
  current_epoch bigint; factor_state text;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Privileged session activity history is retained'; END IF;
  IF TG_OP='UPDATE' AND (ROW(NEW.account_id,NEW.identity_issuer,NEW.identity_subject,
      NEW.managed_session_id,NEW.security_epoch) IS DISTINCT FROM
      ROW(OLD.account_id,OLD.identity_issuer,OLD.identity_subject,OLD.managed_session_id,OLD.security_epoch) OR
      NEW.last_activity_at<=OLD.last_activity_at OR NEW.updated_at<=OLD.updated_at OR
      (OLD.last_activity_at<=observed_now-interval '30 minutes' AND NEW.attestation_id=OLD.attestation_id)) THEN
    RAISE EXCEPTION 'Privileged activity must advance within the existing non-idle session';
  END IF;
  IF NEW.last_activity_at>observed_now OR NEW.updated_at>observed_now THEN
    RAISE EXCEPTION 'Privileged activity timestamps cannot be future-dated';
  END IF;
  SELECT * INTO attestation_row FROM groundbnb.privileged_factor_attestations a
    WHERE a.attestation_id=NEW.attestation_id AND a.account_id=NEW.account_id
      AND a.identity_issuer=NEW.identity_issuer AND a.identity_subject=NEW.identity_subject
      AND a.managed_session_id=NEW.managed_session_id AND a.security_epoch=NEW.security_epoch
      AND a.revoked_at IS NULL;
  IF NOT FOUND OR attestation_row.issued_at>observed_now OR attestation_row.expires_at<=observed_now OR
      attestation_row.factor_verified_at<observed_now-interval '12 hours' OR
      NEW.last_activity_at<attestation_row.issued_at OR NEW.last_activity_at>attestation_row.expires_at OR
      NEW.last_activity_at>attestation_row.factor_verified_at+interval '12 hours' THEN
    RAISE EXCEPTION 'Privileged activity requires a current unrevoked challenge';
  END IF;
  IF TG_OP='UPDATE' AND NEW.attestation_id IS DISTINCT FROM OLD.attestation_id AND
      (attestation_row.issued_at<OLD.last_activity_at OR
       observed_now>=attestation_row.issued_at+interval '30 minutes') THEN
    RAISE EXCEPTION 'Expired idle session requires a fresh challenge before activity resumes';
  END IF;
  IF TG_OP='INSERT' AND (observed_now>=attestation_row.issued_at+interval '30 minutes' OR
      NEW.last_activity_at>attestation_row.issued_at+interval '30 minutes') THEN
    RAISE EXCEPTION 'Initial privileged activity cannot start an expired idle session';
  END IF;
  SELECT security_epoch INTO current_epoch FROM groundbnb.account_security_epochs WHERE account_id=NEW.account_id;
  SELECT state INTO factor_state FROM groundbnb.privileged_factor_enrollments
    WHERE factor_id=attestation_row.factor_id AND account_id=NEW.account_id
      AND security_epoch=NEW.security_epoch;
  IF current_epoch IS NULL OR current_epoch<>NEW.security_epoch OR factor_state IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'Privileged activity requires a current verified factor epoch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER privileged_session_activity_guard BEFORE INSERT OR UPDATE OR DELETE
  ON groundbnb.privileged_session_activity
  FOR EACH ROW EXECUTE FUNCTION groundbnb._guard_privileged_session_activity();

ALTER TABLE groundbnb.privileged_session_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON groundbnb.privileged_session_activity FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._guard_factor_attestation_method() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._validate_factor_attestation_source() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._guard_privileged_session_activity() FROM PUBLIC;

DO $$
DECLARE e record; app_role text; app_oid oid;
BEGIN
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE WHEN e.kind='local' THEN 'groundbnb_local_app' ELSE 'groundbnb_preview_app' END;
  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  IF has_table_privilege(app_oid,'groundbnb.privileged_session_activity','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_function_privilege(app_oid,'groundbnb._guard_factor_attestation_method()','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._validate_factor_attestation_source()','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._guard_privileged_session_activity()','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE n.nspname='groundbnb' AND p.proname IN ('_guard_factor_attestation_method',
         '_validate_factor_attestation_source','_guard_privileged_session_activity')
         AND (acl.grantee=0 OR acl.grantee=app_oid) AND acl.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'Privileged activity table or source guards must remain private';
  END IF;
END $$;
INSERT INTO groundbnb.schema_migrations(version) VALUES('0010_factor_recovery_activity');
COMMIT;
