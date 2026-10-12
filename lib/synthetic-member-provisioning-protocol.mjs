const ENVIRONMENTS = Object.freeze({
  local: Object.freeze({
    issuer: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
    aliases: Object.freeze(['local-seed-owner@example.test', 'local-seed-admin-a@example.test', 'local-seed-admin-b@example.test']),
  }),
  preview: Object.freeze({
    issuer: 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
    aliases: Object.freeze(['preview-seed-owner@example.test', 'preview-seed-admin-a@example.test', 'preview-seed-admin-b@example.test']),
  }),
});
const KIND = 'member_provision';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINGERPRINT = /^[A-Za-z0-9_-]{43}$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const REQUEST_KEYS = ['operationId'];
const IDENTITY_KEYS = ['issuer', 'subject', 'sessionId', 'expiresAt', 'email', 'emailVerified'];
const RESOLVER_KEYS = ['ok', 'identity'];
const CONTEXT_KEYS = ['status', 'environment', 'issuer', 'subject', 'sessionId', 'seedAlias',
  'accountId', 'accountStatus', 'accountRole', 'bindingState'];
const ACK_KEYS = ['status', 'kind', 'operationId', 'requestFingerprint', 'environment', 'issuer', 'subject',
  'sessionId', 'seedAlias', 'accountId', 'accountStatus', 'accountRole', 'bindingState', 'created'];
const RECEIPT_KEYS = [...ACK_KEYS, 'completedAt'];
const REPOSITORY_KEYS = ['readMemberProvisionContext', 'createMemberAccount', 'readMemberProvisionReceipt'];
const REQUIRED_DEPENDENCY_KEYS = ['environment', 'resolveIdentity', 'repository', 'fingerprint'];
const OPTIONAL_DEPENDENCY_KEYS = ['clock'];

function snapshotRecord(value, keys) {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const own = Reflect.ownKeys(value);
    if (own.length !== keys.length || !keys.every(key => own.includes(key))) return null;
    const output = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
      output[key] = descriptor.value;
    }
    return output;
  } catch { return null; }
}

function validUuid(value) {
  if (typeof value !== 'string' || value.length !== 36) return false;
  const match = UUID.exec(value);
  return match !== null && match[0] === value;
}

function validFingerprint(value) {
  if (typeof value !== 'string' || value.length !== 43) return false;
  const match = FINGERPRINT.exec(value);
  if (!match || match[0] !== value) return false;
  const bytes = Buffer.from(value, 'base64url');
  return bytes.length === 32 && bytes.toString('base64url') === value;
}

function timestampNs(value) {
  if (typeof value !== 'string' || value.length > 40) return null;
  const match = ISO.exec(value);
  if (!match || match[0] !== value) return null;
  const [, y, mo, d, h, mi, s, fraction = '', zone, , oh, om] = match;
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

function clockNs(clock) {
  try {
    const value = clock();
    const milliseconds = value instanceof Date ? Date.prototype.getTime.call(value) : value;
    return typeof milliseconds === 'number' && Number.isFinite(milliseconds)
      ? BigInt(milliseconds) * 1_000_000n : null;
  } catch { return null; }
}

function seedAlias(environment, email) {
  return ENVIRONMENTS[environment].aliases.includes(email) ? email : null;
}

function snapshotResolvedIdentity(value, environment, clock) {
  const envelope = snapshotRecord(value, RESOLVER_KEYS);
  if (!envelope || envelope.ok !== true) return null;
  const identity = snapshotRecord(envelope.identity, IDENTITY_KEYS);
  if (!identity || identity.issuer !== ENVIRONMENTS[environment].issuer ||
      !validUuid(identity.subject) || !validUuid(identity.sessionId) ||
      typeof identity.email !== 'string' || identity.email.length < 1 || identity.email.length > 254 ||
      identity.emailVerified !== true || !seedAlias(environment, identity.email)) return null;
  const expiresAt = timestampNs(identity.expiresAt);
  const now = clockNs(clock);
  if (expiresAt === null || now === null || expiresAt <= now) return null;
  return Object.freeze({ environment, issuer: identity.issuer, subject: identity.subject,
    sessionId: identity.sessionId, seedAlias: identity.email, expiresAt: identity.expiresAt });
}

function sameIdentity(left, right) {
  return left.environment === right.environment && left.issuer === right.issuer &&
    left.subject === right.subject && left.sessionId === right.sessionId && left.seedAlias === right.seedAlias;
}

function snapshotContext(value, identity) {
  const context = snapshotRecord(value, CONTEXT_KEYS);
  if (!context || !['eligible', 'already_member', 'rejected', 'unknown'].includes(context.status) ||
      context.environment !== identity.environment || context.issuer !== identity.issuer ||
      context.subject !== identity.subject || context.sessionId !== identity.sessionId ||
      context.seedAlias !== identity.seedAlias) return null;
  if (context.status === 'eligible') {
    return context.accountId === null && context.accountStatus === null && context.accountRole === null &&
      context.bindingState === 'unbound' ? Object.freeze(context) : null;
  }
  if (context.status === 'already_member') {
    return validUuid(context.accountId) && context.accountStatus === 'active' &&
      context.accountRole === 'member' && context.bindingState === 'active' ? Object.freeze(context) : null;
  }
  return context.accountId === null && context.accountStatus === null && context.accountRole === null &&
    context.bindingState === null ? Object.freeze(context) : null;
}

function snapshotAck(value, identity, operationId, requestFingerprint) {
  const ack = snapshotRecord(value, ACK_KEYS);
  if (!ack || !['committed', 'rejected', 'unknown'].includes(ack.status) || ack.kind !== KIND ||
      ack.operationId !== operationId || ack.requestFingerprint !== requestFingerprint ||
      ack.environment !== identity.environment || ack.issuer !== identity.issuer ||
      ack.subject !== identity.subject || ack.sessionId !== identity.sessionId ||
      ack.seedAlias !== identity.seedAlias) return null;
  if (ack.status === 'committed') {
    return validUuid(ack.accountId) && ack.accountStatus === 'active' && ack.accountRole === 'member' &&
      ack.bindingState === 'active' && typeof ack.created === 'boolean' ? Object.freeze(ack) : null;
  }
  return ack.accountId === null && ack.accountStatus === null && ack.accountRole === null &&
    ack.bindingState === null && ack.created === null ? Object.freeze(ack) : null;
}

function snapshotReceipt(value, identity, operationId, requestFingerprint) {
  const receipt = snapshotRecord(value, RECEIPT_KEYS);
  if (!receipt || !['not_found', 'created', 'already_member', 'rejected', 'unknown'].includes(receipt.status) ||
      receipt.kind !== KIND || receipt.operationId !== operationId ||
      receipt.requestFingerprint !== requestFingerprint || receipt.environment !== identity.environment ||
      receipt.issuer !== identity.issuer || receipt.subject !== identity.subject ||
      receipt.sessionId !== identity.sessionId || receipt.seedAlias !== identity.seedAlias) return null;
  if (receipt.status === 'created' || receipt.status === 'already_member') {
    const created = receipt.status === 'created';
    return validUuid(receipt.accountId) && receipt.accountStatus === 'active' && receipt.accountRole === 'member' &&
      receipt.bindingState === 'active' && receipt.created === created && timestampNs(receipt.completedAt) !== null
      ? Object.freeze(receipt) : null;
  }
  return receipt.accountId === null && receipt.accountStatus === null && receipt.accountRole === null &&
    receipt.bindingState === null && receipt.created === null && receipt.completedAt === null
    ? Object.freeze(receipt) : null;
}

function publicResult(outcome, operationId) {
  return Object.freeze({ ok: outcome === 'provisioned', outcome, operationId });
}

function matchesMemberContext(context, identity, accountId) {
  return context?.status === 'already_member' && context.environment === identity.environment &&
    context.issuer === identity.issuer && context.subject === identity.subject &&
    context.sessionId === identity.sessionId && context.seedAlias === identity.seedAlias &&
    context.accountId === accountId && context.accountStatus === 'active' &&
    context.accountRole === 'member' && context.bindingState === 'active';
}

function receiptOutcome(receipt, context, expectedAccountId = null) {
  if (receipt.status === 'created' || receipt.status === 'already_member') {
    return matchesMemberContext(context, receipt, receipt.accountId) &&
      (expectedAccountId === null || receipt.accountId === expectedAccountId) ? 'provisioned' : 'unknown';
  }
  if (receipt.status === 'rejected') return 'refused';
  return 'unknown';
}

/** Offline protocol for provisioning only ordinary synthetic member accounts.
 * It has no provider, database transaction, route, role-grant, or fixture setup.
 */
export function createSyntheticMemberProvisioningProtocol(dependencies) {
  let configured = snapshotRecord(dependencies, [...REQUIRED_DEPENDENCY_KEYS, ...OPTIONAL_DEPENDENCY_KEYS]);
  if (!configured) {
    const base = snapshotRecord(dependencies, REQUIRED_DEPENDENCY_KEYS);
    if (base) configured = { ...base, clock: undefined };
  }
  if (!configured || typeof configured.environment !== 'string' || !Object.hasOwn(ENVIRONMENTS, configured.environment) ||
      typeof configured.resolveIdentity !== 'function' ||
      (configured.clock !== undefined && typeof configured.clock !== 'function')) {
    throw new TypeError('A pinned synthetic environment, trusted identity resolver, and clock are required.');
  }
  const repo = snapshotRecord(configured.repository, REPOSITORY_KEYS);
  if (!repo || REPOSITORY_KEYS.some(key => typeof repo[key] !== 'function')) {
    throw new TypeError('The closed member-provisioning repository ports are required.');
  }
  const fingerprintPort = snapshotRecord(configured.fingerprint, ['create']);
  if (!fingerprintPort || typeof fingerprintPort.create !== 'function') {
    throw new TypeError('The injected keyed fingerprint port is required.');
  }
  const environment = configured.environment;
  const resolveIdentity = configured.resolveIdentity;
  const clock = configured.clock ?? (() => new Date());
  const repository = Object.freeze({ ...repo });
  const fingerprint = fingerprintPort.create;

  async function freshIdentity(requestContext, expected = null) {
    let raw;
    try { raw = await resolveIdentity(requestContext); } catch { return null; }
    const identity = snapshotResolvedIdentity(raw, environment, clock);
    return identity && (!expected || sameIdentity(identity, expected)) ? identity : null;
  }

  async function readCurrentContext(requestContext, identity) {
    let raw, failed = false;
    try { raw = await repository.readMemberProvisionContext(identity); } catch { failed = true; }
    const context = failed ? null : snapshotContext(raw, identity);
    const current = await freshIdentity(requestContext, identity);
    return current && context ? { identity: current, context } : null;
  }

  async function makeFingerprint(requestContext, identity, operationId) {
    const payload = Object.freeze({ kind: KIND, operationId, environment: identity.environment,
      issuer: identity.issuer, subject: identity.subject, sessionId: identity.sessionId,
      seedAlias: identity.seedAlias });
    let value, failed = false;
    try { value = await fingerprint(payload); } catch { failed = true; }
    const current = await freshIdentity(requestContext, identity);
    return current && !failed && validFingerprint(value) ? { value, identity: current } : null;
  }

  async function readReceipt(requestContext, identity, operationId, requestFingerprint) {
    let raw, failed = false;
    try {
      raw = await repository.readMemberProvisionReceipt(identity, Object.freeze({ kind: KIND,
        operationId, requestFingerprint }));
    } catch { failed = true; }
    const receipt = failed ? null : snapshotReceipt(raw, identity, operationId, requestFingerprint);
    const current = await freshIdentity(requestContext, identity);
    return current && receipt ? { identity: current, receipt } : null;
  }

  async function status(requestContext, request) {
    const input = snapshotRecord(request, REQUEST_KEYS);
    if (!input || !validUuid(input.operationId)) return publicResult('refused', null);
    const operationId = input.operationId.toLowerCase();
    try {
      const initial = await freshIdentity(requestContext);
      if (!initial) return publicResult('refused', operationId);
      const fingerprintResult = await makeFingerprint(requestContext, initial, operationId);
      if (!fingerprintResult) return publicResult('unknown', operationId);
      const read = await readReceipt(requestContext, fingerprintResult.identity, operationId, fingerprintResult.value);
      if (!read) return publicResult('unknown', operationId);
      const current = await readCurrentContext(requestContext, read.identity);
      if (!current) return publicResult('unknown', operationId);
      return publicResult(receiptOutcome(read.receipt, current.context), operationId);
    } catch { return publicResult('unknown', operationId); }
  }

  async function provision(requestContext, request) {
    const input = snapshotRecord(request, REQUEST_KEYS);
    if (!input || !validUuid(input.operationId)) return publicResult('refused', null);
    const operationId = input.operationId.toLowerCase();
    try {
      const initial = await freshIdentity(requestContext);
      if (!initial) return publicResult('refused', operationId);
      const fingerprintResult = await makeFingerprint(requestContext, initial, operationId);
      if (!fingerprintResult) return publicResult('unknown', operationId);
      const identity = fingerprintResult.identity;
      const existing = await readReceipt(requestContext, identity, operationId, fingerprintResult.value);
      if (!existing) return publicResult('unknown', operationId);
      const currentBeforeDecision = await readCurrentContext(requestContext, existing.identity);
      if (!currentBeforeDecision) return publicResult('unknown', operationId);
      if (existing.receipt.status !== 'not_found') {
        return publicResult(receiptOutcome(existing.receipt, currentBeforeDecision.context), operationId);
      }
      if (!['eligible', 'already_member'].includes(currentBeforeDecision.context.status)) {
        return publicResult(currentBeforeDecision.context.status === 'rejected' ? 'refused' : 'unknown', operationId);
      }
      const expectedExistingAccountId = currentBeforeDecision.context.status === 'already_member'
        ? currentBeforeDecision.context.accountId : null;
      const beforeWrite = await freshIdentity(requestContext, currentBeforeDecision.identity);
      if (!beforeWrite) return publicResult('refused', operationId);

      let rawAck;
      try {
        rawAck = await repository.createMemberAccount(beforeWrite, Object.freeze({ kind: KIND,
          operationId, requestFingerprint: fingerprintResult.value }));
      } catch { /* resolve uncertainty through one read-only receipt lookup */ }
      const ack = snapshotAck(rawAck, beforeWrite, operationId, fingerprintResult.value);
      const afterWrite = await freshIdentity(requestContext, beforeWrite);
      if (!afterWrite) return publicResult('unknown', operationId);

      if (ack?.status === 'rejected') {
        const current = await readCurrentContext(requestContext, afterWrite);
        return current ? publicResult('refused', operationId) : publicResult('unknown', operationId);
      }
      if (ack?.status === 'committed') {
        const current = await readCurrentContext(requestContext, afterWrite);
        return current && matchesMemberContext(current.context, afterWrite, ack.accountId) &&
          (expectedExistingAccountId === null || ack.accountId === expectedExistingAccountId)
          ? publicResult('provisioned', operationId) : publicResult('unknown', operationId);
      }

      const reconciled = await readReceipt(requestContext, afterWrite, operationId, fingerprintResult.value);
      if (!reconciled) return publicResult('unknown', operationId);
      const current = await readCurrentContext(requestContext, reconciled.identity);
      if (!current) return publicResult('unknown', operationId);
      return publicResult(receiptOutcome(reconciled.receipt, current.context, expectedExistingAccountId), operationId);
    } catch { return publicResult('unknown', operationId); }
  }

  return Object.freeze({ provision, status });
}
