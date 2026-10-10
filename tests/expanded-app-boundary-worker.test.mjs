import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const worker = readFileSync(new URL('../scripts/verify-m1-expanded-app-boundary.mjs', import.meta.url), 'utf8');
const wrapper = readFileSync(new URL('../scripts/verify-m1-expanded-app-boundary.ps1', import.meta.url), 'utf8');

const approvedFunctions = [
  'groundbnb.read_profile(text,text)',
  'groundbnb.save_profile(text,text,uuid,bigint,jsonb)',
  'groundbnb.read_profile_operation(text,text,uuid)',
  'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)',
  'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)',
  'groundbnb.read_membership(text,text)',
];

test('worker pins the six ordinary app functions and denies all other ordinary Groundbnb functions', () => {
  for (const signature of approvedFunctions) {
    assert.ok(worker.includes(`has_function_privilege(r.oid,'${signature}','EXECUTE')`) ||
      worker.includes(`to_regprocedure('${signature}')`), `missing exact function check: ${signature}`);
    assert.ok(worker.includes(`to_regprocedure('${signature}')`), `not excluded from extra-function denial: ${signature}`);
  }
  assert.match(worker, /AS six_functions_allowed/);
  assert.match(worker, /AS no_extra_functions/);
  assert.match(worker, /p\.prorettype NOT IN \('trigger'::regtype,'event_trigger'::regtype\)/);
  assert.match(worker, /const commonChecks = \['attributes_safe','metadata_select_only','private_tables_denied','sequences_denied'/);
  assert.match(worker, /'six_functions_allowed','no_extra_functions','create_denied','unmapped_subject_denied'/);
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
  assert.match(worker, /sql\.query\('SET TRANSACTION READ WRITE'\),\s*sql\.query\(query, \[issuer, UNMAPPED_SUBJECT, factorRole\]\)/);
  assert.match(worker, /const \[, rows\] = await sql\.transaction\(/);
  assert.match(worker, /readOnly: false/);
  assert.match(worker, /AbortSignal\.timeout\(10000\)/);
});

test('membership probe is parameterized to the exact pinned issuer and a fixed unmapped synthetic subject', () => {
  assert.match(worker, /const MEMBERSHIP_PROBE_ISSUERS = Object\.freeze\(/);
  assert.match(worker, /local: 'https:\/\/ep-calm-sound-b8s8ckur\.neonauth\.c-14\.us-east-1\.aws\.neon\.tech\/groundbnb\/auth'/);
  assert.match(worker, /preview: 'https:\/\/ep-red-night-b8pf2mdl\.neonauth\.c-14\.us-east-1\.aws\.neon\.tech\/groundbnb\/auth'/);
  assert.match(worker, /const UNMAPPED_SUBJECT = 'm1-q011-unmapped-subject-boundary-probe'/);
  assert.match(worker, /groundbnb\.read_membership\(\$1,\$2\)=jsonb_build_object\('ok',false,'category','auth'\)/);
  assert.match(worker, /sql\.query\(query, \[issuer, UNMAPPED_SUBJECT, factorRole\]\)/);
  assert.doesNotMatch(worker, /groundbnb\.accounts|neon_auth\."user"|account_uuid|synthetic-user-[0-9]/);
});

test('PowerShell wrapper reuses only the pinned CurrentUser DPAPI bindings and prints sanitized results', () => {
  assert.match(wrapper, /\.env\.m1-profile-\$verifyKind\.dpapi/);
  assert.match(wrapper, /DataProtectionScope\]::CurrentUser/);
  assert.match(wrapper, /\[ValidateSet\('12','13'\)\]/);
  assert.match(wrapper, /\[string\]\$Baseline = '12'/);
  assert.match(wrapper, /baseline=\$Baseline/);
  assert.match(wrapper, /nonmutating_app_acl_catalog_membership_probe/);
  assert.match(wrapper, /six_functions_allowed/);
  assert.match(wrapper, /unmapped_subject_denied/);
  assert.match(worker, /'25006','42883','42703','42P01','42601','42702','42809','42704'/);
  assert.match(worker, /error\?\.code === '25006' \? 'query'/);
  assert.match(wrapper, /'25006','42883','42703','42P01','42601','42702','42809','42704'/);
  assert.ok(wrapper.indexOf('$verifySafeSqlState = if ($verifyOutput.sqlState') < wrapper.indexOf('$verifyOutput = $null'),
    'capture only allowlisted diagnostics before clearing the worker response');
  assert.match(wrapper, /\$verifyOutput = \$null/);
  assert.doesNotMatch(worker + wrapper, /read_only_app_acl_catalog_membership_probe|readOnly: true/);
  assert.match(wrapper, /Write-Host \(\$verifyKind \+ ' baseline ' \+ \$Baseline \+ ': ' \+/);
  assert.doesNotMatch(wrapper, /Write-Host[^\n]*(password|connectionText|rawError|exception\.Message)/i);
});

test('baseline 13 is explicit and checks only the dormant NOLOGIN factor principal ACL boundary', () => {
  assert.match(worker, /const RECEIPTS_12 = Object\.freeze\(/);
  assert.match(worker, /baseline === '13' \? \[\.\.\.RECEIPTS_12, '0013_factor_service_principal'\]/);
  assert.match(worker, /baseline === '13' \? 13 : 12/);
  assert.match(worker, /FACTOR_ROLES = Object\.freeze\(/);
  assert.match(worker, /groundbnb_local_factor_service/);
  assert.match(worker, /groundbnb_preview_factor_service/);
  assert.match(worker, /factor_principal_attributes/);
  assert.match(worker, /f\.rolcanlogin IS FALSE/);
  assert.match(worker, /factor_principal_unmembered/);
  assert.match(worker, /m\.member=f\.oid OR m\.roleid=f\.oid/);
  assert.match(worker, /factor_five_functions/);
  assert.match(worker, /factor_no_extra_functions/);
  assert.match(worker, /factor_no_data_privileges/);
  assert.match(worker, /factor_receipt_count/);
  assert.match(worker, /checks\.every\(key => row\[key\] === true\)/);
  assert.match(wrapper, /factor_principal_unmembered/);
  assert.match(wrapper, /\$verifyOutput\.baseline -eq \$Baseline/);
  assert.doesNotMatch(worker, /result\s*:=\s*groundbnb\./i);
});
