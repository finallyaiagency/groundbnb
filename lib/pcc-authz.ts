export type VerifiedActor = {
  subject: string;
  verified: boolean;
};

export class PccAuthorizationError extends Error {
  constructor() {
    super('Client write access is not authorized');
    this.name = 'PccAuthorizationError';
  }
}

/** Fail closed until a server-verified identity is explicitly enrolled. */
export function requireSponsor(actor: VerifiedActor | null, allowedSubjects: readonly string[]): string {
  if (!actor?.verified || !actor.subject || !allowedSubjects.includes(actor.subject)) {
    throw new PccAuthorizationError();
  }
  return actor.subject;
}

export function newStreamId(kind: 'question' | 'change_request', now = new Date(), bytes = crypto.getRandomValues(new Uint8Array(10))): string {
  if (bytes.length !== 10 || Number.isNaN(now.getTime())) throw new Error('Invalid stream ID input');
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const random = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${kind === 'question' ? 'Q' : 'CR'}-${date}-${random}`;
}
