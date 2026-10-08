import { createHash } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE = resolve(ROOT, '.tmp/evidence/m1-01e-browser-attempt.json');
const LOOPBACK = '127.0.0.1';
const PROXY_PORT = 3000;
const APP_PORT = 3001;
const REQUEST_LIMIT = 16 * 1024;
const RESPONSE_LIMIT = 32 * 1024;
const UPSTREAM_TIMEOUT_MS = 30_000;
const NO_STORE = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' };

const operationHash = (value) => createHash('sha256').update(value).digest('hex');
const safeEmit = (emit, event) => {
  try { emit(event); } catch { /* diagnostics must not affect proxying */ }
};

function readProfileAck(body) {
  try {
    const value = JSON.parse(body.toString('utf8'));
    const operationId = value?.operationId;
    const revision = value?.profile?.revision;
    const savedAt = value?.savedAt;
    if (typeof operationId !== 'string' || !operationId || !Number.isSafeInteger(revision) || revision < 0 ||
        typeof savedAt !== 'string' || !Number.isFinite(Date.parse(savedAt))) return null;
    const idHash = operationHash(operationId);
    return { operationIdHash: idHash, revision, savedAt,
      acknowledgmentHash: operationHash(`${idHash}\0${revision}\0${savedAt}`) };
  } catch { return null; }
}

function readRequestOperationHash(method, target, body) {
  if (method !== 'PATCH' || target.split('?', 1)[0] !== '/api/account/profile') return null;
  try {
    const value = JSON.parse(body.toString('utf8'));
    return typeof value?.operationId === 'string' && value.operationId
      ? operationHash(value.operationId) : null;
  } catch { return null; }
}

async function boundedRequestBody(request) {
  const chunks = [];
  let size = 0;
  let oversized = false;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > REQUEST_LIMIT) {
      oversized = true;
      chunks.length = 0;
    } else if (!oversized) chunks.push(chunk);
  }
  return oversized ? null : Buffer.concat(chunks);
}

async function boundedResponseBody(upstream) {
  if (Buffer.isBuffer(upstream.body) || upstream.body instanceof Uint8Array) {
    const body = Buffer.from(upstream.body);
    return body.length > RESPONSE_LIMIT ? null : body;
  }
  if (!upstream.body) return Buffer.alloc(0);
  const chunks = [];
  let size = 0;
  for await (const chunk of upstream.body) {
    size += chunk.length;
    if (size > RESPONSE_LIMIT) {
      upstream.body.destroy?.();
      return null;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function streamResponseBody(upstream, response) {
  if (Buffer.isBuffer(upstream.body) || upstream.body instanceof Uint8Array) {
    response.end(upstream.body);
    return Promise.resolve();
  }
  if (!upstream.body) {
    response.end();
    return Promise.resolve();
  }
  return new Promise((resolvePromise) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolvePromise();
    };
    upstream.body.once('error', () => {
      response.destroy();
      finish();
    });
    response.once('finish', finish);
    response.once('close', () => {
      if (!response.writableFinished) upstream.body.destroy?.();
      finish();
    });
    upstream.body.pipe(response);
  });
}

function safeResponse(response, status, body) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { ...NO_STORE, 'Content-Type': 'application/json; charset=utf-8', Connection: 'close' });
  response.end(JSON.stringify(body));
}

function forwardedRequestHeaders(headers) {
  const result = { ...headers };
  for (const key of ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te',
    'trailer', 'transfer-encoding', 'upgrade', 'host']) delete result[key];
  result.host = `localhost:${APP_PORT}`;
  result['x-forwarded-host'] = 'localhost:3000';
  result['x-forwarded-proto'] = 'http';
  return result;
}

function forwardedResponseHeaders(headers) {
  const result = { ...headers };
  for (const key of ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te',
    'trailer', 'transfer-encoding', 'upgrade']) delete result[key];
  return result;
}

function forwardToLocalApp({ method, target, headers, body }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const request = httpRequest({
      hostname: LOOPBACK, port: APP_PORT, method, path: target,
      headers: forwardedRequestHeaders(headers), agent: false,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    }, (response) => resolvePromise({
      statusCode: response.statusCode ?? 502,
      headers: response.headers,
      body: response,
    }));
    request.once('error', rejectPromise);
    request.end(body);
  });
}

export function createResponseLossHandler({ expiresAt, forward, now = Date.now, emit = (event) => console.log(JSON.stringify(event)) }) {
  if (!Number.isFinite(expiresAt) || typeof forward !== 'function') throw new TypeError('Invalid local proxy configuration.');
  const state = { dropCount: 0, firstAck: null, replayObserved: false };

  return async function handle(request, response) {
    if (now() >= expiresAt) return safeResponse(response, 410, { ok: false });
    if (typeof request.url !== 'string' || !request.url.startsWith('/') || request.url.startsWith('//') ||
        !['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(request.method)) {
      return safeResponse(response, 400, { ok: false });
    }

    let body;
    try { body = await boundedRequestBody(request); }
    catch { return safeResponse(response, 400, { ok: false }); }
    if (body === null) return safeResponse(response, 413, { ok: false });

    const requestOperationIdHash = readRequestOperationHash(request.method, request.url, body);
    let upstream;
    try {
      upstream = await forward({ method: request.method, target: request.url, headers: request.headers, body });
      if (!upstream || !Number.isInteger(upstream.statusCode) || upstream.statusCode < 100 || upstream.statusCode > 599) {
        return safeResponse(response, 502, { ok: false });
      }
    } catch {
      return safeResponse(response, 502, { ok: false });
    }

    const path = request.url.split('?', 1)[0];
    const profilePatch = request.method === 'PATCH' && path === '/api/account/profile';
    if (!path.startsWith('/api/')) {
      if (response.destroyed || response.writableEnded) return;
      response.writeHead(upstream.statusCode, forwardedResponseHeaders(upstream.headers ?? {}));
      if (request.method === 'HEAD') {
        upstream.body?.destroy?.();
        response.end();
      } else {
        await streamResponseBody(upstream, response);
      }
      return;
    }

    let responseBody;
    try { responseBody = await boundedResponseBody(upstream); }
    catch { return safeResponse(response, 502, { ok: false }); }
    if (responseBody === null) return safeResponse(response, 502, { ok: false });

    if (profilePatch && upstream.statusCode === 200 && state.dropCount === 0) {
      state.dropCount = 1;
      state.firstAck = readProfileAck(responseBody);
      safeEmit(emit, {
        event: 'profile_response_loss', dropCount: state.dropCount, status: 200,
        operationIdHash: state.firstAck?.operationIdHash ?? requestOperationIdHash,
        revision: state.firstAck?.revision ?? null, savedAt: state.firstAck?.savedAt ?? null,
        replayEquality: 'pending',
      });
      response.destroy();
      return;
    }

    if (profilePatch && state.dropCount === 1 && !state.replayObserved && requestOperationIdHash &&
        requestOperationIdHash === state.firstAck?.operationIdHash) {
      state.replayObserved = true;
      const replayAck = upstream.statusCode === 200 ? readProfileAck(responseBody) : null;
      const equal = upstream.statusCode === 200 && replayAck &&
        replayAck.operationIdHash === state.firstAck.operationIdHash &&
        replayAck.revision === state.firstAck.revision && replayAck.savedAt === state.firstAck.savedAt &&
        replayAck.acknowledgmentHash === state.firstAck.acknowledgmentHash;
      safeEmit(emit, {
        event: 'profile_response_loss_replay', dropCount: state.dropCount, status: upstream.statusCode,
        operationIdHash: requestOperationIdHash, revision: replayAck?.revision ?? null,
        savedAt: replayAck?.savedAt ?? null, replayEquality: equal ? 'pass' : 'mismatch',
        acknowledgmentHash: replayAck?.acknowledgmentHash ?? null,
      });
    }

    if (response.destroyed || response.writableEnded) return;
    response.writeHead(upstream.statusCode, forwardedResponseHeaders(upstream.headers ?? {}));
    if (request.method === 'HEAD') response.end();
    else response.end(responseBody);
  };
}

function parseArguments(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!['--run-id', '--until'].includes(key) || !value || values.has(key)) return null;
    values.set(key, value);
  }
  if (values.size !== 2) return null;
  return { runId: values.get('--run-id'), untilText: values.get('--until') };
}

export function validateAttemptEvidence(contents, runId, untilText, now = Date.now()) {
  try {
    const evidence = JSON.parse(contents.replace(/^\uFEFF/, ''));
    const until = Date.parse(untilText);
    const started = Date.parse(evidence.startedAtUtc);
    const recordedUntil = Date.parse(evidence.expiresAtUtc);
    if (evidence.runId !== runId || evidence.fixture !== 'local-01@example.test' || evidence.profileMode !== 'enabled' ||
        !Number.isFinite(until) || until !== recordedUntil || !Number.isFinite(started) ||
        !Number.isFinite(recordedUntil) || started > now || recordedUntil <= now || recordedUntil <= started ||
        recordedUntil - started > 30 * 60 * 1000) return null;
    return { expiresAt: recordedUntil };
  } catch { return null; }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (!args || !/^[A-Za-z0-9_-]{8,80}$/.test(args.runId)) {
    console.log(JSON.stringify({ event: 'profile_response_loss_proxy_error', status: 400 }));
    process.exitCode = 2;
    return;
  }
  let evidenceContents;
  try { evidenceContents = await readFile(EVIDENCE, 'utf8'); }
  catch {
    console.log(JSON.stringify({ event: 'profile_response_loss_proxy_error', status: 403 }));
    process.exitCode = 2;
    return;
  }
  const validated = validateAttemptEvidence(evidenceContents, args.runId, args.untilText);
  if (!validated) {
    console.log(JSON.stringify({ event: 'profile_response_loss_proxy_error', status: 403 }));
    process.exitCode = 2;
    return;
  }

  const server = createServer((request, response) => {
    const remote = request.socket.remoteAddress;
    const loopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
    const allowedHost = ['localhost:3000', '127.0.0.1:3000', '[::1]:3000'].includes(request.headers.host);
    if (!loopback || !allowedHost) return safeResponse(response, 403, { ok: false });
    return handler(request, response);
  });
  const handler = createResponseLossHandler({ expiresAt: validated.expiresAt, forward: forwardToLocalApp });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.on('connect', (_request, socket) => {
    socket.end('HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n');
  });
  server.once('error', () => {
    console.log(JSON.stringify({ event: 'profile_response_loss_proxy_error', status: 503 }));
    process.exitCode = 1;
  });
  server.listen(PROXY_PORT, LOOPBACK, () => {
    console.log(JSON.stringify({ event: 'profile_response_loss_proxy_ready', status: 'listening' }));
  });
  const expiryTimer = setTimeout(() => {
    server.close();
    server.closeAllConnections();
    console.log(JSON.stringify({ event: 'profile_response_loss_proxy_expired', status: 410 }));
  }, validated.expiresAt - Date.now());
  expiryTimer.unref();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      clearTimeout(expiryTimer);
      server.close();
      server.closeAllConnections();
    });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
