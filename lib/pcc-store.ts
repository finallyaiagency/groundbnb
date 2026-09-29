import 'server-only';
import { neon } from '@neondatabase/serverless';
import { newStreamId, requireSponsor, type VerifiedActor } from './pcc-authz';
import { validatePccDatabaseTarget } from './pcc-config';

type StreamKind = 'question' | 'change_request';
type ClientEventType =
  | 'question.answered'
  | 'question.deferred_to_ai'
  | 'question.ignored'
  | 'question.ai_default_accepted'
  | 'question.ai_default_modified'
  | 'question.ai_default_rejected'
  | 'change_request.created';

type JsonObject = Record<string, unknown>;
type EventResult = { eventId: string; revision: number; streamId: string };
const clientEvents: readonly string[] = [
  'question.answered', 'question.deferred_to_ai', 'question.ignored',
  'question.ai_default_accepted', 'question.ai_default_modified', 'question.ai_default_rejected',
  'change_request.created',
];

function database() {
  return neon(validatePccDatabaseTarget(process.env.PCC_DATABASE_URL, process.env.PCC_DATABASE_HOST, process.env.VERCEL_ENV));
}

function sponsor(actor: VerifiedActor | null) {
  const subjects = process.env.PCC_SPONSOR_SUBJECTS?.split(',').map(x => x.trim()).filter(Boolean) ?? [];
  return requireSponsor(actor, subjects);
}

function request(key: string, payload: JsonObject) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
    throw new Error('Invalid idempotency key');
  }
  if (!payload || Array.isArray(payload) || typeof payload !== 'object' || JSON.stringify(payload).length > 32768) {
    throw new Error('Invalid PCC event payload');
  }
  return JSON.stringify(payload);
}

function one(rows: Record<string, unknown>[], streamId: string): EventResult {
  if (rows.length !== 1 || typeof rows[0].event_id !== 'string' || typeof rows[0].revision !== 'number') {
    throw new Error('Unexpected PCC event-store response');
  }
  return { eventId: rows[0].event_id, revision: rows[0].revision, streamId };
}

export async function createClientStream(
  kind: StreamKind, actor: VerifiedActor | null, idempotencyKey: string, payload: JsonObject,
): Promise<EventResult> {
  const subject = sponsor(actor);
  const body = request(idempotencyKey, payload);
  if (kind !== 'question' && kind !== 'change_request') throw new Error('Invalid PCC stream kind');
  const sql = database();
  const streamId = newStreamId(kind);
  const rows = await sql`SELECT event_id, revision FROM pcc.create_stream(
    ${streamId}, ${kind}, ${`${kind}.created`}, ${subject}, ${'client'}, ${idempotencyKey}::uuid, ${body}::jsonb
  )`;
  return one(rows, streamId);
}

export async function appendClientEvent(
  streamId: string, expectedRevision: number, eventType: ClientEventType,
  actor: VerifiedActor | null, idempotencyKey: string, payload: JsonObject,
): Promise<EventResult> {
  const subject = sponsor(actor);
  const body = request(idempotencyKey, payload);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new Error('Invalid expected revision');
  if (!clientEvents.includes(eventType) || !/^(Q|CR)-[0-9]{8}-[0-9a-f]{20}$/.test(streamId)) {
    throw new Error('Invalid PCC event reference');
  }
  if (eventType.startsWith('question.') ? !streamId.startsWith('Q-') : !streamId.startsWith('CR-')) {
    throw new Error('PCC event type and stream ID disagree');
  }
  const sql = database();
  const rows = await sql`SELECT event_id, revision FROM pcc.append_event(
    ${streamId}, ${expectedRevision}, ${eventType}, ${subject}, ${'client'}, ${idempotencyKey}::uuid, ${body}::jsonb
  )`;
  return one(rows, streamId);
}
