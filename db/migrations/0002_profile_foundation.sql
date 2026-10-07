-- M1-01D. Reviewed synthetic local/preview migration; access expansion needs approval.
-- Never run on production/recovery or a branch containing real identities.
BEGIN;
DO $$
DECLARE e record; expected_role text; expected_issuer text;
BEGIN
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  expected_role := CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app'
    ELSE NULL END;
  IF current_database()<>'groundbnb' OR expected_role IS NULL OR
     NOT EXISTS (SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=expected_role AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'Requires pinned synthetic database and dormant M1 role';
  END IF;
  expected_issuer := CASE e.kind
    WHEN 'local' THEN 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth'
    ELSE 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth' END;
  IF (SELECT count(*) FROM neon_auth."user") <> 1 OR
    NOT EXISTS (SELECT 1 FROM neon_auth."user" WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true) THEN
    RAISE EXCEPTION 'Requires sole approved verified synthetic Auth fixture';
  END IF;
END $$;

CREATE TABLE groundbnb.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL DEFAULT 'Synthetic traveler',
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin','owner')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleting','deleted')),
  settings jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(settings)='object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991)
);
CREATE TABLE groundbnb.account_identities (
  issuer text NOT NULL,
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
  account_id uuid NOT NULL REFERENCES groundbnb.accounts(id),
  verified_email text NOT NULL CHECK (verified_email LIKE '%@example.test'),
  provider text NOT NULL DEFAULT 'managed-email',
  revoked_at timestamptz,
  PRIMARY KEY (issuer,subject)
);
CREATE TABLE groundbnb.profiles (
  account_id uuid PRIMARY KEY REFERENCES groundbnb.accounts(id),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE groundbnb.profile_answers (
  account_id uuid NOT NULL REFERENCES groundbnb.profiles(account_id),
  field text NOT NULL CHECK (field IN ('homeAddress','dietaryRequirements','specialRequirements','hasPets','alwaysBeginEndAtHome','travelerCount','preferredRegions')),
  value jsonb NOT NULL,
  answered boolean NOT NULL,
  scope text NOT NULL DEFAULT 'account' CHECK (scope='account'),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY(account_id,field)
);
CREATE TABLE groundbnb.profile_operations (
  account_id uuid NOT NULL REFERENCES groundbnb.profiles(account_id),
  operation_id uuid NOT NULL,
  request jsonb NOT NULL,
  acknowledgment jsonb NOT NULL,
  saved_at timestamptz NOT NULL,
  PRIMARY KEY(account_id,operation_id)
);
ALTER TABLE groundbnb.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.account_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.profile_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE groundbnb.profile_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON groundbnb.accounts,groundbnb.account_identities,groundbnb.profiles,
  groundbnb.profile_answers,groundbnb.profile_operations FROM PUBLIC;

-- Operator-only binding to the pre-existing verified fixture, never a typed client email.
DO $$
DECLARE e record; account_uuid uuid; issuer_pin text;
BEGIN
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  issuer_pin := CASE e.kind
    WHEN 'local' THEN 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth'
    ELSE 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth' END;
  INSERT INTO groundbnb.accounts DEFAULT VALUES RETURNING id INTO account_uuid;
  INSERT INTO groundbnb.account_identities(issuer,subject,account_id,verified_email)
    SELECT issuer_pin,id::text,account_uuid,email FROM neon_auth."user"
    WHERE email=e.kind || '-01@example.test' AND "emailVerified"=true;
  INSERT INTO groundbnb.profiles(account_id) VALUES(account_uuid);
END $$;

CREATE FUNCTION groundbnb._valid_profile_patch(patch jsonb) RETURNS boolean
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

CREATE FUNCTION groundbnb._profile_snapshot(account_uuid uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp AS $$
  SELECT jsonb_build_object('accountId',p.account_id,'revision',p.revision,
    'createdAt',p.created_at,'updatedAt',p.updated_at,'answers',COALESCE((
      SELECT jsonb_object_agg(a.field,jsonb_build_object('value',a.value,'answered',a.answered,
        'scope',a.scope,'updatedAt',a.updated_at)) FROM groundbnb.profile_answers a WHERE a.account_id=p.account_id
    ),'{}'::jsonb)) FROM groundbnb.profiles p WHERE p.account_id=account_uuid
$$;

CREATE FUNCTION groundbnb._profile_account(identity_issuer text,identity_subject text) RETURNS uuid
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; e record; role_pin text; issuer_pin text;
BEGIN
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  role_pin := CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app' END;
  issuer_pin := CASE e.kind
    WHEN 'local' THEN 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth'
    WHEN 'preview' THEN 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth' END;
  IF role_pin IS NULL OR session_user NOT IN (role_pin,'neondb_owner') OR
    identity_issuer IS DISTINCT FROM issuer_pin THEN RETURN NULL; END IF;
  -- All ordinary operations serialize with account suspension/deletion and binding revocation.
  SELECT a.id INTO account_uuid FROM groundbnb.accounts a
    JOIN groundbnb.account_identities i ON i.account_id=a.id
    WHERE i.issuer=identity_issuer AND i.subject=identity_subject AND i.revoked_at IS NULL AND a.status='active'
    FOR UPDATE OF a,i;
  RETURN account_uuid;
END $$;

CREATE FUNCTION groundbnb.read_profile(identity_issuer text,identity_subject text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; snapshot jsonb;
BEGIN
  account_uuid:=groundbnb._profile_account(identity_issuer,identity_subject);
  IF account_uuid IS NULL THEN RETURN jsonb_build_object('ok',false,'category','auth'); END IF;
  snapshot:=groundbnb._profile_snapshot(account_uuid);
  IF snapshot IS NULL THEN RETURN jsonb_build_object('ok',false,'category','unavailable'); END IF;
  RETURN jsonb_build_object('ok',true,'profile',snapshot);
END $$;

CREATE FUNCTION groundbnb.save_profile(identity_issuer text,identity_subject text,operation_uuid uuid,
  expected_revision bigint,patch jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE account_uuid uuid; current_revision bigint; saved_time timestamptz; prior record;
  request_json jsonb; acknowledgment_json jsonb; comparisons jsonb;
BEGIN
  account_uuid:=groundbnb._profile_account(identity_issuer,identity_subject);
  IF account_uuid IS NULL THEN RETURN jsonb_build_object('ok',false,'category','auth'); END IF;
  IF operation_uuid IS NULL OR expected_revision IS NULL OR expected_revision<0 OR
    expected_revision>=9007199254740991 OR NOT groundbnb._valid_profile_patch(patch) THEN
    RETURN jsonb_build_object('ok',false,'category','validation'); END IF;
  request_json:=jsonb_build_object('expectedRevision',expected_revision,'patch',patch);
  SELECT * INTO prior FROM groundbnb.profile_operations WHERE account_id=account_uuid AND operation_id=operation_uuid;
  IF FOUND THEN
    IF prior.request<>request_json THEN RETURN jsonb_build_object('ok',false,'category','validation'); END IF;
    RETURN prior.acknowledgment;
  END IF;
  SELECT revision INTO current_revision FROM groundbnb.profiles WHERE account_id=account_uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'category','unavailable'); END IF;
  IF current_revision<>expected_revision THEN
    SELECT jsonb_object_agg(p.key,jsonb_build_object('current',COALESCE(
      groundbnb._profile_snapshot(account_uuid)->'answers'->p.key,'null'::jsonb),'proposed',p.value))
      INTO comparisons FROM jsonb_each(patch) p;
    RETURN jsonb_build_object('ok',false,'category','conflict','currentRevision',current_revision,'fieldComparison',comparisons);
  END IF;
  saved_time:=clock_timestamp();
  INSERT INTO groundbnb.profile_answers(account_id,field,value,answered,updated_at)
    SELECT account_uuid,p.key,p.value->'value',(p.value->>'answered')::boolean,saved_time FROM jsonb_each(patch) p
    ON CONFLICT(account_id,field) DO UPDATE SET value=EXCLUDED.value,answered=EXCLUDED.answered,updated_at=EXCLUDED.updated_at;
  UPDATE groundbnb.profiles SET revision=revision+1,updated_at=saved_time WHERE account_id=account_uuid;
  acknowledgment_json:=jsonb_build_object('ok',true,'operationId',operation_uuid,'savedAt',saved_time,
    'affectedIds',jsonb_build_array(account_uuid),'profile',groundbnb._profile_snapshot(account_uuid));
  INSERT INTO groundbnb.profile_operations(account_id,operation_id,request,acknowledgment,saved_at)
    VALUES(account_uuid,operation_uuid,request_json,acknowledgment_json,saved_time);
  RETURN acknowledgment_json;
END $$;

REVOKE ALL ON FUNCTION groundbnb._valid_profile_patch(jsonb),groundbnb._profile_snapshot(uuid),
  groundbnb._profile_account(text,text),groundbnb.read_profile(text,text),
  groundbnb.save_profile(text,text,uuid,bigint,jsonb) FROM PUBLIC;
DO $$
DECLARE app_role text; app_oid oid;
BEGIN
  SELECT CASE kind WHEN 'local' THEN 'groundbnb_local_app' ELSE 'groundbnb_preview_app' END
    INTO STRICT app_role FROM groundbnb.environment_identity WHERE singleton;
  EXECUTE format('GRANT EXECUTE ON FUNCTION groundbnb.read_profile(text,text),groundbnb.save_profile(text,text,uuid,bigint,jsonb) TO %I',app_role);
  -- No direct table/Auth access, role elevation, login or credential activation.
  SELECT oid INTO STRICT app_oid FROM pg_roles WHERE rolname=app_role;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='groundbnb' AND c.relname IN ('accounts','account_identities','profiles','profile_answers','profile_operations')
      AND has_table_privilege(app_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) OR
    has_function_privilege(app_oid,'groundbnb._profile_account(text,text)','EXECUTE') OR
    has_function_privilege(app_oid,'groundbnb._profile_snapshot(uuid)','EXECUTE') OR
    has_function_privilege(app_oid,'groundbnb._valid_profile_patch(jsonb)','EXECUTE') OR
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
      WHERE n.nspname='groundbnb' AND p.proname IN ('read_profile','save_profile','_profile_account','_profile_snapshot','_valid_profile_patch')
      AND acl.grantee=0 AND acl.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'Profile function/table ACL assertion failed';
  END IF;
END $$;
INSERT INTO groundbnb.schema_migrations(version) VALUES('0002_profile_foundation');
COMMIT;
