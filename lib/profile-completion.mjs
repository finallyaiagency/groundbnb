const CATEGORY_DEFINITIONS = Object.freeze([
  { key: 'traveler', title: 'Traveler', ready: answers => isPresent(answers.groupComposition) &&
    answers.hasPets?.answered === true && typeof answers.hasPets.value === 'boolean' },
  { key: 'vehicle', title: 'Vehicle', ready: answers => isNonemptyList(answers.travelModes) },
  { key: 'preferences', title: 'Preferences', ready: answers =>
    isNonemptyList(answers.overnightPreferences) || isNonemptyList(answers.activities) || isPresent(answers.budgetLevel) },
]);

function isPresent(answer) {
  if (!answer || answer.answered !== true) return false;
  const value = answer.value;
  if (typeof value === 'string') return value.trim().length > 0;
  return typeof value === 'number' || typeof value === 'boolean';
}

function isNonemptyList(answer) {
  return answer?.answered === true && Array.isArray(answer.value) &&
    answer.value.some(item => typeof item === 'string' && item.trim().length > 0);
}

/** Completion uses only canonical answers; pending editor drafts are deliberately not accepted. */
export function calculateProfileCompletion(profile) {
  const answers = profile?.answers && typeof profile.answers === 'object' && !Array.isArray(profile.answers)
    ? profile.answers : {};
  const categories = CATEGORY_DEFINITIONS.map(category => ({
    key: category.key,
    title: category.title,
    complete: category.ready(answers),
  }));
  const completedCategories = categories.filter(category => category.complete).length;
  const percentage = Math.round((completedCategories / categories.length) * 100);
  return { categories, completedCategories, percentage, coreComplete: completedCategories === categories.length };
}

function displayValue(answer) {
  if (!answer || answer.answered !== true || answer.value === null || answer.value === undefined) return 'Not specified';
  const value = answer.value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'Not specified';
  if (typeof value === 'string') return value.trim() || 'Not specified';
  if (Array.isArray(value)) {
    const entries = value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim());
    return entries.length ? entries.join(', ') : 'None';
  }
  // Do not expose coordinates or serialized object fields in a general profile summary.
  return 'Saved';
}

/** Build compact, labeled prose from canonical answers without exposing internal keys or metadata. */
export function createReadableProfileSummary(profile, groups, labels) {
  if (!Array.isArray(groups) || !labels || typeof labels !== 'object') return [];
  const answers = profile?.answers && typeof profile.answers === 'object' && !Array.isArray(profile.answers)
    ? profile.answers : {};
  return groups.map(group => {
    const entries = Array.isArray(group?.fields) ? group.fields : [];
    const parts = entries.filter(field => typeof labels[field] === 'string').map(field =>
      `${labels[field]}: ${displayValue(answers[field])}`);
    return { title: String(group?.title ?? 'Profile'), text: parts.join('; ') };
  }).filter(section => section.text.length > 0);
}
