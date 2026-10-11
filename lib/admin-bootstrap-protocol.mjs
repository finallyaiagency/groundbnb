const ISSUERS = Object.freeze({
  local: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  preview: 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
});
const SEEDS = Object.freeze({
  local: Object.freeze({
    'local-seed-owner@example.test': Object.freeze({ slot: 'owner', role: 'owner' }),
    'local-seed-admin-a@example.test': Object.freeze({ slot: 'admin-a', role: 'admin' }),
    'local-seed-admin-b@example.test': Object.freeze({ slot: 'admin-b', role: 'admin' }),
  }),
  preview: Object.freeze({
    'preview-seed-owner@example.test': Object.freeze({ slot: 'owner', role: 'owner' }),
    'preview-seed-admin-a@example.test': Object.freeze({ slot: 'admin-a', role: 'admin' }),
    'preview-seed-admin-b@example.test': Object.freeze({ slot: 'admin-b', role: 'admin' }),
  }),
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_LENGTH = 36;
const SESSION_KEYS = ['issuer', 'subject', 'sessionId', 'expiresAt', 'email', 'emailVerified'];
const CONTEXT_KEYS = ['status', 'issuer', 'subject', 'sessionId', 'accountId', 'accountStatus',
  'accountRole', 'seedSlot', 'seedRole', 'bindingState', 'ownerState', 'completionState'];
const ACK_KEYS = ['status', 'kind', 'operationId', 'issuer', 'subject', 'sessionId',
  'accountId', 'seedSlot', 'role'];
const RECEIPT_KEYS = ACK_KEYS;
const REPO_KEYS = ['readBootstrapContext', 'activateBootstrapSeed', 'readBootstrapReceipt'];
const UUID_RE = new RegExp(UUID.source, UUID.flags);

function exactRecord(value, keys) {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const own = Reflect.ownKeys(value);
    if (own.length !== keys.length || !keys.every(key => own.includes(key))) return null;
    const snapshot = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
      snapshot[key] = descriptor.value;
    }
    return snapshot;
  } catch { return null; }
}

function validUuid(value) {
  return typeof value === 'string' && value.length === UUID_LENGTH && UUID_RE.test(value);
}

function seedFor(environment, email) {
  const mapping = SEEDS[environment];
  return Object.hasOwn(mapping, email) ? mapping[email] : null;
}

function timestampNs(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!m || m[0] !== value) return null;
  const [, y, mo, d, h, mi, s, fraction = '', zone, , oh, om] = m;
  const year = Number(y), month = Number(mo), day = Number(d);
  const hour = Number(h), minute = Number(mi), second = Number(s);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (!year || month < 1 || month > 12 || day < 1 || day > monthDays[month - 1] ||
      hour > 23 || minute > 59 || second > 59) return null;
  if (zone !== 'Z') {
    const offsetHour = Number(oh), offsetMinute = Number(om);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return null;
  }
  const base = Date.parse(value.replace(/\.\d+(?=Z|[+-])/, ''));
  if (!Number.isFinite(base)) return null;
  return BigInt(base) * 1_000_000n + BigInt((fraction + '000000000').slice(0, 9));
}

function nowNs(clock) {
  try {
    const value = clock();
    const date = value instanceof Date ? value : new Date(value);
    const ms = date.getTime();
    return Number.isFinite(ms) ? BigInt(ms) * 1_000_000n : null;
  } catch { return null; }
}

function snapshotSession(value, environment, clock) {
  const session = exactRecord(value, SESSION_KEYS);
  if (!session || session.issuer !== ISSUERS[environment] || !validUuid(session.subject) ||
      !validUuid(session.sessionId) || timestampNs(session.expiresAt) === null ||
      typeof session.email !== 'string' || session.email.length > 254 ||
      session.email !== session.email.toLowerCase() || session.emailVerified !== true) return null;
  const now = nowNs(clock);
  if (now === null || timestampNs(session.expiresAt) <= now) return null;
  const seed = seedFor(environment, session.email);
  if (!seed) return null;
  return Object.freeze({ ...session });
}

function sameSession(left, right) {
  return left.issuer === right.issuer && left.subject === right.subject &&
    left.sessionId === right.sessionId && left.expiresAt === right.expiresAt &&
    left.email === right.email && left.emailVerified === right.emailVerified;
}

function snapshotContext(value, session, environment, phase = 'preflight') {
  const context = exactRecord(value, CONTEXT_KEYS);
  if (!context || !['eligible', 'activated', 'refused', 'unknown'].includes(context.status) ||
      context.issuer !== session.issuer || context.subject !== session.subject ||
      context.sessionId !== session.sessionId ||
      (context.accountId !== null && !validUuid(context.accountId)) ||
      !['active', 'inactive', 'missing', 'unknown'].includes(context.accountStatus) ||
      !['member', 'admin', 'owner', 'unknown'].includes(context.accountRole) ||
      ![null, 'owner', 'admin-a', 'admin-b'].includes(context.seedSlot) ||
      ![null, 'owner', 'admin'].includes(context.seedRole) ||
      !['unbound', 'bound', 'revoked', 'mismatch', 'ambiguous', 'unknown'].includes(context.bindingState) ||
      !['none', 'one', 'multiple', 'unknown'].includes(context.ownerState) ||
      !['initialized', 'in_progress', 'complete', 'unknown'].includes(context.completionState)) return null;
  if (context.status === 'eligible' && ['preflight', 'status'].includes(phase)) {
    const seed = seedFor(environment, session.email);
    if (!validUuid(context.accountId) || context.accountStatus !== 'active' ||
        context.accountRole !== 'member' || !seed || context.seedSlot !== seed.slot ||
        context.seedRole !== seed.role || context.bindingState !== 'unbound' ||
        !['none', 'one'].includes(context.ownerState) ||
        !['initialized', 'in_progress'].includes(context.completionState)) return null;
  }
  if (context.status === 'activated' && ['postcommit', 'status'].includes(phase)) {
    const seed = seedFor(environment, session.email);
    if (!validUuid(context.accountId) || context.accountStatus !== 'active' || !seed ||
        context.accountRole !== seed.role || context.seedSlot !== seed.slot || context.seedRole !== seed.role ||
        context.bindingState !== 'bound' || context.ownerState !== 'one' ||
        !['in_progress', 'complete'].includes(context.completionState)) return null;
  }
  if (context.status === 'eligible' && !['preflight', 'status'].includes(phase)) return null;
  if (context.status === 'activated' && !['postcommit', 'status'].includes(phase)) return null;
  return Object.freeze(context);
}

function publicResult(outcome, operationId) {
  return Object.freeze({ ok: outcome === 'activated', outcome, operationId });
}

function boundAck(value, session, context, operationId) {
  const ack = exactRecord(value, ACK_KEYS);
  return ack && ['activated', 'rejected', 'unknown'].includes(ack.status) &&
    ack.kind === 'activate' && ack.operationId === operationId &&
    ack.issuer === session.issuer && ack.subject === session.subject &&
    ack.sessionId === session.sessionId && ack.accountId === context.accountId &&
    ack.seedSlot === context.seedSlot && ack.role === context.seedRole ? Object.freeze(ack) : null;
}

function boundReceipt(value, session, operationId, environment, expectedContext = null) {
  const receipt = exactRecord(value, RECEIPT_KEYS);
  if (!receipt || !['not_found', 'activated', 'rejected', 'unknown'].includes(receipt.status) ||
      receipt.kind !== 'activate' || receipt.operationId !== operationId ||
      receipt.issuer !== session.issuer || receipt.subject !== session.subject ||
      receipt.sessionId !== session.sessionId) return null;
  if (receipt.status === 'not_found') {
    return receipt.accountId === null && receipt.seedSlot === null && receipt.role === null
      ? Object.freeze(receipt) : null;
  }
  const seed = seedFor(environment, session.email);
  if (!validUuid(receipt.accountId) || !['owner', 'admin-a', 'admin-b'].includes(receipt.seedSlot) ||
      !['owner', 'admin'].includes(receipt.role) || !seed || receipt.seedSlot !== seed.slot || receipt.role !== seed.role) return null;
  if (expectedContext && (receipt.accountId !== expectedContext.accountId ||
      receipt.seedSlot !== expectedContext.seedSlot || receipt.role !== expectedContext.seedRole)) return null;
  return Object.freeze(receipt);
}

/**
 * Offline bootstrap orchestration over a fresh trusted session resolver and
 * three fixed repository ports. This protocol never creates accounts,
 * assigns roles itself, exposes protected data, or treats a receipt as current
 * authorization. Durable eligibility and all role invariants must be checked
 * again atomically by the private writer.
 */
export function createAdminBootstrapProtocol({ environment, resolveSession, repository, clock = () => new Date() }) {
  if (typeof environment !== 'string' || !Object.hasOwn(ISSUERS, environment) || typeof resolveSession !== 'function' ||
      typeof clock !== 'function') throw new TypeError('A pinned synthetic environment and trusted resolver are required.');
  const boundEnvironment = environment;
  const repo = exactRecord(repository, REPO_KEYS);
  if (!repo || REPO_KEYS.some(key => typeof repo[key] !== 'function')) {
    throw new TypeError('The closed bootstrap repository ports are required.');
  }

  async function resolveFresh(requestContext) {
    try {
      const value = await resolveSession(requestContext);
      return snapshotSession(value, boundEnvironment, clock);
    } catch { return null; }
  }

  async function confirmCurrentBinding(requestContext, session, expectedContext) {
    let rawContext;
    try { rawContext = await repo.readBootstrapContext(session); }
    catch { return false; }
    const current = snapshotContext(rawContext, session, boundEnvironment, 'postcommit');
    const currentSession = await resolveFresh(requestContext);
    if (!currentSession || !sameSession(session, currentSession)) return false;
    return current?.status === 'activated' && current.accountId === expectedContext.accountId &&
      current.seedSlot === expectedContext.seedSlot && current.seedRole === expectedContext.seedRole &&
      current.accountRole === expectedContext.seedRole && current.bindingState === 'bound' &&
      current.ownerState === 'one';
  }

  async function readReceiptContext(requestContext, session, receipt) {
    let rawContext;
    try { rawContext = await repo.readBootstrapContext(session); }
    catch { return null; }
    const current = snapshotContext(rawContext, session, boundEnvironment, 'status');
    const currentSession = await resolveFresh(requestContext);
    if (!currentSession || !sameSession(session, currentSession)) return null;
    if (!current || current.status === 'unknown' || current.accountId !== receipt.accountId ||
        current.seedSlot !== receipt.seedSlot || current.seedRole !== receipt.role) return null;
    return current;
  }

  function isCurrentlyActivated(context, receipt) {
    return context?.status === 'activated' && context.accountStatus === 'active' &&
      context.accountRole === receipt.role && context.bindingState === 'bound' && context.ownerState === 'one';
  }

  async function activate(requestContext, request) {
    const operation = exactRecord(request, ['operationId']);
    if (!operation || !validUuid(operation.operationId)) return publicResult('refused', null);
    const operationId = operation.operationId.toLowerCase();
    let writerIssued = false;
    try {
      const initial = await resolveFresh(requestContext);
      if (!initial) return publicResult('refused', operationId);

      let rawContext = null;
      let context = null;
      let contextFailed = false;
      try {
        rawContext = await repo.readBootstrapContext(initial);
        context = snapshotContext(rawContext, initial, boundEnvironment, 'status');
      }
      catch { contextFailed = true; }
      const afterContext = await resolveFresh(requestContext);
      if (!afterContext || !sameSession(initial, afterContext)) return publicResult('unknown', operationId);
      if (contextFailed) return publicResult('unknown', operationId);

      if (!context) return publicResult('unknown', operationId);
      if (context.status !== 'eligible') return status(requestContext, { operationId });

      const beforeWrite = await resolveFresh(requestContext);
      if (!beforeWrite || !sameSession(initial, beforeWrite)) return publicResult('refused', operationId);
      writerIssued = true;
      let rawAck = null;
      try { rawAck = await repo.activateBootstrapSeed(beforeWrite, { operationId }); }
      catch { /* reconcile once below; never repeat the write */ }
      const ack = boundAck(rawAck, initial, context, operationId);
      const afterWrite = await resolveFresh(requestContext);
      if (!afterWrite || !sameSession(initial, afterWrite)) return publicResult('unknown', operationId);

      if (ack?.status === 'activated') {
        return await confirmCurrentBinding(requestContext, afterWrite, context)
          ? publicResult('activated', operationId) : publicResult('unknown', operationId);
      }
      if (ack?.status === 'rejected') return publicResult('refused', operationId);
      if (!writerIssued) return publicResult('unknown', operationId);

      let rawReceipt = null;
      try { rawReceipt = await repo.readBootstrapReceipt(afterWrite, { operationId }); }
      catch { /* no retry and no second receipt read */ }
      const receipt = boundReceipt(rawReceipt, initial, operationId, boundEnvironment, context);
      const afterReceipt = await resolveFresh(requestContext);
      if (!afterReceipt || !sameSession(initial, afterReceipt)) return publicResult('unknown', operationId);
      if (receipt?.status === 'activated') {
        return await confirmCurrentBinding(requestContext, afterReceipt, context)
          ? publicResult('activated', operationId) : publicResult('unknown', operationId);
      }
      if (receipt?.status === 'rejected') return publicResult('refused', operationId);
      return publicResult('unknown', operationId);
    } catch {
      return publicResult(writerIssued ? 'unknown' : 'refused', operationId);
    }
  }

  async function status(requestContext, request) {
    const operation = exactRecord(request, ['operationId']);
    if (!operation || !validUuid(operation.operationId)) return publicResult('refused', null);
    const operationId = operation.operationId.toLowerCase();
    try {
      const initial = await resolveFresh(requestContext);
      if (!initial) return publicResult('refused', operationId);
      let rawReceipt = null;
      try { rawReceipt = await repo.readBootstrapReceipt(initial, { operationId }); }
      catch { /* one read only */ }
      const receipt = boundReceipt(rawReceipt, initial, operationId, boundEnvironment);
      const afterReceipt = await resolveFresh(requestContext);
      if (!afterReceipt || !sameSession(initial, afterReceipt)) return publicResult('unknown', operationId);
      if (receipt?.status === 'activated') {
        const current = await readReceiptContext(requestContext, afterReceipt, receipt);
        return isCurrentlyActivated(current, receipt)
          ? publicResult('activated', operationId) : publicResult('unknown', operationId);
      }
      if (receipt?.status === 'rejected') {
        const current = await readReceiptContext(requestContext, afterReceipt, receipt);
        return current ? publicResult('refused', operationId) : publicResult('unknown', operationId);
      }
      if (receipt?.status === 'unknown') {
        await readReceiptContext(requestContext, afterReceipt, receipt);
        return publicResult('unknown', operationId);
      }
      if (receipt?.status === 'not_found') return publicResult('not_found', operationId);
      return publicResult('unknown', operationId);
    } catch { return publicResult('unknown', operationId); }
  }

  return Object.freeze({ activate, status });
}
