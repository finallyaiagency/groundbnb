import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const helper = await readFile(new URL('../scripts/m1-browser-acceptance-window.ps1', import.meta.url), 'utf8');
const packet = await readFile(new URL('../docs/tasks/M1-01Z-browser-acceptance-window.md', import.meta.url), 'utf8');
const recordsPacket = await readFile(new URL('../docs/tasks/M1-01AB-profile-records-transfer-browser.md', import.meta.url), 'utf8');
const capture = await readFile(new URL('../scripts/capture-m1-browser-otp.mjs', import.meta.url), 'utf8');
const proxy = await readFile(new URL('../scripts/m1-profile-response-loss.mjs', import.meta.url), 'utf8');

test('browser window helper uses a unique run record and protected per-run restore backup', () => {
  assert.match(helper, /ValidateSet\('Prepare','AdmitSend','Capture','Close'\)/);
  assert.match(helper, /\[Guid\]::NewGuid\(\)\.ToString\('N'\)/);
  assert.match(helper, /m1-browser-runs/);
  assert.match(helper, /env-before\.dpapi/);
  assert.match(helper, /run-integrity\.dpapi/);
  assert.match(helper, /DataProtectionScope\]::CurrentUser/);
  assert.match(helper, /FileMode\]::CreateNew/);
  assert.match(helper, /CryptographicOperations|hashDifference/);
  assert.match(helper, /maxOtpRequests=1/);
  assert.match(helper, /AddMinutes\(30\)/);
  assert.doesNotMatch(helper, /m1-01e-browser-attempt\.json|m1-01e-browser-send-admitted|m1-01e-browser-diagnostic-admitted/);
});

test('only the local synthetic fixture is configured and background/metered work stays disabled', () => {
  assert.match(helper, /local-01@example\.test/);
  assert.match(helper, /GROUND_DATABASE_BRANCH_ID='br-rough-flower-b8lerkcf'/);
  assert.match(helper, /GROUND_PUBLIC_ORIGIN='http:\/\/localhost:3000'/);
  assert.match(helper, /GROUND_METERED_DISPATCH='off'/);
  assert.match(helper, /GROUND_SCHEDULED_WORK='off'/);
  assert.match(helper, /GROUND_BROWSER_AUTH_MODE='synthetic'/);
  assert.match(helper, /GROUND_PROFILE_DOMAIN_MODE='full-v1'/);
  assert.match(helper, /GROUND_PROFILE_RECORDS_MODE='manual-v1'/);
  assert.match(helper, /GROUND_PROFILE_TRANSFER_MODE='reviewed-v1'/);
  assert.match(helper, /profileDomainMode='full-v1'/);
  assert.match(helper, /recordsMode='manual-v1'/);
  assert.match(helper, /transferMode='reviewed-v1'/);
  assert.match(helper, /\$expandedModes=\(\$record\.recordsMode -eq 'manual-v1' -and \$record\.transferMode -eq 'reviewed-v1'\)/);
  assert.match(helper, /\$legacyModes=\(-not \$hasRecordsMode -and -not \$hasTransferMode\)/);
  assert.match(helper, /\(-not \(\$legacyModes -or \$expandedModes\)\)/);
  assert.match(helper, /GROUND_BROWSER_AUTH_RUN_ID=\$browserRun/);
  assert.match(helper, /An existing browser window must be closed/);
  assert.match(helper, /The local environment does not match this run ID/);
});

test('send and capture markers are one-use and code capture is encrypted and per-run', () => {
  assert.match(helper, /send-admitted\.json/);
  assert.match(helper, /The one send admission was already used/);
  assert.match(helper, /capture-started\.json/);
  assert.match(helper, /capture-completed\.json/);
  assert.match(helper, /capture-m1-browser-otp\.mjs/);
  assert.match(helper, /public\.pem/);
  assert.match(helper, /outputPath=\(Join-Path '\.tmp\/evidence\/m1-browser-runs'/);
  assert.match(capture, /const \{ account, sentAt, publicKey, runId, outputPath \}/);
  assert.match(capture, /m1-browser-runs/);
  assert.match(capture, /writeFile\(target, encrypted, \{ flag: 'wx' \}\)/);
  assert.match(capture, /m1-browser-code\.encrypted/);
  assert.match(helper, /code\.encrypted/);
  assert.match(helper, /code value suppressed/);
  assert.match(helper, /details suppressed/);
  assert.match(helper, /GROUND_BROWSER_AUTH_UNTIL/);
  assert.match(packet, /counter is process-local/);
  assert.match(packet, /do not restart the app after admitting a send/);
});

test('close restores only its matching run and preserves attempt history', () => {
  assert.match(helper, /The local environment does not match this run ID/);
  assert.match(helper, /Write-ExclusiveUtf8 \(Join-Path \$browserRunDir 'closed\.json'\)/);
  assert.match(helper, /Remove-Item -LiteralPath \$browserBackup/);
  assert.doesNotMatch(helper, /Remove-Item[^\r\n]*(?:run\.json|send-admitted|capture-started|capture-completed|code\.encrypted)/);
  assert.match(packet, /markers are left in place/);
});

test('packet specifies same-origin loopback production proxy and explicit replay acceptance', () => {
  assert.match(packet, /127\.0\.0\.1:3001/);
  assert.match(packet, /127\.0\.0\.1:3000/);
  assert.match(packet, /http:\/\/localhost:3000/);
  assert.match(packet, /Preserve browser `Origin` and `Cookie`/);
  assert.match(packet, /host-only `Set-Cookie`/);
  assert.match(packet, /first successful 200 response and drops the browser connection once/);
  assert.match(packet, /status acknowledgment must match the original operation ID, account binding, revision, and savedAt/);
  assert.match(packet, /without a PATCH replay/);
  assert.match(packet, /legacy fixed M1-01E path remains unchanged/);
  assert.match(proxy, /--run-record/);
  assert.match(proxy, /validatePerRunRecordPath/);
  assert.match(packet, /HMR was a hypothesis, not an established cause/);
  assert.match(packet, /No M1 exit or M2 handoff follows/);
});

test('records and transfer browser packet is separate, bounded, and mode-gated', () => {
  assert.match(recordsPacket, /Status: Implemented locally; acceptance preparation only/);
  assert.match(recordsPacket, /existing continuation authorization/);
  assert.match(recordsPacket, /recordsMode=manual-v1/);
  assert.match(recordsPacket, /transferMode=reviewed-v1/);
  assert.match(recordsPacket, /one OTP request/);
  assert.match(recordsPacket, /maximum 30-minute window/);
  assert.match(recordsPacket, /scheduled\/metered dispatch off/);
  assert.match(recordsPacket, /Stop without mutation unless GET reports/);
  assert.match(recordsPacket, /Tombstone behavior/);
  assert.match(recordsPacket, /Revision conflict/);
  assert.match(recordsPacket, /Selective native import/);
  assert.match(recordsPacket, /does not add a deliberate response-loss injection/);
  assert.match(recordsPacket, /does not close M1-01E's full replay\/logout, preview, or second-account gates/);
});
