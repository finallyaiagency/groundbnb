import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { PROFILE_FIELD_DEFINITIONS, validStoredTimestamp, validateProfileAnswerRecords } from './profile-domain.mjs';
import { validateProfileNote, validateProfileVehicle } from './profile-records.mjs';
import { calculateProfileCompletion } from './profile-completion.mjs';

export const PROFILE_PDF_LAYOUT = Object.freeze({
  pageWidth: 612,
  pageHeight: 792,
  margin: 36,
  bodySize: 11,
  headingSize: 16,
  bodyLeading: 15,
  headingLeading: 21,
});

export class ProfilePdfError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProfilePdfError';
    this.code = code;
  }
}

function fail(code, message) { throw new ProfilePdfError(code, message); }
const plainRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const PROFILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const previewBindings = new WeakMap();

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (plainRecord(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function displayAnswer(answer) {
  if (!answer || answer.answered !== true || answer.value === null || answer.value === undefined) return 'Not specified';
  const value = answer.value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'Not specified';
  if (typeof value === 'string') return value.trim() || 'Not specified';
  if (Array.isArray(value)) {
    const items = value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim());
    return items.length ? items.join(', ') : 'None';
  }
  return 'Not specified';
}

function canonicalAnswers(profile) {
  if (!plainRecord(profile) || !plainRecord(profile.answers) || !Number.isSafeInteger(profile.revision) || profile.revision < 0) {
    fail('invalid_profile', 'A canonical saved profile is required to prepare this PDF.');
  }
  if (typeof profile.accountId !== 'string' || !PROFILE_ID.test(profile.accountId)) {
    fail('invalid_profile', 'A canonical saved profile owner is required to prepare this PDF.');
  }
  for (const [field, answer] of Object.entries(profile.answers)) {
    if (!Object.hasOwn(PROFILE_FIELD_DEFINITIONS, field) || !plainRecord(answer) ||
        typeof answer.answered !== 'boolean' || answer.scope !== 'account' || !Object.hasOwn(answer, 'value')) {
      fail('invalid_profile', 'The saved profile contains an unsupported answer.');
    }
  }
  try { validateProfileAnswerRecords(profile.answers); }
  catch { fail('invalid_profile', 'The saved profile contains an invalid answer.'); }
  if (profile.vehicles !== undefined) {
    if (!Array.isArray(profile.vehicles)) fail('invalid_profile', 'The saved vehicle list is invalid.');
    try { profile.vehicles.forEach(vehicle => validateProfileVehicle(vehicle, { canonical: true })); }
    catch { fail('invalid_profile', 'The saved vehicle list is invalid.'); }
  }
  if (profile.notes !== undefined) {
    if (!Array.isArray(profile.notes)) fail('invalid_profile', 'The saved note list is invalid.');
    try { profile.notes.forEach(note => validateProfileNote(note)); }
    catch { fail('invalid_profile', 'The saved note list is invalid.'); }
  }
  return profile.answers;
}

function fieldSections(profile, groups, labels, includeHome) {
  if (!Array.isArray(groups) || !plainRecord(labels)) fail('invalid_labels', 'Profile section labels are unavailable.');
  const answers = profile.answers;
  const allowedFields = new Set(Object.keys(PROFILE_FIELD_DEFINITIONS));
  const homeFields = new Set(['homeAddress', 'homePoint', 'alwaysBeginEndAtHome']);
  const seen = new Set();
  const sections = [];
  for (const group of groups) {
    if (!plainRecord(group) || typeof group.title !== 'string' || !Array.isArray(group.fields)) continue;
    const lines = [];
    for (const field of group.fields) {
      if (!allowedFields.has(field) || seen.has(field) || typeof labels[field] !== 'string' || !labels[field].trim()) {
        fail('invalid_labels', 'Profile section labels do not cover the supported profile fields exactly once.');
      }
      seen.add(field);
      if (!includeHome && homeFields.has(field)) continue;
      // Resolved points have no trusted authored-provenance record in this profile view.
      if (field === 'homePoint') continue;
      lines.push(`${labels[field]}: ${displayAnswer(answers[field])}`);
    }
    if (lines.length) sections.push({ title: group.title, lines });
  }
  if (seen.size !== allowedFields.size) fail('invalid_labels', 'Profile section labels do not cover the supported profile fields exactly once.');
  return sections;
}

function vehicleLines(vehicles) {
  if (!Array.isArray(vehicles) || !vehicles.length) return [];
  return vehicles.filter(vehicle => plainRecord(vehicle)).map((vehicle, index) => {
    const lines = [`Vehicle ${index + 1}: ${safeText(vehicle.name, 'Unnamed vehicle')}`,
      `Type: ${safeText(vehicle.type, 'Not specified')}`,
      `Ownership: ${vehicle.ownership === 'owned' ? 'Owned' : vehicle.ownership === 'rented' ? 'Rented' : 'Not specified'}`];
    if (typeof vehicle.propulsion === 'string' && vehicle.propulsion) lines.push(`Propulsion: ${vehicle.propulsion}`);
    if (plainRecord(vehicle.fuelEconomy) && Number.isFinite(vehicle.fuelEconomy.value) && vehicle.fuelEconomy.value > 0 &&
        typeof vehicle.fuelEconomy.unit === 'string' && vehicle.fuelEconomy.unit.trim()) {
      lines.push(`Fuel use: ${vehicle.fuelEconomy.value} ${vehicle.fuelEconomy.unit}`);
    } else lines.push('Fuel use: Not specified');
    if (plainRecord(vehicle.dimensions)) {
      const dimensions = ['lengthMeters', 'widthMeters', 'heightMeters'].map(key =>
        Number.isFinite(vehicle.dimensions[key]) ? `${vehicle.dimensions[key]} m` : 'Not specified');
      lines.push(`Dimensions (length × width × height): ${dimensions.join(' × ')}`);
    } else lines.push('Dimensions: Not specified');
    return { title: `Vehicle ${index + 1}`, lines };
  });
}

function safeText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

/** Prepare a reviewable representation without rendering internal keys or raw profile objects. */
export function createProfilePdfPreview({ profile, acknowledged, saveState, groups, labels,
  includeHome = false, includeNotes = false } = {}) {
  if (typeof includeHome !== 'boolean' || typeof includeNotes !== 'boolean') {
    fail('invalid_options', 'Choose whether to include home details and saved notes.');
  }
  const answers = canonicalAnswers(profile);
  if (saveState !== 'saved' || !plainRecord(acknowledged) || acknowledged.accountId !== profile.accountId ||
      acknowledged.revision !== profile.revision || !validStoredTimestamp(acknowledged.savedAt) ||
      (profile.updatedAt !== undefined && (!validStoredTimestamp(profile.updatedAt) || profile.updatedAt !== acknowledged.savedAt))) {
    fail('profile_not_confirmed', 'Wait for the latest profile save to finish before exporting.');
  }
  const sections = fieldSections(profile, groups, labels, includeHome);
  const completion = calculateProfileCompletion(profile);
  const warnings = [];
  if (!includeHome) warnings.push('Home details were not included.');
  else if (answers.homePoint?.answered && answers.homePoint.value !== null) {
    warnings.push('The resolved home point was omitted because its location source could not be confirmed.');
  }
  const vehicles = vehicleLines(profile.vehicles);
  if (vehicles.length) sections.push({ title: 'Vehicles', records: vehicles });
  if (Array.isArray(profile.vehicles) && profile.vehicles.some(vehicle => vehicle?.location)) {
    warnings.push('Vehicle map locations were omitted from this PDF.');
  }

  const notes = [];
  if (includeNotes && Array.isArray(profile.notes)) {
    for (const note of profile.notes) {
      if (!plainRecord(note) || note.userRemoved === true || typeof note.text !== 'string' || !note.text.trim()) continue;
      notes.push(note.text);
      if (Array.isArray(note.selectedQuoteIds) && note.selectedQuoteIds.length) {
        warnings.push('Some saved quote references could not be included because their original text was unavailable.');
      }
    }
  }
  if (!includeNotes) warnings.push('Saved notes were not included.');
  if (Array.isArray(profile.notes) && profile.notes.some(note => note?.userRemoved === true)) {
    warnings.push('Removed notes remain excluded.');
  }
  warnings.push('Annual calendar information was not available in this saved profile and was not included.');
  const result = {
    title: 'Your travel profile',
    revision: acknowledged.revision,
    savedAt: profile.updatedAt ?? acknowledged.savedAt,
    completion,
    sections,
    notes,
    warnings: [...new Set(warnings)],
  };
  const frozen = deepFreeze(result);
  previewBindings.set(frozen, stableJson({ profile, acknowledged, saveState, groups, labels, includeHome: includeHome === true, includeNotes: includeNotes === true }));
  return frozen;
}

export function isCurrentProfilePdfPreview(preview, { profile, acknowledged, saveState, groups, labels,
  includeHome = false, includeNotes = false } = {}) {
  const binding = preview && typeof preview === 'object' ? previewBindings.get(preview) : null;
  if (!binding) return false;
  try {
    return binding === stableJson({ profile, acknowledged, saveState, groups, labels,
      includeHome: includeHome === true, includeNotes: includeNotes === true });
  } catch { return false; }
}

function splitLongToken(token, maxWidth, measure) {
  const chunks = [];
  let chunk = '';
  for (const char of token) {
    if (chunk && measure(chunk + char) > maxWidth) {
      chunks.push(chunk);
      chunk = char;
    } else chunk += char;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

export function wrapProfilePdfText(text, maxWidth, measure) {
  if (typeof text !== 'string' || typeof measure !== 'function' || !(maxWidth > 0)) return [];
  const lines = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = '';
    for (const word of words) {
      const pieces = measure(word) <= maxWidth ? [word] : splitLongToken(word, maxWidth, measure);
      for (const piece of pieces) {
        const candidate = line ? `${line} ${piece}` : piece;
        if (line && measure(candidate) > maxWidth) {
          lines.push(line);
          line = piece;
        } else line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function toLayoutBlocks(preview, font) {
  const blocks = [{ kind: 'heading', text: preview.title },
    { kind: 'body', text: `Saved revision ${preview.revision} · ${preview.savedAt}` },
    { kind: 'body', text: `Profile completion: ${preview.completion.percentage}% (${preview.completion.completedCategories} of 3 core categories)` }];
  for (const category of preview.completion.categories) {
    blocks.push({ kind: 'body', text: `${category.title}: ${category.complete ? 'Complete' : 'Not complete'}` });
  }
  for (const section of preview.sections) {
    blocks.push({ kind: 'heading', text: section.title });
    for (const line of section.lines ?? []) blocks.push({ kind: 'body', text: line });
    for (const record of section.records ?? []) {
      blocks.push({ kind: 'subheading', text: record.title });
      for (const line of record.lines) blocks.push({ kind: 'body', text: line });
    }
  }
  if (preview.notes.length) {
    blocks.push({ kind: 'heading', text: 'Saved notes' });
    preview.notes.forEach((note, index) => {
      blocks.push({ kind: 'subheading', text: `Note ${index + 1}` });
      blocks.push({ kind: 'body', text: note });
    });
  }
  if (preview.warnings.length) {
    blocks.push({ kind: 'heading', text: 'Not included' });
    preview.warnings.forEach(warning => blocks.push({ kind: 'body', text: warning }));
  }
  return blocks.map(block => ({ ...block, lines: wrapProfilePdfText(block.text,
    PROFILE_PDF_LAYOUT.pageWidth - 2 * PROFILE_PDF_LAYOUT.margin,
    text => font.widthOfTextAtSize(text, block.kind === 'heading' ? PROFILE_PDF_LAYOUT.headingSize : PROFILE_PDF_LAYOUT.bodySize)) }));
}

/** Paginate blocks; headings stay with two content lines whenever enough content exists. */
export function paginateProfilePdfBlocks(blocks, measure, { width = PROFILE_PDF_LAYOUT.pageWidth,
  height = PROFILE_PDF_LAYOUT.pageHeight, margin = PROFILE_PDF_LAYOUT.margin } = {}) {
  const pages = [[]];
  let y = height - margin;
  const bottom = margin + 24;
  const addPage = () => { pages.push([]); y = height - margin; };
  blocks.forEach((block, index) => {
    const size = block.kind === 'heading' ? PROFILE_PDF_LAYOUT.headingSize : PROFILE_PDF_LAYOUT.bodySize;
    const leading = block.kind === 'heading' ? PROFILE_PDF_LAYOUT.headingLeading : PROFILE_PDF_LAYOUT.bodyLeading;
    const lines = block.lines ?? wrapProfilePdfText(block.text, width - 2 * margin, text => measure(text, size));
    if (block.kind === 'heading' || block.kind === 'subheading') {
      let nextContent = 0;
      for (let next = index + 1; next < blocks.length && nextContent < 2; next++) {
        if (blocks[next].kind === 'heading') break;
        nextContent += (blocks[next].lines ?? []).length || 1;
      }
      const need = lines.length * leading + Math.min(2, nextContent) * PROFILE_PDF_LAYOUT.bodyLeading + 3;
      if (y - need < bottom && pages.at(-1).length) addPage();
    }
    for (const line of lines) {
      if (y - leading < bottom) addPage();
      pages.at(-1).push({ kind: block.kind, text: line, x: margin, y, size });
      y -= leading;
    }
    y -= block.kind === 'heading' ? 3 : 1;
  });
  return pages.filter(page => page.length);
}

function assertFontCovers(fontBytes, texts) {
  let parsed;
  try { parsed = fontkit.create(fontBytes); }
  catch { fail('font_unavailable', 'The profile font could not be read. Try again after the font is available.'); }
  const covered = new Set(parsed.characterSet);
  const missing = new Set();
  for (const text of texts) for (const char of text) {
    const point = char.codePointAt(0);
    if (!covered.has(point) && !/^[\t\n\r ]$/.test(char)) missing.add(char);
  }
  if (missing.size) {
    const sample = [...missing].slice(0, 6).join(' ');
    fail('unsupported_glyph', `The selected font cannot display: ${sample}. PDF export is unavailable for this text.`);
  }
}

/** Build PDF bytes locally from a reviewed, acknowledged profile preview. */
export async function createProfilePdf(input = {}) {
  const { preview } = input;
  if (!isCurrentProfilePdfPreview(preview, input)) fail('preview_stale', 'Review the current saved profile again before exporting.');
  if (!(input.fontBytes instanceof Uint8Array) && !(input.fontBytes instanceof ArrayBuffer)) {
    fail('font_unavailable', 'The profile font is unavailable. Try again after it loads.');
  }
  const fontBytes = input.fontBytes instanceof Uint8Array ? input.fontBytes : new Uint8Array(input.fontBytes);
  const allText = [preview.title, `Saved revision ${preview.revision} · ${preview.savedAt}`,
    `Profile completion: ${preview.completion.percentage}% (${preview.completion.completedCategories} of 3 core categories)`,
    ...preview.completion.categories.map(category => `${category.title}: ${category.complete ? 'Complete' : 'Not complete'}`),
    ...preview.sections.flatMap(section => [section.title, ...(section.lines ?? []), ...(section.records ?? []).flatMap(record => [record.title, ...record.lines])]),
    ...preview.notes, ...preview.warnings];
  assertFontCovers(fontBytes, allText);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  let font;
  try { font = await document.embedFont(fontBytes, { subset: true }); }
  catch { fail('font_unavailable', 'The profile font could not be embedded. Try again after the font is available.'); }
  const blocks = toLayoutBlocks(preview, font);
  const pages = paginateProfilePdfBlocks(blocks, (text, size) => font.widthOfTextAtSize(text, size));
  const { margin, pageWidth, pageHeight } = PROFILE_PDF_LAYOUT;
  pages.forEach((lines, pageIndex) => {
    const page = document.addPage([pageWidth, pageHeight]);
    for (const line of lines) {
      page.drawText(line.text, { x: line.x, y: line.y - line.size, size: line.size, font, color: rgb(0.12, 0.15, 0.19) });
    }
    const footer = `Page ${pageIndex + 1} of ${pages.length}`;
    page.drawText(footer, { x: margin, y: margin + 3, size: 9, font, color: rgb(0.35, 0.38, 0.42) });
  });
  document.setTitle('Your travel profile');
  document.setSubject(`Confirmed profile revision ${preview.revision}`);
  document.setCreator('Groundbnb');
  document.setProducer('Groundbnb profile export');
  return { bytes: await document.save(), preview, pageCount: pages.length };
}
