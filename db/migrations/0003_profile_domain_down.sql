-- M1-01F reverse migration. Refuses rollback after any domain write or newer operation.
-- Prepared only; never run on production/recovery or against real identities.
BEGIN;
DO $$
DECLARE e record; app_role text; role_record record; applied timestamptz;
BEGIN
  IF current_database()<>'groundbnb' THEN RAISE EXCEPTION 'Expected groundbnb database'; END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role := CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app'
    ELSE NULL END;
  SELECT applied_at INTO STRICT applied FROM groundbnb.schema_migrations WHERE version='0003_profile_domain';
  IF app_role IS NULL OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') THEN
    RAISE EXCEPTION 'Requires the pinned local/preview branch with M0/M1-01D and applied M1-01F';
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
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_patch(jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_account(text,text)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_snapshot(uuid)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relname NOT IN ('environment_identity','schema_migrations')) OR n.nspname='neon_auth')
       AND c.relkind IN ('r','p','v','m') AND has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
    RAISE EXCEPTION 'Pinned application role baseline/ACL differs from the approved M1-01D boundary';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.profile_answers WHERE field NOT IN
      ('homeAddress','dietaryRequirements','specialRequirements','hasPets','alwaysBeginEndAtHome','travelerCount','preferredRegions')) OR
     EXISTS(SELECT 1 FROM groundbnb.profile_answers WHERE field='travelerCount' AND
       (jsonb_typeof(value)<>'number' OR value::text !~ '^[0-9]+$' OR (value::text)::numeric NOT BETWEEN 1 AND 200)) OR
     EXISTS(SELECT 1 FROM groundbnb.profile_answers WHERE updated_at>applied) OR
     EXISTS(SELECT 1 FROM groundbnb.profile_operations WHERE saved_at>applied) THEN
    RAISE EXCEPTION 'Rollback refused: newer profile keys, values, answers, or operations would be lost or invalid';
  END IF;
END $$;

ALTER TABLE groundbnb.profile_answers DROP CONSTRAINT profile_answers_field_check;
ALTER TABLE groundbnb.profile_answers ADD CONSTRAINT profile_answers_field_check CHECK(field IN
  ('homeAddress','dietaryRequirements','specialRequirements','hasPets','alwaysBeginEndAtHome','travelerCount','preferredRegions'));

-- Restore the exact M1-01D validator, including its original 16 KiB and seven-key bounds.
CREATE OR REPLACE FUNCTION groundbnb._valid_profile_patch(patch jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE item record; answer_value jsonb; value_type text;
BEGIN
  IF patch IS NULL OR jsonb_typeof(patch)<>'object' OR octet_length(patch::text)>16384 OR
     (SELECT count(*) FROM jsonb_object_keys(patch)) NOT BETWEEN 1 AND 7 THEN RETURN false; END IF;
  FOR item IN SELECT * FROM jsonb_each(patch) LOOP
    IF jsonb_typeof(item.value)<>'object' OR
      (SELECT count(*) FROM jsonb_object_keys(item.value))<>2 OR
      NOT (item.value ? 'value' AND item.value ? 'answered') OR
      jsonb_typeof(item.value->'answered')<>'boolean' THEN RETURN false; END IF;
    answer_value := item.value->'value'; value_type := jsonb_typeof(answer_value);
    IF item.value->'answered'='false'::jsonb AND answer_value<>'null'::jsonb AND
      NOT (item.key='preferredRegions' AND answer_value='[]'::jsonb) THEN RETURN false; END IF;
    CASE
      WHEN item.key IN ('homeAddress','dietaryRequirements','specialRequirements') THEN
        IF value_type NOT IN ('null','string') OR (value_type='string' AND length(answer_value#>>'{}')>2000) THEN RETURN false; END IF;
      WHEN item.key IN ('hasPets','alwaysBeginEndAtHome') THEN
        IF value_type NOT IN ('null','boolean') THEN RETURN false; END IF;
      WHEN item.key='travelerCount' THEN
        IF value_type<>'null' AND (value_type<>'number' OR answer_value::text !~ '^[0-9]+$') THEN RETURN false; END IF;
        IF value_type='number' AND (answer_value::text)::numeric NOT BETWEEN 1 AND 200 THEN RETURN false; END IF;
      WHEN item.key='preferredRegions' THEN
        IF value_type<>'array' THEN RETURN false; END IF;
        IF jsonb_array_length(answer_value)>50 OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(answer_value) v
          WHERE jsonb_typeof(v)<>'string' OR length(v#>>'{}') NOT BETWEEN 1 AND 200
        ) OR (SELECT count(*) FROM jsonb_array_elements(answer_value))<>
          (SELECT count(DISTINCT v) FROM jsonb_array_elements(answer_value) v) THEN RETURN false; END IF;
      ELSE RETURN false;
    END CASE;
  END LOOP;
  RETURN true;
END $$;

DELETE FROM groundbnb.schema_migrations WHERE version='0003_profile_domain';
COMMIT;
