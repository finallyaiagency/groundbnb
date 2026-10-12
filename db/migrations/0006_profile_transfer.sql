-- M1-01F selected profile transfer. Prepared only; never apply to production/recovery.
-- Profile answers and imported user notes share one owner-scoped revision and acknowledgment.
BEGIN;
DO $$
DECLARE e record; app_role text; role_record record;
BEGIN
  IF current_database()<>'groundbnb' THEN RAISE EXCEPTION 'Expected groundbnb database'; END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  IF app_role IS NULL OR NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0003_profile_domain') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0004_profile_operation_status') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0005_profile_records') OR
     EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0006_profile_transfer') THEN
    RAISE EXCEPTION 'Requires pinned local/preview with profile migrations 0001-0005 and no prior 0006';
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
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_patch(jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_records(jsonb,jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_account(text,text)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_snapshot(uuid)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relname NOT IN ('environment_identity','schema_migrations')) OR n.nspname='neon_auth')
       AND c.relkind IN ('r','p','v','m') AND has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
    RAISE EXCEPTION 'Pinned application role baseline/ACL differs from approved M1 profile boundary';
  END IF;
END $$;

CREATE FUNCTION groundbnb.save_profile_transfer(identity_issuer text,identity_subject text,operation_uuid uuid,
  expected_revision bigint,profile_patch jsonb,note_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; current_revision bigint; saved_time timestamptz; prior record;
  request_json jsonb; acknowledgment_json jsonb; incoming jsonb; affected jsonb;
  profile_comparison jsonb; note_comparison jsonb; note_ids integer;
BEGIN
  account_uuid:=groundbnb._profile_account(identity_issuer,identity_subject);
  IF account_uuid IS NULL THEN RETURN jsonb_build_object('ok',false,'category','auth'); END IF;
  IF operation_uuid IS NULL OR expected_revision IS NULL OR expected_revision<0 OR expected_revision>=9007199254740991 OR
     profile_patch IS NULL OR jsonb_typeof(profile_patch) IS DISTINCT FROM 'object' OR
     note_rows IS NULL OR jsonb_typeof(note_rows) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('ok',false,'category','validation');
  END IF;

  IF (SELECT count(*) FROM jsonb_object_keys(profile_patch))>0 AND NOT groundbnb._valid_profile_patch(profile_patch) THEN
    RETURN jsonb_build_object('ok',false,'category','validation');
  END IF;
  SELECT count(*) INTO note_ids FROM jsonb_array_elements(note_rows);
  IF note_ids>0 AND NOT groundbnb._valid_profile_records('[]'::jsonb,note_rows) THEN
    RETURN jsonb_build_object('ok',false,'category','validation');
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(profile_patch))=0 AND note_ids=0 THEN
    RETURN jsonb_build_object('ok',false,'category','validation');
  END IF;
  -- Import files cannot confer map-data provenance. Address changes clear the previous resolution atomically.
  IF profile_patch ? 'homePoint' AND profile_patch->'homePoint'->'value' IS DISTINCT FROM 'null'::jsonb THEN
    RETURN jsonb_build_object('ok',false,'category','validation');
  END IF;
  IF profile_patch ? 'homeAddress' THEN
    profile_patch:=jsonb_set(profile_patch,'{homePoint}','{"value":null,"answered":false}'::jsonb,true);
    IF NOT groundbnb._valid_profile_patch(profile_patch) THEN
      RETURN jsonb_build_object('ok',false,'category','validation');
    END IF;
  END IF;
  IF octet_length(jsonb_build_array(profile_patch,note_rows)::text)>16384 THEN
    RETURN jsonb_build_object('ok',false,'category','validation');
  END IF;
  IF note_ids>0 THEN
    IF note_ids<>(SELECT count(DISTINCT lower(value->>'id')) FROM jsonb_array_elements(note_rows) AS items(value)) THEN
      RETURN jsonb_build_object('ok',false,'category','validation');
    END IF;
    FOR incoming IN SELECT value FROM jsonb_array_elements(note_rows) LOOP
      IF incoming->>'origin'<>'user' OR incoming->'selectedQuoteIds'<>'[]'::jsonb OR
         incoming->'userRemoved'<>'false'::jsonb THEN
        RETURN jsonb_build_object('ok',false,'category','validation');
      END IF;
    END LOOP;
  END IF;

  request_json:=jsonb_build_object('operationKind','profile_transfer','expectedRevision',expected_revision,
    'profilePatch',profile_patch,'noteUpserts',note_rows);
  SELECT * INTO prior FROM groundbnb.profile_operations WHERE account_id=account_uuid AND operation_id=operation_uuid;
  IF FOUND THEN
    IF prior.request<>request_json THEN RETURN jsonb_build_object('ok',false,'category','validation'); END IF;
    RETURN prior.acknowledgment;
  END IF;

  SELECT revision INTO current_revision FROM groundbnb.profiles WHERE account_id=account_uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'category','unavailable'); END IF;
  IF current_revision<>expected_revision THEN
    SELECT COALESCE(jsonb_object_agg(p.key,jsonb_build_object('current',COALESCE(
      groundbnb._profile_snapshot(account_uuid)->'answers'->p.key,'null'::jsonb),'proposed',p.value)),'{}'::jsonb)
      INTO profile_comparison FROM jsonb_each(profile_patch) p;
    SELECT COALESCE(jsonb_object_agg(proposed->>'id',jsonb_build_object('current',current_row.note_json,'proposed',proposed)),'{}'::jsonb)
      INTO note_comparison
      FROM jsonb_array_elements(note_rows) AS proposed_rows(proposed)
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object('id',n.note_id,'text',n.note_text,'origin',n.origin,
          'selectedQuoteIds',n.selected_quote_ids,'userRemoved',n.user_removed) AS note_json
        FROM groundbnb.profile_notes n WHERE n.account_id=account_uuid AND n.note_id=(proposed->>'id')::uuid
      ) current_row ON true;
    RETURN jsonb_build_object('ok',false,'category','conflict','currentRevision',current_revision,
      'fieldComparison',jsonb_build_object('profileFields',COALESCE(profile_comparison,'{}'::jsonb),
        'notes',COALESCE(note_comparison,'{}'::jsonb)));
  END IF;

  -- Transferred strings become new manual notes only. Existing IDs, AI notes, and tombstones are never upserted.
  IF note_ids>0 AND EXISTS(
      SELECT 1 FROM jsonb_array_elements(note_rows) AS items(value)
      JOIN groundbnb.profile_notes n ON n.account_id=account_uuid AND n.note_id=(value->>'id')::uuid) THEN
    RETURN jsonb_build_object('ok',false,'category','validation');
  END IF;
  saved_time:=clock_timestamp();
  INSERT INTO groundbnb.profile_answers(account_id,field,value,answered,updated_at)
    SELECT account_uuid,p.key,p.value->'value',(p.value->>'answered')::boolean,saved_time FROM jsonb_each(profile_patch) p
    ON CONFLICT(account_id,field) DO UPDATE SET value=EXCLUDED.value,answered=EXCLUDED.answered,updated_at=EXCLUDED.updated_at;
  INSERT INTO groundbnb.profile_notes(account_id,note_id,note_text,origin,selected_quote_ids,user_removed,updated_at)
    SELECT account_uuid,(n->>'id')::uuid,n->>'text','user','[]'::jsonb,false,saved_time
    FROM jsonb_array_elements(note_rows) AS notes(n);
  UPDATE groundbnb.profiles SET revision=revision+1,updated_at=saved_time WHERE account_id=account_uuid;
  SELECT jsonb_agg(to_jsonb(entity_id) ORDER BY entity_id) INTO affected FROM (
    SELECT account_uuid AS entity_id
    UNION SELECT (n->>'id')::uuid FROM jsonb_array_elements(note_rows) AS notes(n)
  ) ids;
  acknowledgment_json:=jsonb_build_object('ok',true,'operationKind','profile_transfer','operationId',operation_uuid,
    'savedAt',saved_time,'affectedIds',COALESCE(affected,'[]'::jsonb),'profile',groundbnb._profile_snapshot(account_uuid));
  INSERT INTO groundbnb.profile_operations(account_id,operation_id,request,acknowledgment,saved_at)
    VALUES(account_uuid,operation_uuid,request_json,acknowledgment_json,saved_time);
  RETURN acknowledgment_json;
END $$;

REVOKE ALL ON FUNCTION groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb) FROM PUBLIC;
DO $$
DECLARE app_role text; app_oid oid;
BEGIN
  SELECT CASE kind WHEN 'local' THEN 'groundbnb_local_app' ELSE 'groundbnb_preview_app' END
    INTO STRICT app_role FROM groundbnb.environment_identity WHERE singleton;
  EXECUTE format('GRANT EXECUTE ON FUNCTION groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb) TO %I',app_role);
  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  IF NOT has_function_privilege(app_oid,'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._valid_profile_patch(jsonb)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._valid_profile_records(jsonb,jsonb)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._profile_account(text,text)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._profile_snapshot(uuid)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='groundbnb' AND c.relname IN ('profiles','profile_answers','profile_notes','profile_operations') AND
       has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE n.nspname='groundbnb' AND p.proname='save_profile_transfer' AND acl.grantee=0 AND acl.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'M1 profile-transfer function ACL assertion failed';
  END IF;
END $$;
INSERT INTO groundbnb.schema_migrations(version) VALUES('0006_profile_transfer');
COMMIT;
