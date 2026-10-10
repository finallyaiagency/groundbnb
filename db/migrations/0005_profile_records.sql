-- M1-01F normalized account vehicles and notes. Prepared only; do not apply before M1-01E browser gate.
-- Owner-scoped writes go through save_profile_records; application roles receive no table access.
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
     EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0005_profile_records') THEN
    RAISE EXCEPTION 'Requires pinned local/preview with M0 and M1 profile migrations 0001-0004, and no prior 0005';
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
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_patch(jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_account(text,text)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._profile_snapshot(uuid)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE ((n.nspname='groundbnb' AND c.relname NOT IN ('environment_identity','schema_migrations')) OR n.nspname='neon_auth')
       AND c.relkind IN ('r','p','v','m') AND has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN
    RAISE EXCEPTION 'Pinned application role baseline/ACL differs from approved M1 profile boundary';
  END IF;
  IF EXISTS(SELECT 1 FROM groundbnb.profile_answers WHERE field NOT IN
      ('homeAddress','homePoint','alwaysBeginEndAtHome','groupComposition','travelerCount','ageGroups','hasPets','petTypes',
       'preferredRegions','dietaryRequirements','specialRequirements','travelModes','travelSeason','overnightPreferences','activities',
       'drivingPace','maxDrivingHoursPerDay','budgetLevel','budgetMode','budgetTimeframe','budgetAmount','budgetCurrency','comfortLevel',
       'allowSplurge','splurgeAmount','splurgeCurrency','splurgeMode','splurgeTimeframe','splurgeFrequency','splurgeTypes',
       'needsFoodAccess','needsFacilities','needsWalkableTransit','includeSupportServices','avoidHighways','preferScenic','avoidTolls',
       'avoidMountainRoutes','accessibility','needHookups','sustainability','planningStyle','budgetSensitivity','preferredTransport',
       'travelScope','climate','riskTolerance','physicalCapacity','planningHorizon','willingToReposition','comparisonMode','terrain',
       'incomeOffsets','legalSafety','emotionalGoals')) THEN
    RAISE EXCEPTION 'Unexpected profile domain baseline';
  END IF;
END $$;

CREATE TABLE groundbnb.profile_vehicles (
  account_id uuid NOT NULL REFERENCES groundbnb.profiles(account_id),
  vehicle_id uuid NOT NULL,
  name text NOT NULL,
  vehicle_type text NOT NULL,
  ownership text NOT NULL CHECK (ownership IN ('owned','rented')),
  propulsion text,
  fuel_economy jsonb,
  dimensions jsonb,
  location jsonb,
  location_verified_at timestamptz,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY(account_id,vehicle_id),
  CHECK (length(name) BETWEEN 1 AND 1000),
  CHECK (length(vehicle_type) BETWEEN 1 AND 1000),
  CHECK (propulsion IS NULL OR length(propulsion) BETWEEN 1 AND 1000),
  CHECK ((location IS NULL)=(location_verified_at IS NULL))
);
CREATE TABLE groundbnb.profile_notes (
  account_id uuid NOT NULL REFERENCES groundbnb.profiles(account_id),
  note_id uuid NOT NULL,
  note_text text NOT NULL,
  origin text NOT NULL CHECK (origin IN ('user','AI')),
  selected_quote_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(selected_quote_ids)='array'),
  user_removed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY(account_id,note_id),
  CHECK (length(note_text) BETWEEN 1 AND 10000)
);
ALTER TABLE groundbnb.profile_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.profile_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON groundbnb.profile_vehicles,groundbnb.profile_notes FROM PUBLIC;

CREATE FUNCTION groundbnb._valid_profile_records(vehicle_rows jsonb,note_rows jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE item jsonb; val jsonb; timestamp_text text;
BEGIN
  IF vehicle_rows IS NULL OR jsonb_typeof(vehicle_rows)<>'array' OR jsonb_array_length(vehicle_rows)>100 OR
     note_rows IS NULL OR jsonb_typeof(note_rows)<>'array' OR jsonb_array_length(note_rows)>100 OR
     (jsonb_array_length(vehicle_rows)=0 AND jsonb_array_length(note_rows)=0) OR
     octet_length(vehicle_rows::text)+octet_length(note_rows::text)>16384 THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(vehicle_rows) LOOP
    IF jsonb_typeof(item)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(item))<>9 OR
       NOT (item ?& ARRAY['id','name','type','ownership','propulsion','fuelEconomy','dimensions','location','locationVerifiedAt']) OR
       jsonb_typeof(item->'id')<>'string' OR item->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR
       jsonb_typeof(item->'name')<>'string' OR length(item->>'name') NOT BETWEEN 1 AND 1000 OR btrim(item->>'name')='' OR
       jsonb_typeof(item->'type')<>'string' OR length(item->>'type') NOT BETWEEN 1 AND 1000 OR btrim(item->>'type')='' OR
       jsonb_typeof(item->'ownership')<>'string' OR item->>'ownership' NOT IN ('owned','rented') OR
       (jsonb_typeof(item->'propulsion') NOT IN ('null','string')) OR
       (jsonb_typeof(item->'propulsion')='string' AND (length(item->>'propulsion') NOT BETWEEN 1 AND 1000 OR btrim(item->>'propulsion')='')) THEN RETURN false; END IF;
    val:=item->'fuelEconomy';
    IF val<>'null'::jsonb AND (jsonb_typeof(val)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(val))<>3 OR
       NOT (val ?& ARRAY['value','unit','origin']) OR jsonb_typeof(val->'value')<>'number' OR
       (val->>'value')::numeric<=0 OR jsonb_typeof(val->'unit')<>'string' OR length(val->>'unit') NOT BETWEEN 1 AND 64 OR
       jsonb_typeof(val->'origin')<>'string' OR val->>'origin'<>'user') THEN RETURN false; END IF;
    val:=item->'dimensions';
    IF val<>'null'::jsonb AND (jsonb_typeof(val)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(val))<>3 OR
       NOT (val ?& ARRAY['lengthMeters','widthMeters','heightMeters']) OR EXISTS(
         SELECT 1 FROM jsonb_each(val) AS dimension(key,value) WHERE jsonb_typeof(value) NOT IN ('null','number') OR
           (jsonb_typeof(value)='number' AND (value::text)::numeric<=0))) THEN RETURN false; END IF;
    val:=item->'location';
    IF val<>'null'::jsonb AND (jsonb_typeof(val)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(val))<>3 OR
       NOT (val ?& ARRAY['latitude','longitude','origin']) OR jsonb_typeof(val->'latitude')<>'number' OR
       (val->>'latitude')::numeric NOT BETWEEN -90 AND 90 OR jsonb_typeof(val->'longitude')<>'number' OR
       (val->>'longitude')::numeric NOT BETWEEN -180 AND 180 OR val->>'origin'<>'user') THEN RETURN false; END IF;
    val:=item->'locationVerifiedAt';
    IF (item->'location'='null'::jsonb)<>(val='null'::jsonb) OR
       (val<>'null'::jsonb AND (jsonb_typeof(val)<>'string' OR val#>>'{}' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$')) THEN RETURN false; END IF;
    IF val<>'null'::jsonb THEN
      timestamp_text:=val#>>'{}';
      BEGIN
        IF to_char(timestamp_text::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>timestamp_text THEN
          RETURN false;
        END IF;
      EXCEPTION WHEN others THEN
        RETURN false;
      END;
    END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(note_rows) LOOP
    IF jsonb_typeof(item)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(item))<>5 OR
       NOT (item ?& ARRAY['id','text','origin','selectedQuoteIds','userRemoved']) OR
       jsonb_typeof(item->'id')<>'string' OR item->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR
       jsonb_typeof(item->'text')<>'string' OR length(item->>'text') NOT BETWEEN 1 AND 10000 OR btrim(item->>'text')='' OR
       jsonb_typeof(item->'origin')<>'string' OR item->>'origin'<>'user' OR
       jsonb_typeof(item->'userRemoved')<>'boolean' OR jsonb_typeof(item->'selectedQuoteIds')<>'array' OR
       jsonb_array_length(item->'selectedQuoteIds')>100 OR EXISTS(
         SELECT 1 FROM jsonb_array_elements(item->'selectedQuoteIds') AS quote(value) WHERE jsonb_typeof(value)<>'string' OR
           length(value#>>'{}') NOT BETWEEN 1 AND 200 OR btrim(value#>>'{}')='') OR
       (SELECT count(*) FROM jsonb_array_elements(item->'selectedQuoteIds'))<>
       (SELECT count(DISTINCT value) FROM jsonb_array_elements(item->'selectedQuoteIds') AS quote(value)) THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN others THEN
  RETURN false;
END $$;

-- Include normalized records in the canonical profile snapshot; legacy answers and revision stay unchanged.
CREATE OR REPLACE FUNCTION groundbnb._profile_snapshot(account_uuid uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp AS $$
  SELECT jsonb_build_object('accountId',p.account_id,'revision',p.revision,
    'createdAt',p.created_at,'updatedAt',p.updated_at,'answers',COALESCE((
      SELECT jsonb_object_agg(a.field,jsonb_build_object('value',a.value,'answered',a.answered,
        'scope',a.scope,'updatedAt',a.updated_at)) FROM groundbnb.profile_answers a WHERE a.account_id=p.account_id
    ),'{}'::jsonb),
    'vehicles',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.vehicle_id,'name',v.name,'type',v.vehicle_type,
      'ownership',v.ownership,'propulsion',v.propulsion,'fuelEconomy',v.fuel_economy,'dimensions',v.dimensions,
      'location',v.location,'locationVerifiedAt',CASE WHEN v.location_verified_at IS NULL THEN NULL
        ELSE to_char(v.location_verified_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END)
      ORDER BY v.vehicle_id) FROM groundbnb.profile_vehicles v WHERE v.account_id=p.account_id),'[]'::jsonb),
    'notes',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',n.note_id,'text',n.note_text,'origin',n.origin,
      'selectedQuoteIds',n.selected_quote_ids,'userRemoved',n.user_removed) ORDER BY n.note_id)
      FROM groundbnb.profile_notes n WHERE n.account_id=p.account_id),'[]'::jsonb))
    FROM groundbnb.profiles p WHERE p.account_id=account_uuid
$$;

CREATE FUNCTION groundbnb.save_profile_records(identity_issuer text,identity_subject text,operation_uuid uuid,
  expected_revision bigint,vehicle_rows jsonb,note_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; current_revision bigint; saved_time timestamptz; prior record;
  request_json jsonb; acknowledgment_json jsonb; incoming jsonb; existing_note record;
  affected jsonb; vehicle_comparison jsonb; note_comparison jsonb;
BEGIN
  account_uuid:=groundbnb._profile_account(identity_issuer,identity_subject);
  IF account_uuid IS NULL THEN RETURN jsonb_build_object('ok',false,'category','auth'); END IF;
  IF operation_uuid IS NULL OR expected_revision IS NULL OR expected_revision<0 OR
     expected_revision>=9007199254740991 OR NOT groundbnb._valid_profile_records(vehicle_rows,note_rows) OR
     (SELECT count(*) FROM jsonb_array_elements(vehicle_rows))<>(SELECT count(DISTINCT lower(value->>'id')) FROM jsonb_array_elements(vehicle_rows) AS recs(value)) OR
     (SELECT count(*) FROM jsonb_array_elements(note_rows))<>(SELECT count(DISTINCT lower(value->>'id')) FROM jsonb_array_elements(note_rows) AS recs(value)) THEN
    RETURN jsonb_build_object('ok',false,'category','validation');
  END IF;
  request_json:=jsonb_build_object('operationKind','profile_records','expectedRevision',expected_revision,
    'vehicleUpserts',vehicle_rows,'noteUpserts',note_rows);
  SELECT * INTO prior FROM groundbnb.profile_operations WHERE account_id=account_uuid AND operation_id=operation_uuid;
  IF FOUND THEN
    IF prior.request<>request_json THEN RETURN jsonb_build_object('ok',false,'category','validation'); END IF;
    RETURN prior.acknowledgment;
  END IF;
  SELECT revision INTO current_revision FROM groundbnb.profiles WHERE account_id=account_uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'category','unavailable'); END IF;
  IF current_revision<>expected_revision THEN
    SELECT COALESCE(jsonb_object_agg(proposed->>'id',jsonb_build_object('current',current_row.vehicle_json,'proposed',proposed)),'{}'::jsonb)
      INTO vehicle_comparison
      FROM jsonb_array_elements(vehicle_rows) AS proposed_rows(proposed)
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object('id',v.vehicle_id,'name',v.name,'type',v.vehicle_type,'ownership',v.ownership,
          'propulsion',v.propulsion,'fuelEconomy',v.fuel_economy,'dimensions',v.dimensions,'location',v.location,
          'locationVerifiedAt',CASE WHEN v.location_verified_at IS NULL THEN NULL
            ELSE to_char(v.location_verified_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END) AS vehicle_json
        FROM groundbnb.profile_vehicles v
        WHERE v.account_id=account_uuid AND v.vehicle_id=(proposed->>'id')::uuid
      ) current_row ON true;
    SELECT COALESCE(jsonb_object_agg(proposed->>'id',jsonb_build_object('current',current_row.note_json,'proposed',proposed)),'{}'::jsonb)
      INTO note_comparison
      FROM jsonb_array_elements(note_rows) AS proposed_rows(proposed)
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object('id',n.note_id,'text',n.note_text,'origin',n.origin,
          'selectedQuoteIds',n.selected_quote_ids,'userRemoved',n.user_removed) AS note_json
        FROM groundbnb.profile_notes n
        WHERE n.account_id=account_uuid AND n.note_id=(proposed->>'id')::uuid
      ) current_row ON true;
    RETURN jsonb_build_object('ok',false,'category','conflict','currentRevision',current_revision,
      'fieldComparison',jsonb_build_object('vehicles',vehicle_comparison,'notes',note_comparison));
  END IF;
  -- Quote IDs have no owner-bound quote entity in v1. Existing IDs may be preserved, but new notes cannot assert one.
  FOR incoming IN SELECT value FROM jsonb_array_elements(note_rows) LOOP
    SELECT * INTO existing_note FROM groundbnb.profile_notes n
      WHERE n.account_id=account_uuid AND n.note_id=(incoming->>'id')::uuid;
    IF NOT FOUND THEN
      IF incoming->>'origin'<>'user' OR incoming->'selectedQuoteIds'<>'[]'::jsonb THEN
        RETURN jsonb_build_object('ok',false,'category','validation');
      END IF;
    ELSE
      -- The client always submits user-authored edits. Preserve an existing AI origin in storage;
      -- clients cannot promote a note to AI or relabel an existing note.
      IF incoming->>'origin'<>'user' OR (existing_note.user_removed AND incoming->'userRemoved'<>'true'::jsonb) OR
         EXISTS(SELECT 1 FROM jsonb_array_elements(incoming->'selectedQuoteIds') AS quote(value)
           WHERE NOT (existing_note.selected_quote_ids @> jsonb_build_array(value))) THEN
        RETURN jsonb_build_object('ok',false,'category','validation');
      END IF;
    END IF;
  END LOOP;
  saved_time:=clock_timestamp();
  INSERT INTO groundbnb.profile_vehicles(account_id,vehicle_id,name,vehicle_type,ownership,propulsion,
    fuel_economy,dimensions,location,location_verified_at,updated_at)
  SELECT account_uuid,(v->>'id')::uuid,v->>'name',v->>'type',v->>'ownership',NULLIF(v->>'propulsion',''),
    NULLIF(v->'fuelEconomy','null'::jsonb),NULLIF(v->'dimensions','null'::jsonb),
    NULLIF(v->'location','null'::jsonb),CASE WHEN v->'locationVerifiedAt'='null'::jsonb THEN NULL ELSE (v->>'locationVerifiedAt')::timestamptz END,saved_time
    FROM jsonb_array_elements(vehicle_rows) AS vehicles(v)
  ON CONFLICT(account_id,vehicle_id) DO UPDATE SET name=EXCLUDED.name,vehicle_type=EXCLUDED.vehicle_type,
    ownership=EXCLUDED.ownership,propulsion=EXCLUDED.propulsion,
    fuel_economy=CASE WHEN EXCLUDED.fuel_economy IS NULL THEN NULL ELSE
      jsonb_set(EXCLUDED.fuel_economy,'{origin}',COALESCE(groundbnb.profile_vehicles.fuel_economy->'origin','"user"'::jsonb),true) END,
    dimensions=EXCLUDED.dimensions,
    location=CASE WHEN EXCLUDED.location IS NULL THEN NULL ELSE
      jsonb_set(EXCLUDED.location,'{origin}',COALESCE(groundbnb.profile_vehicles.location->'origin','"user"'::jsonb),true) END,
    location_verified_at=EXCLUDED.location_verified_at,updated_at=EXCLUDED.updated_at;
  INSERT INTO groundbnb.profile_notes(account_id,note_id,note_text,origin,selected_quote_ids,user_removed,updated_at)
  SELECT account_uuid,(n->>'id')::uuid,n->>'text',n->>'origin',n->'selectedQuoteIds',(n->>'userRemoved')::boolean,saved_time
    FROM jsonb_array_elements(note_rows) AS notes(n)
  ON CONFLICT(account_id,note_id) DO UPDATE SET
    note_text=CASE WHEN groundbnb.profile_notes.user_removed THEN groundbnb.profile_notes.note_text ELSE EXCLUDED.note_text END,
    origin=groundbnb.profile_notes.origin,
    selected_quote_ids=CASE WHEN groundbnb.profile_notes.user_removed THEN groundbnb.profile_notes.selected_quote_ids ELSE EXCLUDED.selected_quote_ids END,
    user_removed=groundbnb.profile_notes.user_removed OR EXCLUDED.user_removed,
    updated_at=CASE WHEN groundbnb.profile_notes.user_removed THEN groundbnb.profile_notes.updated_at ELSE EXCLUDED.updated_at END;
  UPDATE groundbnb.profiles SET revision=revision+1,updated_at=saved_time WHERE account_id=account_uuid;
  SELECT jsonb_agg(to_jsonb(entity_id) ORDER BY entity_id) INTO affected FROM (
    SELECT account_uuid AS entity_id UNION SELECT (v->>'id')::uuid FROM jsonb_array_elements(vehicle_rows) AS vehicles(v)
    UNION SELECT (n->>'id')::uuid FROM jsonb_array_elements(note_rows) AS notes(n)
  ) ids;
  acknowledgment_json:=jsonb_build_object('ok',true,'operationKind','profile_records','operationId',operation_uuid,'savedAt',saved_time,
    'affectedIds',COALESCE(affected,'[]'::jsonb),'profile',groundbnb._profile_snapshot(account_uuid));
  INSERT INTO groundbnb.profile_operations(account_id,operation_id,request,acknowledgment,saved_at)
    VALUES(account_uuid,operation_uuid,request_json,acknowledgment_json,saved_time);
  RETURN acknowledgment_json;
END $$;

REVOKE ALL ON FUNCTION groundbnb._valid_profile_records(jsonb,jsonb),
  groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb) FROM PUBLIC;
DO $$
DECLARE app_role text; app_oid oid;
BEGIN
  SELECT CASE kind WHEN 'local' THEN 'groundbnb_local_app' ELSE 'groundbnb_preview_app' END
    INTO STRICT app_role FROM groundbnb.environment_identity WHERE singleton;
  EXECUTE format('GRANT EXECUTE ON FUNCTION groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb) TO %I',app_role);
  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  IF NOT has_function_privilege(app_oid,'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._valid_profile_records(jsonb,jsonb)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._profile_account(text,text)','EXECUTE') OR
     has_function_privilege(app_oid,'groundbnb._profile_snapshot(uuid)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='groundbnb' AND c.relname IN ('profile_vehicles','profile_notes') AND
       has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE n.nspname='groundbnb' AND p.proname IN ('_valid_profile_records','save_profile_records') AND
       acl.grantee=0 AND acl.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'M1 profile-record function/table ACL assertion failed';
  END IF;
END $$;
INSERT INTO groundbnb.schema_migrations(version) VALUES('0005_profile_records');
COMMIT;
