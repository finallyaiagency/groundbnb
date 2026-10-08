-- M1-01P dormant privileged-factor records. Schema only; no verifier, writer, or grant.
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
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0003_profile_domain') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0004_profile_operation_status') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0005_profile_records') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0006_profile_transfer') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0007_membership_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0008_provider_reservations') OR
     EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0009_privileged_factors') THEN
    RAISE EXCEPTION 'Requires pinned local/preview with exact 0001-0008 baseline and no prior 0009';
  END IF;
  IF (SELECT count(*) FROM neon_auth."user")<>1 OR NOT EXISTS(SELECT 1 FROM neon_auth."user"
      WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires the sole verified synthetic fixture';
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
    RAISE EXCEPTION 'Pinned application role/function-only ACL baseline differs from approved M1 boundary';
  END IF;
END $$;

-- The composite key lets persisted attestations bind the exact identity to its account.
CREATE UNIQUE INDEX account_identity_owner_binding_idx
  ON groundbnb.account_identities(issuer,subject,account_id);

CREATE TABLE groundbnb.account_security_epochs (
  account_id uuid PRIMARY KEY REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  security_epoch bigint NOT NULL DEFAULT 0 CHECK (security_epoch>=0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  CHECK (isfinite(updated_at))
);

CREATE TABLE groundbnb.security_epoch_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  previous_epoch bigint NOT NULL CHECK (previous_epoch>=0),
  new_epoch bigint NOT NULL CHECK (new_epoch=previous_epoch+1),
  actor_account_id uuid REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (reason IN ('factor_enrollment','factor_revocation','factor_reset','account_recovery','administrative_recovery')),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(account_id,new_epoch),
  CHECK (isfinite(occurred_at))
);

CREATE TABLE groundbnb.privileged_factor_enrollments (
  factor_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  security_epoch bigint NOT NULL CHECK (security_epoch>=0),
  state text NOT NULL CHECK (state IN ('pending','verified','revoked')),
  envelope_key_id text NOT NULL CHECK (envelope_key_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  encrypted_secret jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  verified_at timestamptz,
  revoked_at timestamptz,
  UNIQUE(factor_id,account_id),
  UNIQUE(factor_id,account_id,security_epoch),
  CHECK (isfinite(created_at) AND (verified_at IS NULL OR isfinite(verified_at)) AND
    (revoked_at IS NULL OR isfinite(revoked_at))),
  CHECK (verified_at IS NULL OR verified_at>=created_at),
  CHECK ((state='pending' AND verified_at IS NULL AND revoked_at IS NULL) OR
    (state='verified' AND verified_at IS NOT NULL AND revoked_at IS NULL) OR
    (state='revoked' AND revoked_at IS NOT NULL AND revoked_at>=created_at AND
      (verified_at IS NULL OR revoked_at>=verified_at))),
  CHECK (jsonb_typeof(encrypted_secret)='object' AND jsonb_object_length(encrypted_secret)=5 AND
    encrypted_secret ?& ARRAY['version','keyId','nonce','ciphertext','tag'] AND
    encrypted_secret->'version'='1'::jsonb AND encrypted_secret->>'keyId'=envelope_key_id AND
    encrypted_secret->>'keyId' ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' AND
    encrypted_secret->>'nonce' ~ '^[A-Za-z0-9_-]{16}$' AND
    encrypted_secret->>'ciphertext' ~ '^[A-Za-z0-9_-]{43,138}$' AND
    encrypted_secret->>'tag' ~ '^[A-Za-z0-9_-]{22}$')
);
CREATE UNIQUE INDEX privileged_factor_one_live_per_epoch_idx
  ON groundbnb.privileged_factor_enrollments(account_id,security_epoch)
  WHERE state IN ('pending','verified');

CREATE TABLE groundbnb.privileged_recovery_records (
  recovery_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  factor_id uuid NOT NULL,
  security_epoch bigint NOT NULL CHECK (security_epoch>=0),
  digest_version smallint NOT NULL CHECK (digest_version=1),
  salt bytea NOT NULL CHECK (octet_length(salt)=16),
  recovery_digest bytea NOT NULL CHECK (octet_length(recovery_digest)=32),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  consumed_at timestamptz,
  FOREIGN KEY(factor_id,account_id,security_epoch)
    REFERENCES groundbnb.privileged_factor_enrollments(factor_id,account_id,security_epoch) ON DELETE RESTRICT,
  UNIQUE(recovery_id,account_id,factor_id,security_epoch),
  CHECK (isfinite(created_at) AND (consumed_at IS NULL OR isfinite(consumed_at)))
);
CREATE INDEX privileged_recovery_owner_factor_idx
  ON groundbnb.privileged_recovery_records(account_id,factor_id,security_epoch)
  WHERE consumed_at IS NULL;

CREATE TABLE groundbnb.accepted_factor_steps (
  account_id uuid NOT NULL,
  factor_id uuid NOT NULL,
  security_epoch bigint NOT NULL CHECK (security_epoch>=0),
  accepted_step bigint NOT NULL CHECK (accepted_step>=0),
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(account_id,factor_id,security_epoch,accepted_step),
  FOREIGN KEY(factor_id,account_id,security_epoch)
    REFERENCES groundbnb.privileged_factor_enrollments(factor_id,account_id,security_epoch) ON DELETE RESTRICT,
  CHECK (isfinite(accepted_at))
);

CREATE TABLE groundbnb.privileged_factor_attestations (
  attestation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  factor_id uuid NOT NULL,
  security_epoch bigint NOT NULL CHECK (security_epoch>=0),
  accepted_step bigint NOT NULL CHECK (accepted_step>=0),
  identity_issuer text NOT NULL CHECK (length(identity_issuer) BETWEEN 1 AND 500),
  identity_subject text NOT NULL CHECK (length(identity_subject) BETWEEN 1 AND 200),
  managed_session_id text NOT NULL CHECK (length(managed_session_id) BETWEEN 1 AND 200),
  factor_verified_at timestamptz NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  UNIQUE(account_id,factor_id,security_epoch,accepted_step),
  FOREIGN KEY(identity_issuer,identity_subject,account_id)
    REFERENCES groundbnb.account_identities(issuer,subject,account_id) ON DELETE RESTRICT,
  FOREIGN KEY(account_id,factor_id,security_epoch,accepted_step)
    REFERENCES groundbnb.accepted_factor_steps(account_id,factor_id,security_epoch,accepted_step) ON DELETE RESTRICT,
  CHECK (isfinite(factor_verified_at) AND isfinite(issued_at) AND isfinite(expires_at) AND
    (revoked_at IS NULL OR isfinite(revoked_at)) AND expires_at>issued_at AND factor_verified_at<=issued_at)
);
CREATE INDEX privileged_factor_attestation_owner_expiry_idx
  ON groundbnb.privileged_factor_attestations(account_id,security_epoch,expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE groundbnb.factor_attempt_windows (
  account_id uuid NOT NULL REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  identity_issuer text NOT NULL CHECK (length(identity_issuer) BETWEEN 1 AND 500),
  identity_subject text NOT NULL CHECK (length(identity_subject) BETWEEN 1 AND 200),
  bucket_fingerprint bytea NOT NULL CHECK (octet_length(bucket_fingerprint)=32),
  window_started_at timestamptz NOT NULL,
  window_ends_at timestamptz NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count>=0),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(account_id,identity_issuer,identity_subject,bucket_fingerprint,window_started_at),
  CHECK (isfinite(window_started_at) AND isfinite(window_ends_at) AND window_ends_at>window_started_at AND
    isfinite(updated_at) AND (blocked_until IS NULL OR isfinite(blocked_until)))
);

CREATE TABLE groundbnb.privileged_factor_audit (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  actor_account_id uuid REFERENCES groundbnb.accounts(id) ON DELETE RESTRICT,
  factor_id uuid,
  security_epoch bigint NOT NULL CHECK (security_epoch>=0),
  identity_issuer text CHECK (identity_issuer IS NULL OR length(identity_issuer) BETWEEN 1 AND 500),
  identity_subject text CHECK (identity_subject IS NULL OR length(identity_subject) BETWEEN 1 AND 200),
  outcome text NOT NULL CHECK (outcome IN ('challenge_accepted','challenge_rejected','recovery_consumed',
    'enrollment_started','enrollment_verified','factor_revoked','factor_reset','rate_limited','attestation_revoked')),
  reason text NOT NULL CHECK (reason IN ('accepted','invalid','replay','expired','unavailable','throttled',
    'epoch_changed','owner_recovery','administrative_action')),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(factor_id,account_id)
    REFERENCES groundbnb.privileged_factor_enrollments(factor_id,account_id) ON DELETE RESTRICT,
  CHECK (isfinite(occurred_at))
);
CREATE INDEX privileged_factor_audit_owner_time_idx
  ON groundbnb.privileged_factor_audit(account_id,occurred_at DESC);

CREATE FUNCTION groundbnb._guard_security_epoch()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Account security epoch history is retained'; END IF;
  IF TG_OP='INSERT' AND NEW.security_epoch<>0 THEN RAISE EXCEPTION 'Initial security epoch must be zero'; END IF;
  IF TG_OP='UPDATE' AND (NEW.account_id<>OLD.account_id OR NEW.security_epoch<>OLD.security_epoch+1 OR
      NEW.updated_at<=OLD.updated_at OR NOT isfinite(NEW.updated_at)) THEN
    RAISE EXCEPTION 'Security epoch changes must be monotonic and account-bound';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER account_security_epoch_guard BEFORE INSERT OR UPDATE OR DELETE ON groundbnb.account_security_epochs
  FOR EACH ROW EXECUTE FUNCTION groundbnb._guard_security_epoch();

CREATE FUNCTION groundbnb._guard_factor_enrollment_history()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Factor enrollment history is retained'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'pending' THEN RAISE EXCEPTION 'Factor enrollment must begin pending'; END IF;
    RETURN NEW;
  END IF;
  IF ROW(NEW.factor_id,NEW.account_id,NEW.security_epoch,NEW.envelope_key_id,NEW.encrypted_secret,NEW.created_at)
      IS DISTINCT FROM ROW(OLD.factor_id,OLD.account_id,OLD.security_epoch,OLD.envelope_key_id,OLD.encrypted_secret,OLD.created_at) THEN
    RAISE EXCEPTION 'Factor identity and encrypted enrollment are immutable';
  END IF;
  IF OLD.state='revoked' OR NEW.state NOT IN ('verified','revoked') OR
      (OLD.state='verified' AND NEW.state<>'revoked') OR
      (OLD.verified_at IS NOT NULL AND NEW.verified_at IS DISTINCT FROM OLD.verified_at) OR
      (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
    RAISE EXCEPTION 'Factor enrollment state cannot be restored or rewritten';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER factor_enrollment_history_guard BEFORE UPDATE OR DELETE ON groundbnb.privileged_factor_enrollments
  FOR EACH ROW EXECUTE FUNCTION groundbnb._guard_factor_enrollment_history();

CREATE FUNCTION groundbnb._guard_recovery_consumption()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Recovery record history is retained'; END IF;
  IF ROW(NEW.recovery_id,NEW.account_id,NEW.factor_id,NEW.security_epoch,NEW.digest_version,NEW.salt,
      NEW.recovery_digest,NEW.created_at) IS DISTINCT FROM
     ROW(OLD.recovery_id,OLD.account_id,OLD.factor_id,OLD.security_epoch,OLD.digest_version,OLD.salt,
      OLD.recovery_digest,OLD.created_at) OR OLD.consumed_at IS NOT NULL OR NEW.consumed_at IS NULL THEN
    RAISE EXCEPTION 'Recovery records may be consumed once and cannot be rewritten';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER recovery_consumption_guard BEFORE UPDATE OR DELETE ON groundbnb.privileged_recovery_records
  FOR EACH ROW EXECUTE FUNCTION groundbnb._guard_recovery_consumption();

CREATE FUNCTION groundbnb._guard_accepted_factor_step()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Accepted factor steps are immutable';
END $$;
CREATE TRIGGER accepted_factor_step_immutable BEFORE UPDATE OR DELETE ON groundbnb.accepted_factor_steps
  FOR EACH ROW EXECUTE FUNCTION groundbnb._guard_accepted_factor_step();

CREATE FUNCTION groundbnb._guard_factor_attestation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Factor attestation history is retained'; END IF;
  IF ROW(NEW.attestation_id,NEW.account_id,NEW.factor_id,NEW.security_epoch,NEW.accepted_step,
      NEW.identity_issuer,NEW.identity_subject,NEW.managed_session_id,NEW.factor_verified_at,NEW.issued_at,NEW.expires_at)
      IS DISTINCT FROM ROW(OLD.attestation_id,OLD.account_id,OLD.factor_id,OLD.security_epoch,OLD.accepted_step,
      OLD.identity_issuer,OLD.identity_subject,OLD.managed_session_id,OLD.factor_verified_at,OLD.issued_at,OLD.expires_at) OR
      OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
    RAISE EXCEPTION 'Factor attestations may only be revoked once';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER factor_attestation_history_guard BEFORE UPDATE OR DELETE ON groundbnb.privileged_factor_attestations
  FOR EACH ROW EXECUTE FUNCTION groundbnb._guard_factor_attestation();

CREATE FUNCTION groundbnb._guard_factor_attempt_window()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Factor attempt history is retained'; END IF;
  IF ROW(NEW.account_id,NEW.identity_issuer,NEW.identity_subject,NEW.bucket_fingerprint,
      NEW.window_started_at,NEW.window_ends_at) IS DISTINCT FROM ROW(OLD.account_id,OLD.identity_issuer,
      OLD.identity_subject,OLD.bucket_fingerprint,OLD.window_started_at,OLD.window_ends_at) OR
      NEW.attempt_count<OLD.attempt_count OR NEW.updated_at<=OLD.updated_at OR
      (OLD.blocked_until IS NOT NULL AND (NEW.blocked_until IS NULL OR NEW.blocked_until<OLD.blocked_until)) THEN
    RAISE EXCEPTION 'Factor rate-limit state cannot be reset or shortened';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER factor_attempt_window_guard BEFORE UPDATE OR DELETE ON groundbnb.factor_attempt_windows
  FOR EACH ROW EXECUTE FUNCTION groundbnb._guard_factor_attempt_window();

CREATE FUNCTION groundbnb._privileged_factor_audit_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Privileged factor audit history is append-only';
END $$;
CREATE TRIGGER privileged_factor_audit_append_only BEFORE UPDATE OR DELETE ON groundbnb.privileged_factor_audit
  FOR EACH ROW EXECUTE FUNCTION groundbnb._privileged_factor_audit_append_only();
CREATE TRIGGER security_epoch_events_append_only BEFORE UPDATE OR DELETE ON groundbnb.security_epoch_events
  FOR EACH ROW EXECUTE FUNCTION groundbnb._privileged_factor_audit_append_only();

-- Epoch changes and factor revocations must have a corresponding immutable event
-- in the same transaction. A stale factor can be revoked after a prior reset:
-- its old epoch must remain strictly behind the current epoch.
CREATE FUNCTION groundbnb._require_factor_epoch_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
DECLARE current_epoch bigint;
BEGIN
  IF TG_TABLE_NAME='account_security_epochs' AND TG_OP='UPDATE' THEN
    IF NOT EXISTS(SELECT 1 FROM groundbnb.security_epoch_events e
        WHERE e.account_id=NEW.account_id AND e.previous_epoch=OLD.security_epoch
          AND e.new_epoch=NEW.security_epoch) THEN
      RAISE EXCEPTION 'Security epoch increment requires its append-only event';
    END IF;
  ELSIF TG_TABLE_NAME='security_epoch_events' AND TG_OP='INSERT' THEN
    SELECT security_epoch INTO current_epoch FROM groundbnb.account_security_epochs
      WHERE account_id=NEW.account_id;
    IF current_epoch IS NULL OR current_epoch<>NEW.new_epoch OR
        NEW.new_epoch<>NEW.previous_epoch+1 THEN
      RAISE EXCEPTION 'Security epoch event must match the current account epoch';
    END IF;
  ELSIF TG_TABLE_NAME='privileged_factor_enrollments' THEN
    SELECT security_epoch INTO current_epoch FROM groundbnb.account_security_epochs
      WHERE account_id=NEW.account_id;
    IF TG_OP='INSERT' OR NEW.state<>'revoked' THEN
      IF current_epoch IS NULL OR current_epoch<>NEW.security_epoch THEN
        RAISE EXCEPTION 'Active factor enrollment must use the current account epoch';
      END IF;
    ELSIF OLD.state<>'revoked' AND NEW.state='revoked' THEN
      IF current_epoch IS NULL OR current_epoch<=OLD.security_epoch OR NOT EXISTS(
          SELECT 1 FROM groundbnb.security_epoch_events e WHERE e.account_id=NEW.account_id
            AND e.new_epoch=current_epoch AND e.reason IN ('factor_revocation','factor_reset')) THEN
        RAISE EXCEPTION 'Factor revocation requires a newer security epoch and matching event';
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER security_epoch_event_required
  AFTER UPDATE ON groundbnb.account_security_epochs DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION groundbnb._require_factor_epoch_event();
CREATE CONSTRAINT TRIGGER security_epoch_event_current
  AFTER INSERT ON groundbnb.security_epoch_events DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION groundbnb._require_factor_epoch_event();
CREATE CONSTRAINT TRIGGER factor_revocation_epoch_required
  AFTER INSERT OR UPDATE ON groundbnb.privileged_factor_enrollments DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION groundbnb._require_factor_epoch_event();

CREATE FUNCTION groundbnb._serialize_factor_attempt_window()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  -- Serialize inserts for one account before checking overlap. Existing-window
  -- updates cannot change its identity or interval (the history guard enforces that).
  PERFORM 1 FROM groundbnb.accounts WHERE id=NEW.account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factor attempt owner is unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.factor_attempt_windows w
      WHERE w.account_id=NEW.account_id AND w.identity_issuer=NEW.identity_issuer
        AND w.identity_subject=NEW.identity_subject AND w.bucket_fingerprint=NEW.bucket_fingerprint
        AND w.window_started_at<NEW.window_ends_at AND NEW.window_started_at<w.window_ends_at
        AND w.window_started_at<>NEW.window_started_at) THEN
    RAISE EXCEPTION 'Factor attempt windows cannot overlap for the same owner bucket';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER factor_attempt_window_serialized
  BEFORE INSERT ON groundbnb.factor_attempt_windows
  FOR EACH ROW EXECUTE FUNCTION groundbnb._serialize_factor_attempt_window();

ALTER TABLE groundbnb.account_security_epochs ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.security_epoch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.privileged_factor_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.privileged_recovery_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.accepted_factor_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.privileged_factor_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.factor_attempt_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.privileged_factor_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON groundbnb.account_security_epochs,groundbnb.security_epoch_events,
  groundbnb.privileged_factor_enrollments,groundbnb.privileged_recovery_records,
  groundbnb.accepted_factor_steps,groundbnb.privileged_factor_attestations,
  groundbnb.factor_attempt_windows,groundbnb.privileged_factor_audit FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._privileged_factor_audit_append_only() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._guard_security_epoch() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._guard_factor_enrollment_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._guard_recovery_consumption() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._guard_accepted_factor_step() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._guard_factor_attestation() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._guard_factor_attempt_window() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._require_factor_epoch_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION groundbnb._serialize_factor_attempt_window() FROM PUBLIC;

DO $$
DECLARE e record; app_role text; app_oid oid;
BEGIN
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE WHEN e.kind='local' THEN 'groundbnb_local_app' ELSE 'groundbnb_preview_app' END;
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
    RAISE EXCEPTION 'Privileged factor records and helpers must remain private';
  END IF;
END $$;
INSERT INTO groundbnb.schema_migrations(version) VALUES('0009_privileged_factors');
COMMIT;
