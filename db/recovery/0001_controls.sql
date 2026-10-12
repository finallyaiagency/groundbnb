-- Apply only to a separate, access-restricted recovery-control database/branch.
-- HMAC keys stay outside every production snapshot and outside Git.
BEGIN;
CREATE SCHEMA IF NOT EXISTS recovery_control;
CREATE TABLE recovery_control.events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_key bytea NOT NULL,
  credential_key bytea,
  event_kind text NOT NULL CHECK (event_kind IN ('account_deleted', 'session_revoked', 'credential_revoked', 'bootstrap_revoked')),
  event_epoch bigint NOT NULL CHECK (event_epoch >= 0),
  occurred_at timestamptz NOT NULL,
  processed_at timestamptz,
  retained_until timestamptz NOT NULL,
  CHECK (octet_length(account_key) = 32),
  CHECK (credential_key IS NULL OR octet_length(credential_key) = 32)
);
CREATE INDEX events_account_epoch ON recovery_control.events(account_key, event_epoch);
COMMIT;
