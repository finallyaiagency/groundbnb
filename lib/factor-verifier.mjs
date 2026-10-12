import { verify } from 'otplib';
import { crypto } from '@otplib/plugin-crypto-node';

const invalid = () => Object.freeze({ valid: false });

/**
 * Server-only factor verification. Inputs must come from trusted encrypted
 * factor storage and server clock. A match is only a candidate: the caller
 * must atomically consume its step, enforce rate/epoch/session controls and
 * persist an audit before producing a privileged factor attestation.
 */
export async function verifyFactorCandidate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['secret', 'token', 'epochSeconds', 'lastAcceptedStep'].includes(key)) ||
      typeof input.secret !== 'string' || !/^[A-Z2-7]{32,103}$/.test(input.secret) ||
      typeof input.token !== 'string' || !/^\d{6}$/.test(input.token) ||
      !Number.isSafeInteger(input.epochSeconds) || input.epochSeconds < 0 ||
      !Object.hasOwn(input, 'lastAcceptedStep') ||
      (input.lastAcceptedStep !== null && (!Number.isSafeInteger(input.lastAcceptedStep) || input.lastAcceptedStep < 0))) {
    return invalid();
  }
  try {
    const result = await verify({ secret: input.secret, token: input.token,
      strategy: 'totp', algorithm: 'sha1', digits: 6, period: 30,
      epoch: input.epochSeconds, epochTolerance: 30, crypto,
      ...(input.lastAcceptedStep === null ? {} : { afterTimeStep: input.lastAcceptedStep }),
    });
    if (!result.valid || !Number.isSafeInteger(result.timeStep) || result.timeStep < 0 ||
        (input.lastAcceptedStep !== null && result.timeStep <= input.lastAcceptedStep)) return invalid();
    return Object.freeze({ valid: true, matchedStep: result.timeStep });
  } catch {
    return invalid();
  }
}
