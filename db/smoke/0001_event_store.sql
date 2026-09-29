-- Preview-only, self-rolling smoke check. The inner exception block rolls back
-- its fixture while allowing the DO statement to succeed.
DO $$
DECLARE
  created record;
  appended record;
  conflict_seen boolean := false;
BEGIN
  BEGIN
    SELECT * INTO created FROM pcc.create_stream(
      'Q-20260929-00000000000000000001', 'question', 'question.created',
      'pcc-smoke', 'system', '00000000-0000-4000-8000-000000000001', '{}'::jsonb
    );
    IF created.revision <> 1 THEN RAISE EXCEPTION 'create revision mismatch'; END IF;

    SELECT * INTO appended FROM pcc.append_event(
      'Q-20260929-00000000000000000001', 1, 'question.answered',
      'pcc-smoke', 'system', '00000000-0000-4000-8000-000000000002', '{}'::jsonb
    );
    IF appended.revision <> 2 THEN RAISE EXCEPTION 'append revision mismatch'; END IF;

    BEGIN
      PERFORM pcc.append_event(
        'Q-20260929-00000000000000000001', 1, 'question.ignored',
        'pcc-smoke', 'system', '00000000-0000-4000-8000-000000000003', '{}'::jsonb
      );
    EXCEPTION WHEN SQLSTATE 'PZ001' THEN
      conflict_seen := true;
    END;
    IF NOT conflict_seen THEN RAISE EXCEPTION 'stale revision was accepted'; END IF;

    BEGIN
      UPDATE pcc.events SET payload = '{}'::jsonb
      WHERE stream_id = 'Q-20260929-00000000000000000001';
      RAISE EXCEPTION 'event mutation was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM = 'event mutation was accepted' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback pcc smoke fixture';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback pcc smoke fixture' THEN RAISE; END IF;
  END;
END;
$$;

SELECT count(*) AS retained_fixture_rows FROM pcc.events
WHERE stream_id = 'Q-20260929-00000000000000000001';
