import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const worker = readFileSync(new URL('../scripts/verify-m1-expanded-app-boundary.mjs', import.meta.url), 'utf8');
const wrapper = readFileSync(new URL('../scripts/verify-m1-expanded-app-boundary.ps1', import.meta.url), 'utf8');
const factorCatalog = readFileSync(new URL('../lib/factor-credential-catalog.mjs', import.meta.url), 'utf8');

const approvedFunctions = [
  'groundbnb.read_profile(text,text)',
  'groundbnb.save_profile(text,text,uuid,bigint,jsonb)',
  'groundbnb.read_profile_operation(text,text,uuid)',
  'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)',
  'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)',
  'groundbnb.read_membership(text,text)',
];

test('worker pins the six ordinary app functions and allows only the exact seed trigger exception', () => {
  for (const signature of approvedFunctions) {
    assert.ok(worker.includes(`has_function_privilege(r.oid,'${signature}','EXECUTE')`) ||
      worker.includes(`to_regprocedure('${signature}')`), `missing exact function check: ${signature}`);
    assert.ok(worker.includes(`to_regprocedure('${signature}')`), `not excluded from extra-function denial: ${signature}`);
  }
  assert.match(worker, /AS six_functions_allowed/);
  assert.match(worker, /AS no_extra_functions/);
  assert.doesNotMatch(worker, /p\.prorettype NOT IN \('trigger'::regtype,'event_trigger'::regtype\)/);
  assert.match(worker, /synthetic_seed_trigger_exact/);
  assert.match(worker, /groundbnb\.refuse_production_synthetic_seed\(\)/);
  assert.match(worker, /p\.oid NOT IN \([\s\S]*\$\{SEED_TRIGGER_FUNCTION\}\)/);
  assert.match(worker, /factorCredentialCatalogQuery\(false\)/);
  assert.match(worker, /factorCatalog\?\.role_name === factorRole/);
  assert.match(worker, /factorCatalog\?\.connected_role === target\.role/);
  assert.match(worker, /typeof kind !== 'string'/);
  assert.match(worker, /Object\.hasOwn\(PROFILE_TARGETS, kind\)/);
  assert.match(worker, /Object\.hasOwn\(MEMBERSHIP_PROBE_ISSUERS, kind\)/);
  assert.match(worker, /Object\.hasOwn\(FACTOR_ROLES, kind\)/);
  assert.match(worker, /const commonChecks = \['attributes_safe','ordinary_app_creator_membership_exact','metadata_select_only','private_tables_denied','sequences_denied'/);
  assert.match(worker, /'six_functions_allowed','no_extra_functions','synthetic_seed_trigger_exact','create_denied','unmapped_subject_denied'/);
  assert.match(worker, /to_regprocedure\('groundbnb\.read_membership\(text,text\)'\)/);
  assert.doesNotMatch(worker, /five_functions_allowed/);
});

test('worker checks only catalog ACLs and denies private tables, sequences, helpers, and create rights', () => {
  assert.match(worker, /n\.nspname='groundbnb' AND c\.relkind IN \('r','p','v','m','f'\)/);
  assert.match(worker, /has_table_privilege\(r\.oid,c\.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'\)/);
  assert.match(worker, /n\.nspname='groundbnb' AND c\.relkind='S'/);
  assert.match(worker, /has_sequence_privilege\(r\.oid,c\.oid,'USAGE,SELECT,UPDATE'\)/);
  assert.match(worker, /acldefault\(\(CASE WHEN c\.relkind='S' THEN 'S' ELSE 'r' END\)::"char",c\.relowner\)/);
  assert.match(worker, /NOT has_database_privilege\(r\.oid,current_database\(\),'CREATE'\)/);
  assert.match(worker, /NOT has_schema_privilege\(r\.oid,'groundbnb','CREATE'\)/);
  assert.match(worker, /sql\.query\('SET TRANSACTION READ WRITE'\),\s*sql\.query\(query, \[issuer, UNMAPPED_SUBJECT, factorRole, baseline\]\)/);
  assert.match(worker, /factorCredentialCatalogQuery\(false\)/);
  assert.match(worker, /factorCatalog\?\.role_name === factorRole/);
  assert.match(worker, /factorCatalog\?\.connected_role === target\.role/);
  assert.match(worker, /const transactionResults = await sql\.transaction\(/);
  assert.match(worker, /readOnly: false/);
  assert.match(worker, /AbortSignal\.timeout\(10000\)/);
});

test('membership probe is parameterized to the exact pinned issuer and a fixed unmapped synthetic subject', () => {
  assert.match(worker, /const MEMBERSHIP_PROBE_ISSUERS = Object\.freeze\(/);
  assert.match(worker, /local: 'https:\/\/ep-calm-sound-b8s8ckur\.neonauth\.c-14\.us-east-1\.aws\.neon\.tech\/groundbnb\/auth'/);
  assert.match(worker, /preview: 'https:\/\/ep-red-night-b8pf2mdl\.neonauth\.c-14\.us-east-1\.aws\.neon\.tech\/groundbnb\/auth'/);
  assert.match(worker, /const UNMAPPED_SUBJECT = 'm1-q011-unmapped-subject-boundary-probe'/);
  assert.match(worker, /groundbnb\.read_membership\(\$1,\$2\)=jsonb_build_object\('ok',false,'category','auth'\)/);
  assert.match(worker, /sql\.query\(query, \[issuer, UNMAPPED_SUBJECT, factorRole, baseline\]\)/);
  assert.doesNotMatch(worker, /groundbnb\.accounts|neon_auth\."user"|account_uuid|synthetic-user-[0-9]/);
});

test('PowerShell wrapper reuses only the pinned CurrentUser DPAPI bindings and prints sanitized results', () => {
  assert.match(wrapper, /\.env\.m1-profile-\$verifyKind\.dpapi/);
  assert.match(wrapper, /DataProtectionScope\]::CurrentUser/);
  assert.match(wrapper, /\[ValidateSet\('12','13','14','15'\)\]/);
  assert.match(wrapper, /\[ValidateSet\('verify','constraint_metadata'\)\]/);
  assert.match(wrapper, /\[string\]\$Baseline = '12'/);
  assert.match(wrapper, /\[string\]\$Mode = 'verify'/);
  assert.match(wrapper, /baseline=\$Baseline/);
  assert.match(wrapper, /mode=\$Mode/);
  assert.match(wrapper, /nonmutating_app_acl_catalog_membership_probe/);
  assert.match(wrapper, /six_functions_allowed/);
  assert.match(wrapper, /unmapped_subject_denied/);
  assert.match(worker, /'25006','42883','42703','42P01','42601','42702','42809','42704'/);
  assert.match(worker, /error\?\.code === '25006' \? 'query'/);
  assert.match(wrapper, /'25006','42883','42703','42P01','42601','42702','42809','42704'/);
  assert.ok(wrapper.indexOf('$verifySafeSqlState = if ($verifyOutput.sqlState') < wrapper.indexOf('$verifyOutput = $null'),
    'capture only allowlisted diagnostics before clearing the worker response');
  assert.match(wrapper, /\$verifyOutput = \$null/);
  assert.doesNotMatch(worker + wrapper, /read_only_app_acl_catalog_membership_probe/);
  assert.match(worker, /readOnly: false/);
  assert.match(wrapper, /Write-Host \(\$verifyKind \+ ' baseline ' \+ \$Baseline \+ ': ' \+/);
  assert.doesNotMatch(wrapper, /Write-Host[^\n]*(password|connectionText|rawError|exception\.Message)/i);
});

test('baselines 13 through 15 are explicit and retain the dormant NOLOGIN factor principal ACL boundary', () => {
  assert.match(worker, /const RECEIPTS_12 = Object\.freeze\(/);
  assert.match(worker, /baseline === '13' \? \[\.\.\.RECEIPTS_12, '0013_factor_service_principal'\]/);
  assert.match(worker, /baseline === '14'[\s\S]*'0014_factor_enrollment'/);
  assert.match(worker, /baseline === '15'[\s\S]*'0015_factor_enrollment_resume'/);
  assert.match(worker, /!\['12','13','14','15'\]\.includes\(baseline\)/);
  assert.match(worker, /Number\(baseline\)/);
  assert.match(worker, /baseline !== '12'/);
  assert.match(worker, /FACTOR_ROLES = Object\.freeze\(/);
  assert.match(worker, /groundbnb_local_factor_service/);
  assert.match(worker, /groundbnb_preview_factor_service/);
  assert.match(worker, /ordinary_app_creator_membership_exact/);
  assert.match(worker, /m\.member=r\.oid/);
  assert.match(worker, /owner_role\.rolname='neondb_owner'/);
  assert.match(worker, /grantor_role\.rolname='cloud_admin'/);
  assert.match(worker, /m\.admin_option IS TRUE AND m\.inherit_option IS FALSE AND m\.set_option IS FALSE/);
  assert.match(worker, /factor_principal_attributes/);
  assert.match(worker, /f\.rolcanlogin IS FALSE/);
  assert.match(worker, /factor_creator_membership_exact/);
  assert.match(worker, /m\.member=f\.oid/);
  assert.match(worker, /factor_five_functions/);
  assert.match(worker, /aclexplode\(COALESCE\(p\.proacl,acldefault\('f',p\.proowner\)\)\) acl WHERE acl\.grantee=f\.oid\)=5/);
  assert.match(worker, /factor_no_extra_functions/);
  assert.match(worker, /factor_no_data_privileges/);
  assert.match(worker, /factor_receipt_count/);
  assert.match(worker, /enrollment_base_constraints/);
  assert.match(worker, /enrollment_functions_private/);
  assert.match(worker, /enrollment_resume_constraints/);
  assert.match(worker, /factor_enrollment_operations_begin_operation_fk/);
  assert.match(worker, /factor_enrollment_operations_resume_begin_check/);
  assert.match(worker, /factor_enrollment_operations_operation_begin_key/);
  assert.match(worker, /factor_enrollment_operations_resume_check/);
  assert.match(worker, /factor_enrollment_operations_status_check/);
  assert.ok(worker.includes("lower(regexp_replace(pg_get_constraintdef(c.oid),'[[:space:]]+','','g'))"));
  assert.match(worker, /check\(\(\(operation_kind=''resume''::text\)and\(begin_operation_idisnotnull\)\)or\(\(operation_kind=any\(array\[''begin''::text,''verify''::text\]\)\)and\(begin_operation_idisnull\)\)\)/);
  assert.match(worker, /privileged_factor_audit_resume_operation_fk/);
  assert.match(worker, /privileged_factor_audit_resume_operation_check/);
  assert.match(worker, /c\.relrowsecurity IS TRUE AND c\.relforcerowsecurity IS FALSE/);
  assert.match(worker, /record_factor_enrollment_material_release\(text,text,text,timestamptz,uuid,uuid,uuid,uuid,bigint,text,bytea\)/);
  assert.match(worker, /read_factor_enrollment_material_receipt\(text,text,text,timestamptz,uuid,uuid,uuid,bigint,uuid\)/);
  assert.doesNotMatch(worker, /'groundbnb\.factor_enrollment_operations'::regclass/);
  assert.match(worker, /to_regclass\('groundbnb\.factor_enrollment_operations'\)/);
  assert.match(worker, /checks\.every\(key => row\[key\] === true\)/);
  assert.ok(worker.includes("${normalizedConstraintDef}='check((isfinite(created_at)andisfinite(completed_at)and(completed_at>=created_at)))')"));
  assert.ok(worker.includes("${normalizedConstraintDef}='check((operation_kind=any(array[''begin''::text,''verify''::text])))')"));
  assert.ok(worker.includes("${normalizedConstraintDef}='check((status=any(array[''pending''::text,''rejected''::text,''verified''::text])))')"));
  assert.ok(worker.includes("${normalizedConstraintDef}='check((((operation_kind=''begin''::text)and(status=''pending''::text))or((operation_kind=''verify''::text)and(status=any(array[''rejected''::text,''verified''::text])))))'"));
  assert.match(worker, /''verified''::text\]\)\)\)\)\)'\)\r?\n\s*ELSE/);
  assert.match(worker, /''released''::text\]\)\)\)\)'\)\r?\n\s*END/);
  assert.match(worker, /''attestation_revoked''::text\]\)\)\)'\)\)\)\)\) OR/);
  assert.match(worker, /mode === 'constraint_metadata'/);
  assert.match(worker, /!\['14','15'\]\.includes\(baseline\)/);
  assert.match(worker, /sql\.query\('SET TRANSACTION READ ONLY'\)/);
  assert.match(worker, /readOnly: true/);
  assert.match(worker, /phase = 'schema_metadata'[\s\S]*phase = 'factor_catalog'/);
  assert.match(wrapper, /'schema_metadata','factor_catalog'/);
  assert.match(worker, /checks: 'constraint_catalog_metadata_only'/);
  assert.match(worker, /definitions: metadataReady \? definitions : \[\]/);
  assert.match(worker, /pg_get_constraintdef\(c\.oid\) AS definition/);
  assert.match(worker, /n\.nspname \|\| '\.' \|\| rel\.relname AS table_name,c\.conname/);
  assert.match(worker, /const \[, rows\] = await sql\.transaction\([\s\S]*?phase = 'factor_catalog';[\s\S]*?const \[, factorCatalogRows\] = await sql\.transaction\(/);
  assert.match(worker, /constraintNames\.includes\(row\.conname\)/);
  assert.match(worker, /typeof value !== 'string' \|\| value\.length < 1 \|\| value\.length > 800/);
  assert.match(worker, /environment_identity e JOIN pg_constraint c/);
  assert.doesNotMatch(worker.slice(worker.indexOf("if (mode === 'constraint_metadata')"), worker.indexOf('} else {\n  const normalizedConstraintDef')),
    /neon_auth|groundbnb\.accounts|groundbnb\.read_membership|INSERT|UPDATE|DELETE|UPDATE/);
  assert.match(wrapper, /Constraint metadata withheld because pinned catalog checks did not pass/);
  assert.match(wrapper, /verifySafeMetadataJson = ConvertTo-Json -InputObject @\(\$verifyOutput\.definitions\)/);
  assert.match(worker, /factorCatalogSafe = factorCatalogRows\?\.length === 1/);
  assert.match(worker, /metadataReadOnly: true/);
  assert.match(worker, /metadataObservationOnly: true/);
  assert.match(worker, /database: 'groundbnb'/);
  assert.match(worker, /SAFE_ENROLLMENT_SQL_IDENTIFIERS = new Set/);
  assert.match(worker, /SAFE_ENROLLMENT_SQL_LITERALS = new Set/);
  assert.match(worker, /safeEnrollmentConstraintDefinition\(row\.definition\)/);
  assert.match(wrapper, /READ-ONLY CONSTRAINT METADATA \(not a boundary verification\)/);
  assert.match(wrapper, /verifyOutput\.metadataReadOnly -eq \$true/);
  assert.match(wrapper, /verifyOutput\.metadataObservationOnly -eq \$true/);
  assert.match(wrapper, /verifyOutput\.factorCatalog\.noDirectTablePrivileges -eq \$true/);
  assert.match(wrapper, /if \(\$Mode -eq 'constraint_metadata' -and \$Baseline -notin @\('14','15'\)\)/);
  assert.match(factorCatalog, /CASE WHEN c\.relkind IN \('r','p','v','m','f'\) THEN\s+has_table_privilege\([\s\S]*?ELSE false END/);
  assert.match(factorCatalog, /CASE WHEN c\.relkind IN \('r','p','v','m','f'\) THEN\s+has_any_column_privilege\([\s\S]*?ELSE false END/);
  assert.match(factorCatalog, /CASE WHEN c\.relkind='S' THEN has_sequence_privilege\([\s\S]*?ELSE false END/);
  assert.equal((readFileSync(new URL('./expanded-app-boundary-worker.test.mjs', import.meta.url), 'utf8').match(/\btest\(/g) ?? []).length, 5,
    'extend existing coverage without adding test cases');
  assert.match(wrapper, /factor_creator_membership_exact/);
  assert.match(wrapper, /\[ValidateSet\('12','13','14','15'\)\]/);
  assert.match(wrapper, /\$verifyOutput\.baseline -eq \$Baseline/);
  assert.doesNotMatch(worker, /result\s*:=\s*groundbnb\./i);
});
