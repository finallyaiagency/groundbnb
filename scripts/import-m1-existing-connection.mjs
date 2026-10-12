// Private child process: stdout is consumed only by the PowerShell DPAPI wrapper.
import { readFileSync } from 'node:fs';
import { privateDecrypt, constants } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PROFILE_TARGETS } from '../lib/profile-persistence.mjs';
let raw = '';
let result = { ok: false, phase: 'input' };
try {
  for await (const chunk of process.stdin) { raw += chunk; if (raw.length > 20000) throw Error(); }
  const { kind, privateKey } = JSON.parse(raw); raw = '';
  const target = PROFILE_TARGETS[kind];
  if (!target || typeof privateKey !== 'string') throw Error();
  const encrypted = readFileSync(new URL(`../.tmp/evidence/m1-profile-${kind}.encrypted`, import.meta.url));
  const urlText = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, encrypted).toString('utf8');
  const url = new URL(urlText);
  if (url.protocol !== 'postgresql:' || url.hostname !== target.host || url.username !== target.role ||
      url.pathname !== '/groundbnb' || url.port || url.hash || !url.password || url.password.includes('*') ||
      url.searchParams.get('sslmode') !== 'require' || url.searchParams.get('channel_binding') !== 'require' ||
      [...url.searchParams.keys()].some(x => !['sslmode','channel_binding'].includes(x))) throw Error();
  const checked = spawnSync(process.execPath, [fileURLToPath(new URL('./verify-m1-profile-credential.mjs', import.meta.url))], {
    input: JSON.stringify({ kind, password: decodeURIComponent(url.password) }), encoding: 'utf8', timeout: 25000, windowsHide: true,
    maxBuffer: 8192,
  });
  const check = JSON.parse(checked.stdout);
  result = checked.status === 0 && check.ok === true ? { ok: true, kind, url: url.href } :
    { ok: false, kind, phase: ['input','connection','result'].includes(check.phase) ? check.phase : 'worker',
      category: ['auth','permission','timeout','network','catalog','input','unknown'].includes(check.category) ? check.category : 'unknown' };
} catch { /* No secret-bearing error reaches stdout/stderr. */ }
process.stdout.write(JSON.stringify(result));
process.exitCode = result.ok ? 0 : 1;
