import { neon } from '@neondatabase/serverless';
import { factorCredentialCatalogQuery } from '../lib/factor-credential-catalog.mjs';

const FACTOR_TARGETS = Object.freeze({
  local: Object.freeze({
    host: 'ep-calm-sound-b8s8ckur-pooler.c-14.us-east-1.aws.neon.tech',
    branch: 'br-rough-flower-b8lerkcf',
    role: 'groundbnb_local_factor_service',
  }),
  preview: Object.freeze({
    host: 'ep-red-night-b8pf2mdl-pooler.c-14.us-east-1.aws.neon.tech',
    branch: 'br-bitter-hall-b8ibnrfy',
    role: 'groundbnb_preview_factor_service',
  }),
});

let input = '';
let phase = 'input';
let result = { ok: false, phase, category: 'input' };
let request = null;
let password = '';
let target = null;
let url = null;
let sql = null;

try {
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input, 'utf8') > 4096) throw new Error();
  }

  request = JSON.parse(input);
  input = '';
  if (request === null || typeof request !== 'object' || Array.isArray(request) ||
      Object.keys(request).length !== 2 || !Object.hasOwn(request, 'kind') || !Object.hasOwn(request, 'password')) {
    throw new Error();
  }
  const { kind } = request;
  password = request.password;
  request.password = '';
  target = typeof kind === 'string' && Object.hasOwn(FACTOR_TARGETS, kind) ? FACTOR_TARGETS[kind] : null;
  if (!target || typeof password !== 'string' || password.length < 24 || password.length > 2048 || /[\0\r\n]/.test(password)) {
    throw new Error();
  }

  url = new URL(`postgresql://${target.host}/groundbnb?sslmode=require&channel_binding=require`);
  url.username = target.role;
  url.password = password;
  password = '';
  phase = 'connection';
  sql = neon(url.href);
  url.password = '';

  const query = factorCredentialCatalogQuery(true);

  phase = 'catalog';
  const [rows] = await sql.transaction([sql.query(query, [target.role])], {
    readOnly: true,
    fetchOptions: { signal: AbortSignal.timeout(10000), cache: 'no-store' },
  });
  const row = rows?.[0];
  const checks = [
    'role_attributes_safe','creator_membership_exact','database_schema_boundary',
    'effective_function_set_exact','function_acl_exact','synthetic_seed_trigger_exact',
    'no_direct_table_privileges','no_sequence_privileges',
  ];
  phase = 'result';
  const ok = rows?.length === 1 && row.database_name === 'groundbnb' && row.role_name === target.role &&
    row.connected_role === target.role &&
    checks.every(key => row[key] === true);
  result = {
    kind, role: target.role, branchId: target.branch, ok,
    phase: ok ? 'complete' : 'result',
    category: ok ? undefined : 'catalog',
    checks: ok ? 'factor_credential_catalog_boundary' : 'failed',
  };
} catch (error) {
  const category = phase === 'input' ? 'input' : error?.code === '28P01' ? 'auth' :
    error?.code === '42501' ? 'permission' : error?.name === 'TimeoutError' ? 'timeout' :
      ['ENOTFOUND','ECONNREFUSED','ETIMEDOUT'].includes(error?.cause?.code) ? 'network' : 'unknown';
  result = { ok: false, phase, category };
} finally {
  input = '';
  password = '';
  if (request && typeof request === 'object') request.password = '';
  request = null;
  if (url) url.password = '';
  url = null;
  sql = null;
  target = null;
}

process.stdout.write(JSON.stringify(result));
process.exitCode = result.ok ? 0 : 1;
