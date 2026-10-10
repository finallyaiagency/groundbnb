import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { PROFILE_CATALOGS, PROFILE_FIELD_DEFINITIONS } from '../lib/profile-domain.mjs';
import { PROFILE_CURRENCY_CODES } from '../lib/profile-currency-codes.mjs';

const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const sqlArray = values => `ARRAY[${values.map(quote).join(',')}]::text[]`;
const registry = {
  version: 1,
  fields: PROFILE_FIELD_DEFINITIONS,
  catalogs: PROFILE_CATALOGS,
  currencies: PROFILE_CURRENCY_CODES,
};
const registryJson = JSON.stringify(registry, null, 2);
const registryHash = createHash('sha256').update(JSON.stringify(registry)).digest('hex').toUpperCase();
const fieldNames = Object.keys(PROFILE_FIELD_DEFINITIONS);
const fieldSql = fieldNames.map(quote).join(', ');

function nullableTypeSql(allowedTypes, { allowNullWhenAnswered = false } = {}) {
  const lines = [`IF value_type NOT IN (${allowedTypes.map(quote).join(',')}) THEN RETURN false; END IF;`];
  if (!allowNullWhenAnswered) lines.push("IF item.value->'answered'='true'::jsonb AND value_type='null' THEN RETURN false; END IF;");
  return lines.join('\n        ');
}

function validatorCase(field, definition) {
  const key = quote(field);
  const type = definition.type;
  if (type === 'text') return `WHEN item.key=${key} THEN
        ${nullableTypeSql(['null', 'string'])}
        IF value_type='string' AND (length(answer_value #>> '{}')=0 OR btrim(answer_value #>> '{}')='') THEN RETURN false; END IF;`;
  if (type === 'boolean') return `WHEN item.key=${key} THEN
        ${nullableTypeSql(['null', 'boolean'])}`;
  if (type === 'nullableBoolean') return `WHEN item.key=${key} THEN
        ${nullableTypeSql(['null', 'boolean'], { allowNullWhenAnswered: true })}`;
  if (type === 'choice') return `WHEN item.key=${key} THEN
        ${nullableTypeSql(['null', 'string'])}
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(${sqlArray(PROFILE_CATALOGS[definition.catalog])})) THEN RETURN false; END IF;`;
  if (type === 'choiceList') return `WHEN item.key=${key} THEN
        IF value_type<>'array' THEN RETURN false; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer_value) AS e(v)
          WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v #>> '{}')=0 OR NOT ((v #>> '{}') = ANY(${sqlArray(PROFILE_CATALOGS[definition.catalog])}))) THEN RETURN false; END IF;
        IF (SELECT count(*) FROM jsonb_array_elements(answer_value) AS e(v)) <>
           (SELECT count(DISTINCT v) FROM jsonb_array_elements(answer_value) AS e(v)) THEN RETURN false; END IF;`;
  if (type === 'textList') return `WHEN item.key=${key} THEN
        IF value_type<>'array' THEN RETURN false; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer_value) AS e(v)
          WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v #>> '{}')=0 OR btrim(v #>> '{}')='') THEN RETURN false; END IF;
        IF (SELECT count(*) FROM jsonb_array_elements(answer_value) AS e(v)) <>
           (SELECT count(DISTINCT v) FROM jsonb_array_elements(answer_value) AS e(v)) THEN RETURN false; END IF;`;
  if (type === 'manualChoiceList') return `WHEN item.key=${key} THEN
        IF value_type<>'array' THEN RETURN false; END IF;
        IF jsonb_array_length(answer_value)>${definition.maxItems} THEN RETURN false; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(answer_value) AS e(v)
          WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v #>> '{}') NOT BETWEEN 1 AND ${definition.maxItemLength} OR btrim(v #>> '{}')='') THEN RETURN false; END IF;
        IF (SELECT count(*) FROM jsonb_array_elements(answer_value) AS e(v)) <>
           (SELECT count(DISTINCT v) FROM jsonb_array_elements(answer_value) AS e(v)) THEN RETURN false; END IF;`;
  if (type === 'nullableInteger') {
    const bounds = [definition.min !== undefined ? `(answer_value #>> '{}')::numeric<${definition.min}` : null,
      definition.max !== undefined ? `(answer_value #>> '{}')::numeric>${definition.max}` : null].filter(Boolean).join(' OR ');
    return `WHEN item.key=${key} THEN
        ${nullableTypeSql(['null', 'number'], { allowNullWhenAnswered: true })}
        IF value_type='number' AND ((answer_value #>> '{}') !~ '^(0|[1-9][0-9]*)$' OR
          (answer_value #>> '{}')::numeric>9007199254740991${bounds ? ` OR ${bounds}` : ''}) THEN RETURN false; END IF;`;
  }
  if (type === 'nullableNumber') {
    const bounds = [definition.minExclusive !== undefined ? `(answer_value #>> '{}')::numeric<=${definition.minExclusive}` : null,
      definition.max !== undefined ? `(answer_value #>> '{}')::numeric>${definition.max}` : null].filter(Boolean).join(' OR ');
    return `WHEN item.key=${key} THEN
        ${nullableTypeSql(['null', 'number'], { allowNullWhenAnswered: true })}
        IF value_type='number'${bounds ? ` AND (${bounds})` : ''} THEN RETURN false; END IF;`;
  }
  if (type === 'nullableDecimal') return `WHEN item.key=${key} THEN
        ${nullableTypeSql(['null', 'string'], { allowNullWhenAnswered: true })}
        IF value_type='string' AND (length(answer_value #>> '{}')>256 OR (answer_value #>> '{}') !~ '^(0|[1-9][0-9]*)(\\.[0-9]+)?$') THEN RETURN false; END IF;`;
  if (type === 'nullableCurrency') return `WHEN item.key=${key} THEN
        ${nullableTypeSql(['null', 'string'], { allowNullWhenAnswered: true })}
        IF value_type='string' AND NOT ((answer_value #>> '{}') = ANY(${sqlArray(PROFILE_CURRENCY_CODES)})) THEN RETURN false; END IF;`;
  if (type === 'nullablePoint') return `WHEN item.key=${key} THEN
        ${nullableTypeSql(['null', 'object'], { allowNullWhenAnswered: true })}
        -- Resolved home points remain read-only until a provenance-bound resolver path exists.
        IF value_type='object' THEN RETURN false; END IF;`;
  throw new Error(`No SQL validator mapping for ${field}: ${type}`);
}

const cases = Object.entries(PROFILE_FIELD_DEFINITIONS).map(([field, definition]) => validatorCase(field, definition)).join('\n      ');
const snapshot = registryJson.split('\n').map(line => `-- ${line}`).join('\n');

export const PROFILE_DOMAIN_REGISTRY_HASH = registryHash;
export const PROFILE_DOMAIN_SQL = `-- Generated profile registry SHA-256: ${registryHash}
-- Frozen profile-domain registry snapshot:
${snapshot}

CREATE OR REPLACE FUNCTION groundbnb._valid_profile_patch(patch jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE item record; answer_value jsonb; value_type text; field_count integer;
BEGIN
  IF patch IS NULL OR jsonb_typeof(patch)<>'object' OR octet_length(patch::text)>16384 THEN RETURN false; END IF;
  SELECT count(*) INTO field_count FROM jsonb_object_keys(patch);
  IF field_count NOT BETWEEN 1 AND ${fieldNames.length} THEN RETURN false; END IF;
  FOR item IN SELECT * FROM jsonb_each(patch) LOOP
    IF item.key NOT IN (${fieldSql}) OR jsonb_typeof(item.value)<>'object' OR
      (SELECT count(*) FROM jsonb_object_keys(item.value))<>2 OR
      NOT (item.value ? 'value' AND item.value ? 'answered') OR
      jsonb_typeof(item.value->'answered')<>'boolean' THEN RETURN false; END IF;
    answer_value := item.value->'value'; value_type := jsonb_typeof(answer_value);
    IF item.value->'answered'='false'::jsonb AND value_type<>'null' AND
      NOT (CASE WHEN value_type='array' THEN jsonb_array_length(answer_value)=0 ELSE false END) THEN RETURN false; END IF;
    CASE
      ${cases}
      ELSE RETURN false;
    END CASE;
  END LOOP;
  RETURN true;
END $$;
`;

export function buildForwardMigration() {
  return `-- M1-01F. Expands account-profile answers on the pinned synthetic local/preview branches only.
-- Generated validator registry is frozen below with its source hash. This migration is prepared, not applied.
BEGIN;
DO $$
DECLARE e record; app_role text; role_record record;
BEGIN
  IF current_database()<>'groundbnb' THEN RAISE EXCEPTION 'Expected groundbnb database'; END IF;
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role := CASE
    WHEN e.kind='local' AND e.branch_id='br-rough-flower-b8lerkcf' THEN 'groundbnb_local_app'
    WHEN e.kind='preview' AND e.branch_id='br-bitter-hall-b8ibnrfy' THEN 'groundbnb_preview_app'
    ELSE NULL END;
  IF app_role IS NULL OR NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0001_environment') OR
     NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') OR
     EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0003_profile_domain') THEN
    RAISE EXCEPTION 'Requires the pinned local/preview branch with M0/M1-01D and no prior M1-01F';
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
  IF NOT EXISTS(SELECT 1 FROM groundbnb.profiles) OR
     EXISTS(SELECT 1 FROM groundbnb.profile_answers WHERE field NOT IN
       ('homeAddress','dietaryRequirements','specialRequirements','hasPets','alwaysBeginEndAtHome','travelerCount','preferredRegions')) THEN
    RAISE EXCEPTION 'Unexpected M1-01D profile baseline';
  END IF;
END $$;

ALTER TABLE groundbnb.profile_answers DROP CONSTRAINT profile_answers_field_check;
ALTER TABLE groundbnb.profile_answers ADD CONSTRAINT profile_answers_field_check CHECK(field IN (${fieldSql}));

${PROFILE_DOMAIN_SQL}
DO $$
DECLARE e record; app_role text; role_record record;
BEGIN
  SELECT * INTO STRICT e FROM groundbnb.environment_identity WHERE singleton;
  app_role:=CASE e.kind WHEN 'local' THEN 'groundbnb_local_app' ELSE 'groundbnb_preview_app' END;
  SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname=app_role;
  IF NOT has_function_privilege(role_record.oid,'groundbnb.read_profile(text,text)','EXECUTE') OR
     NOT has_function_privilege(role_record.oid,'groundbnb.save_profile(text,text,uuid,bigint,jsonb)','EXECUTE') OR
     has_function_privilege(role_record.oid,'groundbnb._valid_profile_patch(jsonb)','EXECUTE') OR
     EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='groundbnb' AND c.relname IN ('accounts','account_identities','profiles','profile_answers','profile_operations')
       AND has_table_privilege(role_record.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) OR
     EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE n.nspname='groundbnb' AND p.proname='_valid_profile_patch' AND acl.grantee=0 AND acl.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'M1-01F must preserve the restricted application function-only boundary';
  END IF;
END $$;
INSERT INTO groundbnb.schema_migrations(version) VALUES('0003_profile_domain');
COMMIT;
`;
}

if (process.argv.includes('--write')) {
  writeFileSync(new URL('../db/migrations/0003_profile_domain.sql', import.meta.url), buildForwardMigration());
}
