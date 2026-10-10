import assert from 'node:assert/strict';
import test from 'node:test';
import { startProfileExportDownload } from '../lib/profile-export-download.mjs';

const exportedAt = '2026-10-09T16:52:38.327Z';

function makePorts({ clickError, createElementError, removeError, revokeError, scheduleError } = {}) {
  const events = [];
  let anchor;
  let scheduled;
  let capturedBlob;
  class TestBlob {
    constructor(parts, options) { this.parts = parts; this.type = options.type; }
  }
  const documentPort = {
    body: {
      append(node) { events.push('append'); anchor = node; },
      removeChild(node) { assert.equal(node, anchor); events.push('remove-child'); },
    },
    createElement(tag) {
      events.push(`create:${tag}`);
      if (createElementError) throw createElementError;
      return {
        href: '', download: '',
        click() { events.push('click'); if (clickError) throw clickError; },
        remove() { events.push('remove'); if (removeError) throw removeError; },
      };
    },
  };
  const urlPort = {
    createObjectURL(blob) { events.push('create-url'); capturedBlob = blob; return 'blob:local-profile'; },
    revokeObjectURL(url) { events.push(`revoke:${url}`); if (revokeError) throw revokeError; },
  };
  const schedule = (callback, delay) => {
    events.push(`schedule:${delay}`);
    if (scheduleError) throw scheduleError;
    scheduled = callback;
  };
  return { documentPort, urlPort, BlobCtor: TestBlob, schedule, events,
    get anchor() { return anchor; }, get scheduled() { return scheduled; }, get capturedBlob() { return capturedBlob; } };
}

test('starts a download from the exact reviewed byte view with a date-matched filename and deferred cleanup', () => {
  const ports = makePorts();
  const source = new Uint8Array([99, 123, 34, 120, 34, 58, 49, 125, 88]);
  const bytes = source.subarray(1, 8);
  const result = startProfileExportDownload({ bytes, contentType: 'application/json; charset=utf-8', exportedAt,
    documentPort: ports.documentPort, urlPort: ports.urlPort, BlobCtor: ports.BlobCtor, schedule: ports.schedule });

  assert.equal(result.filename, 'groundbnb-profile-2026-10-09.json');
  assert.equal(ports.capturedBlob.type, 'application/json; charset=utf-8');
  assert.deepEqual([...new Uint8Array(ports.capturedBlob.parts[0])], [...bytes]);
  assert.equal(ports.anchor.href, 'blob:local-profile');
  assert.equal(ports.anchor.download, result.filename);
  assert.deepEqual(ports.events, ['create-url', 'create:a', 'append', 'click', 'remove', 'schedule:1000']);
  assert.equal(typeof ports.scheduled, 'function');
  ports.scheduled();
  assert.equal(ports.events.at(-1), 'revoke:blob:local-profile');
  ports.scheduled();
  assert.equal(ports.events.filter(event => event === 'revoke:blob:local-profile').length, 1);
});

test('removes the anchor and schedules URL revocation when click throws', () => {
  const ports = makePorts({ clickError: new Error('synthetic click failure') });
  assert.throws(() => startProfileExportDownload({ bytes: new Uint8Array([1]), contentType: 'application/json', exportedAt,
    documentPort: ports.documentPort, urlPort: ports.urlPort, BlobCtor: ports.BlobCtor, schedule: ports.schedule }), /synthetic click failure/);
  assert.deepEqual(ports.events, ['create-url', 'create:a', 'append', 'click', 'remove', 'schedule:1000']);
  ports.scheduled();
  assert.equal(ports.events.at(-1), 'revoke:blob:local-profile');
});

test('revokes an object URL if anchor creation fails and falls back when scheduling fails', () => {
  const creationPorts = makePorts({ createElementError: new Error('synthetic element failure') });
  assert.throws(() => startProfileExportDownload({ bytes: new Uint8Array([1]), contentType: 'application/json', exportedAt,
    documentPort: creationPorts.documentPort, urlPort: creationPorts.urlPort, BlobCtor: creationPorts.BlobCtor, schedule: creationPorts.schedule }), /synthetic element failure/);
  assert.deepEqual(creationPorts.events, ['create-url', 'create:a', 'schedule:1000']);
  creationPorts.scheduled();
  assert.equal(creationPorts.events.at(-1), 'revoke:blob:local-profile');

  const schedulePorts = makePorts({ scheduleError: new Error('synthetic timer failure') });
  const result = startProfileExportDownload({ bytes: new Uint8Array([1]), contentType: 'application/json', exportedAt,
    documentPort: schedulePorts.documentPort, urlPort: schedulePorts.urlPort, BlobCtor: schedulePorts.BlobCtor, schedule: schedulePorts.schedule });
  assert.equal(result.filename, 'groundbnb-profile-2026-10-09.json');
  assert.equal(schedulePorts.events.at(-1), 'revoke:blob:local-profile');
});

test('falls back to body removal when anchor removal throws and suppresses cleanup-only errors', () => {
  const ports = makePorts({ removeError: new Error('synthetic remove failure'), revokeError: new Error('synthetic revoke failure') });
  const result = startProfileExportDownload({ bytes: new Uint8Array([1]), contentType: 'application/json', exportedAt,
    documentPort: ports.documentPort, urlPort: ports.urlPort, BlobCtor: ports.BlobCtor, schedule: ports.schedule });
  assert.equal(result.filename, 'groundbnb-profile-2026-10-09.json');
  assert.deepEqual(ports.events, ['create-url', 'create:a', 'append', 'click', 'remove', 'remove-child', 'schedule:1000']);
  assert.doesNotThrow(() => ports.scheduled());
});

test('rejects noncanonical timestamps and invalid ports before creating a browser artifact', () => {
  const ports = makePorts();
  const input = { bytes: new Uint8Array([1]), contentType: 'application/json', exportedAt: '2026-10-09',
    documentPort: ports.documentPort, urlPort: ports.urlPort, BlobCtor: ports.BlobCtor, schedule: ports.schedule };
  assert.throws(() => startProfileExportDownload(input), TypeError);
  assert.deepEqual(ports.events, []);
  assert.throws(() => startProfileExportDownload({ ...input, exportedAt,
    bytes: new DataView(new ArrayBuffer(1)) }), TypeError);
  assert.deepEqual(ports.events, []);
});
