import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { PROFILE_FIELD_DEFINITIONS } from '../lib/profile-domain.mjs';
import { createProfilePdf, createProfilePdfPreview, isCurrentProfilePdfPreview, paginateProfilePdfBlocks, wrapProfilePdfText } from '../lib/profile-pdf.mjs';

const fontBytes = await readFile(new URL('../public/fonts/Manrope.ttf', import.meta.url));
const savedAt = '2026-10-08T08:28:01.176146-04:00';
const accountId = '11111111-1111-4111-8111-111111111111';
const emphasized = ['budgetAmount', 'hasPets', 'activities', 'preferredRegions', 'homeAddress', 'homePoint'];
const remainingFields = Object.keys(PROFILE_FIELD_DEFINITIONS).filter(field => !emphasized.includes(field));
const groups = [
  { title: 'Travel party', fields: emphasized },
  { title: 'Other preferences', fields: remainingFields },
];
const labels = Object.fromEntries(Object.keys(PROFILE_FIELD_DEFINITIONS).map(field => [field, ({ budgetAmount: 'Budget amount',
  hasPets: 'Traveling with pets', activities: 'Activities', preferredRegions: 'Preferred regions',
  homeAddress: 'Home address or anchor', homePoint: 'Resolved home point' })[field] ?? `Preference: ${field}`]));

function answer(value, answered = true) {
  return { value, answered, scope: 'account', updatedAt: answered ? savedAt : null };
}

function profile(overrides = {}) {
  return {
    accountId, revision: 7, updatedAt: savedAt,
    answers: {
      budgetAmount: answer('0'), hasPets: answer(false), activities: answer([], true),
      groupComposition: answer('Solo'),
      homeAddress: answer('12 Example Road'), homePoint: answer({ latitude: 45.5, longitude: -73.6 }),
      preferredRegions: answer([], false),
    },
    vehicles: [], notes: [],
    ...overrides,
  };
}

function preview(overrides = {}) {
  return createProfilePdfPreview({ profile: profile(), acknowledged: { accountId, revision: 7, savedAt }, saveState: 'saved',
    groups, labels, ...overrides });
}

test('preview is limited to explicitly acknowledged current profile and preserves false, zero, empty, and unanswered', () => {
  assert.throws(() => createProfilePdfPreview({ profile: profile(), acknowledged: { accountId, revision: 6, savedAt }, groups, labels, saveState: 'saved' }),
    error => error.code === 'profile_not_confirmed');
  assert.throws(() => createProfilePdfPreview({ profile: profile(), acknowledged: { accountId, revision: 7, savedAt }, groups, labels, saveState: 'uncertain' }),
    error => error.code === 'profile_not_confirmed');
  const result = preview();
  assert.equal(result.revision, 7);
  assert.equal(result.savedAt, savedAt);
  assert.match(result.sections[0].lines.join('\n'), /Budget amount: 0/);
  assert.match(result.sections[0].lines.join('\n'), /Traveling with pets: No/);
  assert.match(result.sections[0].lines.join('\n'), /Activities: None/);
  assert.match(result.sections[0].lines.join('\n'), /Preferred regions: Not specified/);
  assert.doesNotMatch(JSON.stringify(result), /45\.5|-73\.6|11111111/);
  assert.equal(result.completion.percentage, 33);
});

test('sensitive home, notes, removed-note tombstones, and unavailable quotes have explicit preview behavior', () => {
  const current = profile({ notes: [
    { id: '22222222-2222-4222-8222-222222222222', text: 'Keep this note', origin: 'user', selectedQuoteIds: ['quote-id'], userRemoved: false },
    { id: '33333333-3333-4333-8333-333333333333', text: 'Removed text', origin: 'AI', selectedQuoteIds: [], userRemoved: true },
  ] });
  const base = createProfilePdfPreview({ profile: current, acknowledged: { accountId, revision: 7, savedAt }, saveState: 'saved', groups, labels });
  assert.doesNotMatch(JSON.stringify(base), /12 Example Road|Keep this note|quote-id|Removed text/);
  const selected = createProfilePdfPreview({ profile: current, acknowledged: { accountId, revision: 7, savedAt }, saveState: 'saved',
    groups, labels, includeHome: true, includeNotes: true });
  assert.match(JSON.stringify(selected), /12 Example Road/);
  assert.match(JSON.stringify(selected), /Keep this note/);
  assert.doesNotMatch(JSON.stringify(selected), /quote-id|Removed text|45\.5|-73\.6/);
  assert.ok(selected.warnings.some(message => message.includes('quote references')));
  assert.ok(selected.warnings.some(message => message.includes('Removed notes')));
  assert.ok(selected.warnings.some(message => message.includes('resolved home point')));
});

test('long words and URLs wrap by glyph width without loss; multi-page notes render with footered US Letter pages', async () => {
  const longUrl = `https://example.test/${'longsegment'.repeat(28)}`;
  const lines = wrapProfilePdfText(`${longUrl} another-word`, 55, text => text.length * 5);
  assert.ok(lines.length > 3);
  assert.equal(lines.join('').replaceAll(' ', ''), `${longUrl}another-word`);

  const longNote = 'A traveler’s note about a quiet route. '.repeat(240);
  const current = profile({ notes: [{ id: '44444444-4444-4444-8444-444444444444', text: longNote,
    origin: 'user', selectedQuoteIds: [], userRemoved: false }] });
  const options = { profile: current, acknowledged: { accountId, revision: 7, savedAt }, saveState: 'saved',
    groups, labels, includeNotes: true };
  const reviewed = createProfilePdfPreview(options);
  const result = await createProfilePdf({ ...options, preview: reviewed, fontBytes });
  assert.ok(result.pageCount >= 3);
  assert.equal(result.bytes[0], 0x25);
  const loaded = await PDFDocument.load(result.bytes);
  assert.equal(loaded.getPageCount(), result.pageCount);
  for (const page of loaded.getPages()) assert.deepEqual(page.getSize(), { width: 612, height: 792 });
});

test('unsupported font glyphs fail visibly before PDF bytes are produced', async () => {
  const current = profile({ notes: [{ id: '55555555-5555-4555-8555-555555555555', text: 'Unsupported: 🧪',
    origin: 'user', selectedQuoteIds: [], userRemoved: false }] });
  const options = { profile: current, acknowledged: { accountId, revision: 7, savedAt }, saveState: 'saved',
    groups, labels, includeNotes: true };
  const reviewed = createProfilePdfPreview(options);
  await assert.rejects(createProfilePdf({ ...options, preview: reviewed, fontBytes }), error => error.code === 'unsupported_glyph' && /cannot display/.test(error.message));
});

test('reviewed previews are immutable and bound to the exact owner, revision, timestamp, answers, and privacy choices', () => {
  const current = profile();
  const acknowledged = { accountId, revision: 7, savedAt };
  const options = { profile: current, acknowledged, saveState: 'saved', groups, labels, includeHome: true };
  const reviewed = createProfilePdfPreview(options);
  assert.equal(Object.isFrozen(reviewed), true);
  assert.equal(isCurrentProfilePdfPreview(reviewed, options), true);
  current.answers.hasPets = answer(true);
  assert.equal(isCurrentProfilePdfPreview(reviewed, options), false);
  assert.equal(isCurrentProfilePdfPreview({ ...reviewed }, options), false);
});

test('pagination keeps a heading with at least two following content lines when a page can fit them', () => {
  const blocks = [
    ...Array.from({ length: 5 }, (_, index) => ({ kind: 'body', text: `Lead ${index}`, lines: [`Lead ${index}`] })),
    { kind: 'heading', text: 'Next section', lines: ['Next section'] },
    { kind: 'body', text: 'First line', lines: ['First line'] },
    { kind: 'body', text: 'Second line', lines: ['Second line'] },
  ];
  const pages = paginateProfilePdfBlocks(blocks, text => text.length * 5, { height: 190, margin: 20 });
  const headingPage = pages.findIndex(page => page.some(line => line.text === 'Next section'));
  assert.ok(headingPage > 0);
  const texts = pages[headingPage].map(line => line.text);
  assert.ok(texts.indexOf('First line') > texts.indexOf('Next section'));
  assert.ok(texts.indexOf('Second line') > texts.indexOf('Next section'));
});

test('wrapped headings and note subheadings retain two following lines', () => {
  for (const kind of ['heading', 'subheading']) {
    const blocks = [
      ...Array.from({ length: 4 }, () => ({ kind: 'body', lines: ['lead'] })),
      { kind, lines: ['Wrapped title', 'second title line'] },
      { kind: 'body', lines: ['note first', 'note second', 'note third'] },
    ];
    const pages = paginateProfilePdfBlocks(blocks, text => text.length, { height: 190, margin: 20 });
    const page = pages.find(lines => lines.some(line => line.text === 'Wrapped title'));
    assert.ok(page.some(line => line.text === 'note first'));
    assert.ok(page.some(line => line.text === 'note second'));
  }
});
