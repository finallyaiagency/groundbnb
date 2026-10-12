import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ProfileTransferError, buildProfileExport, createProfileExportPreview, createProfileMergeProposal,
  previewProfileImport,
} from '../lib/profile-transfer.mjs';
import { createEmptyProfileAnswers } from '../lib/profile-domain.mjs';

const exportedAt = '2026-10-08T12:00:00.000Z';
const answer = (value, answered = true) => ({ value, answered, scope: 'account', updatedAt: answered ? exportedAt : null });
const profile = (values = {}, profileNotes = []) => {
  const answers = createEmptyProfileAnswers();
  for (const [field, value] of Object.entries(values)) answers[field] = answer(value);
  return { answers, profileNotes };
};
const envelope = (profileFields, profileNotes = [], extra = {}) => ({
  format: 'groundbnb', formatVersion: 1, kind: 'profile', exportedAt,
  profileFields, profileNotes, ...extra,
});
const hasWarning = (preview, code, field) => preview.warnings.some(item => item.code === code && item.field === field);

test('native export uses exact envelope, preserves false/zero/empty/null values, and omits unanswered fields', () => {
  const source = profile({ hasPets: false, comfortLevel: 0, activities: [], homePoint: null, homeAddress: 'private address' }, ['personal quote']);
  source.answers.travelSeason = answer(null, false);
  const preview = createProfileExportPreview(source);
  assert.deepEqual(preview.profileFields, { hasPets: false, comfortLevel: 0, activities: [] });
  assert.deepEqual(preview.profileNotes, []);
  assert.equal(preview.requiresSensitiveConfirmation, false);
  const result = buildProfileExport(source, { preview, exportedAt });
  assert.deepEqual(Object.keys(result.envelope), ['format', 'formatVersion', 'kind', 'exportedAt', 'profileFields', 'profileNotes']);
  assert.deepEqual(result.envelope, envelope({ hasPets: false, comfortLevel: 0, activities: [] }));
  assert.equal(new TextDecoder().decode(result.bytes), result.text);
});

test('home and quote export requires opt-in and confirmation; no client assertion can authorize a home point', () => {
  const source = profile({ homeAddress: '1 User Road', alwaysBeginEndAtHome: false,
    homePoint: { latitude: 42.1, longitude: -71.2 } }, ['Keep my own words']);
  const defaultPreview = createProfileExportPreview(source);
  assert.deepEqual(defaultPreview.profileFields, {});
  assert.deepEqual(defaultPreview.profileNotes, []);

  const options = { includeHome: true, includeQuotes: true };
  const preview = createProfileExportPreview(source, options);
  assert.deepEqual(preview.profileFields, { homeAddress: '1 User Road', alwaysBeginEndAtHome: false });
  assert.deepEqual(preview.sensitiveFields, { homeAddress: '1 User Road', alwaysBeginEndAtHome: false });
  assert.deepEqual(preview.sensitiveNotes, ['Keep my own words']);
  assert.equal(hasWarning(preview, 'home_point_provenance_unknown', 'homePoint'), true);
  assert.throws(() => buildProfileExport(source, { preview, ...options, exportedAt }), error =>
    error instanceof ProfileTransferError && error.code === 'sensitive_confirmation_required');
  assert.throws(() => buildProfileExport(source, { preview, includeHome: false, includeQuotes: true,
    confirmSensitive: true, exportedAt }), error =>
    error instanceof ProfileTransferError && error.code === 'preview_mismatch');

  const claimedAuthored = { ...options, homePointProvenance: { homePoint: 'user' } };
  const reviewed = createProfileExportPreview(source, claimedAuthored);
  assert.equal(reviewed.profileFields.homePoint, undefined);
  assert.equal(hasWarning(reviewed, 'home_point_provenance_unknown', 'homePoint'), true);
  const file = buildProfileExport(source, { preview: reviewed, ...claimedAuthored, confirmSensitive: true, exportedAt });
  assert.deepEqual(file.envelope.profileNotes, ['Keep my own words']);
});

test('import preview validates native values, applies opt-ins, and visibly warns on authority, unknown, trip, and future-tier fields', () => {
  const file = envelope({ hasPets: false, comfortLevel: 0, activities: [], homeAddress: 'Home',
    homePoint: { latitude: 42, longitude: -71 }, ownerId: 'old-owner', travelerCount: 1000,
    planningStyle: 'Flexible Framework',
    units: 'metric', startDate: '2026-11-01', mystery: 'unknown' }, ['quote'], { role: 'admin', oldPassword: 'secret' });
  const defaultPreview = previewProfileImport(new TextEncoder().encode(JSON.stringify(file)));
  assert.deepEqual(defaultPreview.fields, { hasPets: false, comfortLevel: 0, activities: [], planningStyle: 'Flexible Framework' });
  assert.equal(defaultPreview.profileNotes.length, 0);
  assert.equal(hasWarning(defaultPreview, 'authority_field', 'ownerId'), true);
  assert.equal(hasWarning(defaultPreview, 'authority_field', 'role'), true);
  assert.equal(hasWarning(defaultPreview, 'authority_field', 'oldPassword'), true);
  assert.equal(hasWarning(defaultPreview, 'home_opt_in_required', 'homeAddress'), true);
  assert.equal(hasWarning(defaultPreview, 'quotes_opt_in_required', 'profileNotes'), true);
  assert.equal(hasWarning(defaultPreview, 'invalid_field', 'travelerCount'), true);
  assert.equal(hasWarning(defaultPreview, 'unsupported_tier', 'units'), true);
  assert.equal(hasWarning(defaultPreview, 'wrong_scope', 'startDate'), true);
  assert.equal(hasWarning(defaultPreview, 'unknown_field', 'mystery'), true);

  const optedIn = previewProfileImport(JSON.stringify(file), { includeHome: true, includeQuotes: true });
  assert.equal(optedIn.fields.homeAddress, 'Home');
  assert.equal(optedIn.fields.homePoint, undefined);
  assert.equal(optedIn.reviewOnlyFields.homePoint.latitude, 42);
  assert.deepEqual(optedIn.profileNotes, ['quote']);
  assert.equal(optedIn.requiresSensitiveConfirmation, true);
  assert.equal(hasWarning(optedIn, 'home_point_unverified', 'homePoint'), true);
  assert.throws(() => createProfileMergeProposal(optedIn, profile(), {
    selectedFields: ['homePoint'], confirmSensitive: true,
  }), error => error.code === 'invalid_selection');
});

test('selective merge shows before/after, changes only selected fields, and keeps quotes out of mutation until records are enabled', () => {
  const preview = previewProfileImport(JSON.stringify(envelope({ hasPets: false, comfortLevel: 0,
    homeAddress: 'New home' }, ['New quote'])), { includeHome: true, includeQuotes: true });
  const current = profile({ hasPets: true, comfortLevel: 5, homeAddress: 'Current home' }, ['Existing quote']);
  const proposal = createProfileMergeProposal(preview, current, {
    selectedFields: ['hasPets', 'homeAddress'], selectedNotes: [0], confirmSensitive: true,
  });
  assert.deepEqual(proposal.patch.hasPets, { value: false, answered: true, scope: 'account' });
  assert.deepEqual(proposal.patch.homeAddress, { value: 'New home', answered: true, scope: 'account' });
  assert.equal(Object.hasOwn(proposal.patch, 'comfortLevel'), false);
  assert.deepEqual(proposal.selectedNoteTextPreview, ['New quote']);
  assert.equal(proposal.notesCommitAllowed, false);
  assert.match(proposal.notesCommitReason, /persistence is not enabled/);
  assert.equal(Object.hasOwn(proposal.patch, 'profileNotes'), false);
  assert.deepEqual(proposal.changes.find(item => item.field === 'hasPets'), {
    field: 'hasPets', before: true, after: false, beforeAnswered: true, changed: true, selected: true,
  });
  assert.equal(proposal.changes.find(item => item.field === 'comfortLevel').selected, false);
  assert.throws(() => createProfileMergeProposal(preview, current, { selectedFields: ['ownerId'] }), error =>
    error instanceof ProfileTransferError && error.code === 'sensitive_confirmation_required');
  assert.throws(() => createProfileMergeProposal(preview, current, {
    selectedFields: ['ownerId'], selectedNotes: [], confirmSensitive: true,
  }), error => error instanceof ProfileTransferError && error.code === 'invalid_selection');
});

test('malformed envelopes and invalid UTF-8 fail closed, while unknown individual values remain visible warnings', () => {
  assert.throws(() => previewProfileImport('{bad'), error => error.code === 'invalid_json');
  assert.throws(() => previewProfileImport(Uint8Array.from([0xc3, 0x28])), error => error.code === 'invalid_utf8');
  assert.throws(() => previewProfileImport(JSON.stringify({ ...envelope({}), formatVersion: 2 })), error => error.code === 'invalid_envelope');
  const preview = previewProfileImport(JSON.stringify(envelope({ travelerCount: 1000, hasPets: 'no' })));
  assert.deepEqual(preview.fields, {});
  assert.equal(hasWarning(preview, 'invalid_field', 'travelerCount'), true);
  assert.equal(hasWarning(preview, 'invalid_field', 'hasPets'), true);
});

test('export preview is mandatory, bound to unchanged inputs, and immutable', () => {
  const source = profile({ hasPets: false });
  assert.throws(() => buildProfileExport(source), error => error.code === 'preview_required');
  const preview = createProfileExportPreview(source);
  assert.throws(() => { preview.profileFields.hasPets = true; }, TypeError);
  const changed = profile({ hasPets: true });
  assert.throws(() => buildProfileExport(changed, { preview, exportedAt }), error => error.code === 'preview_mismatch');
});

test('profile notes reject PostgreSQL-incompatible strings and preserve valid Unicode', () => {
  const safe = profile({ hasPets: false }, ['A quote with emoji 🧭']);
  const preview = createProfileExportPreview(safe, { includeQuotes: true });
  assert.deepEqual(preview.profileNotes, ['A quote with emoji 🧭']);

  for (const text of ['NUL\u0000note', 'lone high \uD800', 'lone low \uDC00']) {
    assert.throws(() => createProfileExportPreview(profile({}, [text]), { includeQuotes: true }), error =>
      error instanceof ProfileTransferError && error.code === 'invalid_notes');
    assert.throws(() => previewProfileImport(JSON.stringify(envelope({}, [text])), { includeQuotes: true }), error =>
      error instanceof ProfileTransferError && error.code === 'invalid_notes');
  }
});
