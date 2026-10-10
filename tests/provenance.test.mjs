import test from 'node:test';
import assert from 'node:assert/strict';
import { portableValue, changePositioning } from '../lib/provenance.mjs';

test('exact GPS never grants provider export rights', () => {
  const stop = { positioning: 'road_access', coordinate: { lat: 10, lng: 20 },
    provenance: { origin: 'provider', sourceReference: 'routes:123', fetchedAt: '2026-10-02T00:00:00Z', policyVersion: 'test', retentionUntil: '2026-10-03T00:00:00Z' } };
  const moved = changePositioning(stop, 'exact_gps');
  assert.deepEqual(moved.provenance, stop.provenance);
  assert.equal(portableValue({ value: moved.coordinate, provenance: moved.provenance }, {}, new Date('2026-10-02T00:00:00Z')).value, null);
  assert.deepEqual(stop.coordinate, { lat: 10, lng: 20 });
});

test('expiry yields null while authored location and zero remain distinct', () => {
  const now = new Date('2026-10-04T00:00:00Z');
  const provider = { value: { lat: 10, lng: 20 }, provenance: { origin: 'provider', sourceReference: 'routes:123', fetchedAt: '2026-10-02T00:00:00Z', policyVersion: 'test', retentionUntil: '2026-10-03T00:00:00Z' } };
  assert.deepEqual(portableValue(provider, { permittedExportSources: ['routes:123'] }, now), { value: null, status: 'unavailable', reason: 'expired' });
  const authored = { value: { lat: 0, lng: 0 }, provenance: { origin: 'user' } };
  assert.deepEqual(portableValue(authored, {}, now).value, { lat: 0, lng: 0 });
  assert.equal(portableValue({ value: 0, provenance: { origin: 'user' } }, {}, now).value, 0);
});

test('unknown imported rights and calculated dependencies fail closed', () => {
  assert.equal(portableValue({ value: 12, provenance: { origin: 'import' } }, {}).value, null);
  assert.equal(portableValue({ value: 12, provenance: { origin: 'calculated' } }, {}).value, null);
});
