-- Apply only to the isolated Neon preview branch, database groundbnb.
-- The app must authenticate and authorize the actor before calling these functions.
CREATE SCHEMA pcc;

CREATE TABLE pcc.streams (
  stream_id text PRIMARY KEY CHECK (stream_id ~ '^(Q|CR)-[0-9]{8}-[0-9a-f]{20}$'),
  stream_kind text NOT NULL CHECK (stream_kind IN ('question', 'change_request')),
  current_revision integer NOT NULL CHECK (current_revision >= 1),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE pcc.events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id text NOT NULL REFERENCES pcc.streams(stream_id),
  revision integer NOT NULL CHECK (revision >= 1),
  event_type text NOT NULL CHECK (event_type ~ '^(question|change_request)\.[a-z_]+$'),
  actor_subject text NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 200),
  actor_kind text NOT NULL CHECK (actor_kind IN ('client', 'agent', 'system')),
  idempotency_key uuid NOT NULL UNIQUE,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (stream_id, revision)
);

CREATE INDEX events_stream_history_idx ON pcc.events (stream_id, revision);
CREATE INDEX events_recent_idx ON pcc.events (occurred_at DESC);

CREATE FUNCTION pcc.reject_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'PCC audit events are append-only';
  RETURN NULL;
END;
$$;

CREATE TRIGGER events_append_only
BEFORE UPDATE OR DELETE ON pcc.events
FOR EACH ROW EXECUTE FUNCTION pcc.reject_event_mutation();

CREATE FUNCTION pcc.create_stream(
  p_stream_id text, p_stream_kind text, p_event_type text,
  p_actor_subject text, p_actor_kind text, p_idempotency_key uuid, p_payload jsonb
) RETURNS TABLE (event_id uuid, revision integer)
LANGUAGE plpgsql AS $$
BEGIN
  IF p_event_type <> p_stream_kind || '.created' THEN
    RAISE EXCEPTION 'PCC stream creation event mismatch' USING ERRCODE = 'PZ002';
  END IF;

  INSERT INTO pcc.streams (stream_id, stream_kind, current_revision)
  VALUES (p_stream_id, p_stream_kind, 1);

  RETURN QUERY
  INSERT INTO pcc.events AS e (stream_id, revision, event_type, actor_subject, actor_kind, idempotency_key, payload)
  VALUES (p_stream_id, 1, p_event_type, p_actor_subject, p_actor_kind, p_idempotency_key, p_payload)
  RETURNING e.event_id, e.revision;
END;
$$;

CREATE FUNCTION pcc.append_event(
  p_stream_id text, p_expected_revision integer, p_event_type text,
  p_actor_subject text, p_actor_kind text, p_idempotency_key uuid, p_payload jsonb
) RETURNS TABLE (event_id uuid, revision integer)
LANGUAGE plpgsql AS $$
DECLARE next_revision integer;
BEGIN
  UPDATE pcc.streams
  SET current_revision = current_revision + 1
  WHERE stream_id = p_stream_id AND current_revision = p_expected_revision
    AND stream_kind = split_part(p_event_type, '.', 1)
  RETURNING current_revision INTO next_revision;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PCC stream revision conflict' USING ERRCODE = 'PZ001';
  END IF;

  RETURN QUERY
  INSERT INTO pcc.events AS e (stream_id, revision, event_type, actor_subject, actor_kind, idempotency_key, payload)
  VALUES (p_stream_id, next_revision, p_event_type, p_actor_subject, p_actor_kind, p_idempotency_key, p_payload)
  RETURNING e.event_id, e.revision;
END;
$$;

REVOKE ALL ON SCHEMA pcc FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA pcc FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA pcc FROM PUBLIC;

-- The migration is additive. Recovery uses a Neon restore point/branch, not DROP TABLE.
-- Provision a dedicated least-privilege runtime role before enabling writes.
