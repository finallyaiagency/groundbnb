import { PROFILE_CATALOGS, PROFILE_FIELD_DEFINITIONS, validateProfilePatch } from './profile-domain.mjs';

const lists = new Set(['choiceList', 'textList', 'manualChoiceList']);

/** Parse only explicit `Profile label: value` lines; this does not infer missing labels or values. */
export function parseReadableProfileDraft(text, fieldLabels) {
  if (typeof text !== 'string' || text.length > 100_000 || !fieldLabels || typeof fieldLabels !== 'object') {
    return { fields: {}, warnings: [{ field: null, line: null, message: 'Enter text to review using one exact profile label per line.' }] };
  }
  const byLabel = new Map(Object.entries(fieldLabels).map(([field, label]) => [label, field]));
  const grouped = new Map();
  const ambiguous = new Set();
  const warnings = [];
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const colon = line.indexOf(':');
    if (colon < 1) {
      warnings.push({ field: null, line: index + 1, message: 'Use “Profile label: value” for each line.' });
      continue;
    }
    const label = line.slice(0, colon).trim();
    const field = byLabel.get(label);
    if (!field || !Object.hasOwn(PROFILE_FIELD_DEFINITIONS, field)) {
      warnings.push({ field: label || null, line: index + 1, message: 'This label is not an editable profile field; nothing was imported from this line.' });
      continue;
    }
    const definition = PROFILE_FIELD_DEFINITIONS[field];
    if (ambiguous.has(field)) {
      warnings.push({ field, line: index + 1, message: 'This label appears more than once; choose one value in the profile form instead.' });
      continue;
    }
    const raw = line.slice(colon + 1).trim();
    if (field === 'homePoint') {
      warnings.push({ field, line: index + 1, message: 'A resolved home point cannot be imported from readable text.' });
      continue;
    }
    if (!raw || /^not specified$/i.test(raw)) {
      warnings.push({ field, line: index + 1, message: 'Unspecified values were left out; existing preferences are preserved.' });
      continue;
    }
    const values = grouped.get(field) ?? [];
    if (!lists.has(definition.type) && values.length) {
      grouped.delete(field);
      ambiguous.add(field);
      warnings.push({ field, line: index + 1, message: 'This label appears more than once; choose one value in the profile form instead.' });
      continue;
    }
    values.push({ raw, line: index + 1 });
    grouped.set(field, values);
  }

  const fields = {};
  for (const [field, entries] of grouped) {
    const definition = PROFILE_FIELD_DEFINITIONS[field];
    const convert = raw => {
      if (['boolean', 'nullableBoolean'].includes(definition.type)) {
        if (/^yes$/i.test(raw)) return true;
        if (/^no$/i.test(raw)) return false;
        throw new Error('Use Yes or No for this field.');
      }
      if (definition.type === 'choice') {
        const choices = PROFILE_CATALOGS[definition.catalog];
        if (!choices.includes(raw)) throw new Error('Use an exact listed choice, or enter the value in the profile form.');
        return raw;
      }
      if (definition.type === 'choiceList') {
        const choices = PROFILE_CATALOGS[definition.catalog];
        if (!choices.includes(raw)) throw new Error('Use an exact listed choice, or enter the value in the profile form.');
        return raw;
      }
      if (['nullableInteger', 'nullableNumber'].includes(definition.type)) {
        const value = Number(raw);
        if (!Number.isFinite(value)) throw new Error('Use a numeric value, or leave this field out if unknown.');
        return value;
      }
      return raw;
    };
    try {
      const value = lists.has(definition.type) ? entries.map(entry => convert(entry.raw)) : convert(entries[0].raw);
      validateProfilePatch({ [field]: { value, answered: true, scope: 'account' } });
      fields[field] = value;
    } catch (error) {
      for (const entry of entries) warnings.push({ field, line: entry.line,
        message: error instanceof Error ? error.message : 'This value was left out; enter it in the profile form instead.' });
    }
  }
  return { fields, warnings };
}
