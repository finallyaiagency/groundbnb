import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { createResponseLossHandler, parseArguments, validateAttemptEvidence, validatePerRunRecordPath } from '../scripts/m1-profile-response-loss.mjs';

const now = Date.parse('2026-10-08T01:40:00.000Z');
const ack = (operationId, revision = 1, savedAt = '2026-10-08T01:39:00.000Z') => Buffer.from(JSON.stringify({
  ok: true, operationId, savedAt, profile: { revision },
}));
const makeRequest = (method, url, body = '', headers = {}) => Object.assign(Readable.from(
  body ? [Buffer.from(body)] : [],
), { method, url, headers: { host: 'localhost:3000', ...headers } });
class TestResponse extends Writable {
  constructor() {
    super();
    this.statusCode = null;
    this.headers = null;
    this.chunks = [];
  }
  writeHead(statusCode, headers) { this.statusCode = statusCode; this.headers = headers; }
  _write(chunk, _encoding, callback) { this.chunks.push(Buffer.from(chunk)); callback(); }
  get body() { return Buffer.concat(this.chunks); }
}
const makeResponse = () => new TestResponse();

test('drops exactly the first successful profile acknowledgment, then matches explicit replay metadata', async () => {
  const operationId = '00000000-0000-4000-8000-000000000001';
  const body = JSON.stringify({ operationId, expectedRevision: 0,
    patch: { hasPets: { value: false, answered: true } } });
  const events = [];
  let calls = 0;
  const handler = createResponseLossHandler({ expiresAt: now + 60_000, now: () => now,
    emit: (event) => events.push(event),
    forward: async (request) => {
      calls++;
      assert.equal(request.method, 'PATCH');
      assert.equal(request.target, '/api/account/profile');
      if (calls <= 2) {
        assert.equal(request.headers.origin, 'http://localhost:3000');
        assert.equal(request.headers.cookie, 'groundbnb_local_session=synthetic-cookie');
        assert.equal(request.body.toString(), body);
      }
      const currentOperationId = JSON.parse(request.body.toString()).operationId;
      return { statusCode: 200, headers: { 'content-type': 'application/json' },
        body: ack(currentOperationId, calls === 3 ? 2 : 1) };
    },
  });

  const dropped = makeResponse();
  await handler(makeRequest('PATCH', '/api/account/profile', body, {
    origin: 'http://localhost:3000', cookie: 'groundbnb_local_session=synthetic-cookie',
  }), dropped);
  assert.equal(dropped.destroyed, true);
  assert.equal(dropped.statusCode, null);
  assert.equal(calls, 1);
  assert.deepEqual(events[0], {
    event: 'profile_response_loss', dropCount: 1, status: 200,
    operationIdHash: '11e594f481958c10e3015d0bf0447a22f068a8a647f475df15ce2c7ab4b8f3f1',
    revision: 1, savedAt: '2026-10-08T01:39:00.000Z', replayEquality: 'pending',
  });
  assert.equal(JSON.stringify(events).includes(operationId), false);
  assert.equal(JSON.stringify(events).includes('synthetic-cookie'), false);

  const replayed = makeResponse();
  await handler(makeRequest('PATCH', '/api/account/profile', body, {
    cookie: 'groundbnb_local_session=synthetic-cookie', origin: 'http://localhost:3000',
  }), replayed);
  assert.equal(replayed.statusCode, 200);
  assert.equal(JSON.parse(replayed.body).operationId, operationId);
  assert.equal(calls, 2);
  assert.equal(events[1].replayEquality, 'pass');
  assert.equal(events[1].operationIdHash, events[0].operationIdHash);
  assert.equal(events[1].revision, events[0].revision);
  assert.equal(events[1].savedAt, events[0].savedAt);
  assert.equal(JSON.stringify(events).includes(operationId), false);

  const later = makeResponse();
  const laterOperation = JSON.stringify({ operationId: '00000000-0000-4000-8000-000000000002', expectedRevision: 1, patch: {} });
  await handler(makeRequest('PATCH', '/api/account/profile', laterOperation), later);
  assert.equal(later.statusCode, 200);
  assert.equal(later.destroyed, false);
  assert.equal(calls, 3);
  assert.equal(events.filter((event) => event.event === 'profile_response_loss').length, 1);
});

test('records a replay mismatch without hiding its normal response', async () => {
  const operationId = '00000000-0000-4000-8000-000000000003';
  const body = JSON.stringify({ operationId, expectedRevision: 0, patch: {} });
  const events = [];
  let calls = 0;
  const handler = createResponseLossHandler({ expiresAt: now + 60_000, now: () => now,
    emit: (event) => events.push(event),
    forward: async () => ({ statusCode: 200, headers: {}, body: ack(operationId, ++calls) }),
  });
  const first = makeResponse();
  await handler(makeRequest('PATCH', '/api/account/profile', body), first);
  const retry = makeResponse();
  await handler(makeRequest('PATCH', '/api/account/profile', body), retry);
  assert.equal(first.destroyed, true);
  assert.equal(retry.statusCode, 200);
  assert.equal(events[1].replayEquality, 'mismatch');
});

test('proxies other paths unchanged, streams large static responses, and bounds API bodies', async () => {
  const events = [];
  let calls = 0;
  let streamedResponse;
  let staticChunksReceivedBeforeEnd = false;
  const handler = createResponseLossHandler({ expiresAt: now + 60_000, now: () => now,
    emit: (event) => events.push(event),
    forward: async (request) => {
      calls++;
      if (request.target === '/api/too-large-response') {
        return { statusCode: 200, headers: { 'content-type': 'text/plain' },
          body: Readable.from([Buffer.alloc(20 * 1024, 65), Buffer.alloc(20 * 1024, 66)]) };
      }
      if (request.target === '/_next/static/app.js') {
        const parts = [Buffer.alloc(80 * 1024, 65), Buffer.alloc(80 * 1024, 66), Buffer.alloc(80 * 1024, 67)];
        const stream = Readable.from((async function* () {
          yield parts[0];
          await new Promise((resolve) => setImmediate(resolve));
          staticChunksReceivedBeforeEnd = streamedResponse.chunks.length > 0;
          yield parts[1];
          yield parts[2];
        })());
        return { statusCode: 200, headers: { 'content-type': 'application/javascript', 'content-length': String(240 * 1024) }, body: stream };
      }
      return { statusCode: 200, headers: { 'content-type': 'application/json', 'set-cookie': ['app=synthetic'] },
        body: Buffer.from(JSON.stringify({ authenticated: true })) };
    },
  });

  const normal = makeResponse();
  await handler(makeRequest('GET', '/api/account/session', '', { cookie: 'groundbnb_local_session=x' }), normal);
  assert.equal(normal.statusCode, 200);
  assert.equal(normal.body.toString(), JSON.stringify({ authenticated: true }));
  assert.deepEqual(normal.headers['set-cookie'], ['app=synthetic']);

  const oversizedRequest = makeResponse();
  await handler(makeRequest('POST', '/large-request', 'x'.repeat(16 * 1024 + 1)), oversizedRequest);
  assert.equal(oversizedRequest.statusCode, 413);
  assert.equal(oversizedRequest.headers['Cache-Control'], 'no-store, private');
  assert.equal(calls, 1);

  const oversizedResponse = makeResponse();
  await handler(makeRequest('GET', '/api/too-large-response'), oversizedResponse);
  assert.equal(oversizedResponse.statusCode, 502);
  assert.equal(oversizedResponse.headers['Cache-Control'], 'no-store, private');
  assert.equal(oversizedResponse.body.toString().includes('AAAA'), false);
  assert.equal(calls, 2);
  assert.equal(events.length, 0);

  streamedResponse = makeResponse();
  await handler(makeRequest('GET', '/_next/static/app.js'), streamedResponse);
  assert.equal(streamedResponse.statusCode, 200);
  assert.equal(streamedResponse.body.length, 240 * 1024);
  assert.equal(staticChunksReceivedBeforeEnd, true);
  assert.equal(calls, 3);
});

test('expired run refuses requests without forwarding or extending the recorded window', async () => {
  let calls = 0;
  const handler = createResponseLossHandler({ expiresAt: now, now: () => now,
    forward: async () => { calls++; throw new Error('not reached'); }, emit() {},
  });
  const response = makeResponse();
  await handler(makeRequest('GET', '/'), response);
  assert.equal(response.statusCode, 410);
  assert.equal(response.headers['Cache-Control'], 'no-store, private');
  assert.equal(calls, 0);
});

test('accepts a BOM-prefixed attempt record only when run ID and expiry exactly match', () => {
  const record = JSON.stringify({ runId: 'run-12345678', startedAtUtc: '2026-10-08T01:20:00.000Z',
    expiresAtUtc: '2026-10-08T01:50:00.000Z', fixture: 'local-01@example.test', profileMode: 'enabled' });
  assert.deepEqual(validateAttemptEvidence(`\uFEFF${record}`, 'run-12345678', '2026-10-08T01:50:00.000Z', now),
    { expiresAt: Date.parse('2026-10-08T01:50:00.000Z') });
  assert.equal(validateAttemptEvidence(`\uFEFF${record}`, 'run-12345678', '2026-10-08T01:51:00.000Z', now), null);
});

test('per-run record loader accepts only the exact isolated record path with one-OTP metadata', async () => {
  const runId = randomUUID().replaceAll('-', '');
  const runsRoot = resolve(fileURLToPath(new URL('../.tmp/evidence/m1-browser-runs/', import.meta.url)));
  const runDir = resolve(runsRoot, runId);
  if (!runDir.startsWith(`${runsRoot}${sep}`)) throw new Error('Test run directory escaped its evidence root.');
  const recordFile = resolve(runDir, 'run.json');
  const integrityFile = resolve(runDir, 'run-integrity.dpapi');
  const until = '2026-10-08T01:50:00.000Z';
  const record = JSON.stringify({ runId, startedAtUtc: '2026-10-08T01:20:00.000Z', expiresAtUtc: until,
    fixture: 'local-01@example.test', profileMode: 'enabled', profileDomainMode: 'full-v1', maxOtpRequests: 1 });
  try {
    await mkdir(runDir, { recursive: true });
    await writeFile(recordFile, record, { flag: 'wx' });
    await writeFile(integrityFile, Buffer.from('synthetic-seal-placeholder'), { flag: 'wx' });
    const path = await validatePerRunRecordPath(recordFile, runId);
    assert.equal(path, resolve(recordFile));
    assert.deepEqual(validateAttemptEvidence(`\uFEFF${record}`, runId, until, now, { singleOtp: true }),
      { expiresAt: Date.parse(until) });
    assert.equal(await validatePerRunRecordPath(resolve(runDir, '..', 'run.json'), runId), null);
    assert.equal(await validatePerRunRecordPath(recordFile, `${runId}x`), null);
    assert.equal(validateAttemptEvidence(record.replace('"maxOtpRequests":1', '"maxOtpRequests":2'), runId, until, now,
      { singleOtp: true }), null);
  } finally {
    if (runDir !== resolve(runsRoot, runId) || !runDir.startsWith(`${runsRoot}${sep}`)) {
      throw new Error('Refusing to remove a test directory outside its evidence root.');
    }
    await rm(runDir, { recursive: true, force: true });
  }
});

test('proxy arguments preserve the legacy default while allowing one explicit per-run record', () => {
  assert.deepEqual(parseArguments(['--run-id', 'run-12345678', '--until', '2026-10-08T01:50:00.000Z']), {
    runId: 'run-12345678', untilText: '2026-10-08T01:50:00.000Z', runRecordPath: null,
  });
  assert.deepEqual(parseArguments(['--run-id', '0123456789abcdef0123456789abcdef', '--until', '2026-10-08T01:50:00.000Z',
    '--run-record', '.tmp/evidence/m1-browser-runs/0123456789abcdef0123456789abcdef/run.json']), {
    runId: '0123456789abcdef0123456789abcdef', untilText: '2026-10-08T01:50:00.000Z',
    runRecordPath: '.tmp/evidence/m1-browser-runs/0123456789abcdef0123456789abcdef/run.json',
  });
  assert.equal(parseArguments(['--run-id', 'run-12345678', '--until', 'x', '--run-id', 'again']), null);
});
