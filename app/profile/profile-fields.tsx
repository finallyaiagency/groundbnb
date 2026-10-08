'use client';

import { PROFILE_CATALOGS, PROFILE_FIELD_DEFINITIONS } from '@/lib/profile-domain.mjs';

type Scalar = string | number | boolean | null;
type AnswerValue = Scalar | string[] | { latitude: number; longitude: number };
export type ProfileFieldAnswer = {
  value: AnswerValue;
  answered: boolean;
  scope?: 'account';
  updatedAt?: string | null;
};

type FieldName = keyof typeof PROFILE_FIELD_DEFINITIONS;
type FieldMeta = { label: string; description?: string };
type FieldGroup = { title: string; fields: readonly FieldName[] };

export type ProfileFieldsProps = {
  canonicalAnswers: Partial<Record<FieldName, ProfileFieldAnswer>>;
  draftAnswers: Partial<Record<FieldName, ProfileFieldAnswer>>;
  dirtyFields: ReadonlySet<FieldName> | Partial<Record<FieldName, boolean>>;
  onDraftChange: (field: FieldName, answer: ProfileFieldAnswer) => void;
  onDirtyChange: (field: FieldName, dirty: boolean) => void;
  validationErrors?: Partial<Record<FieldName, string>>;
  disabled?: boolean;
  pending?: boolean;
};

const FIELD_META: Record<FieldName, FieldMeta> = {
  homeAddress: { label: 'Home address or anchor', description: 'Enter the address or place name you want to use as your home anchor.' },
  homePoint: { label: 'Resolved home point', description: 'The address you entered is kept if it cannot be located. This point is read-only.' },
  alwaysBeginEndAtHome: { label: 'Usually begin and end trips at home' },
  groupComposition: { label: 'Travel party' },
  travelerCount: { label: 'Number of travelers' },
  ageGroups: { label: 'Age groups traveling' },
  hasPets: { label: 'Traveling with pets' },
  petTypes: { label: 'Pet types' },
  preferredRegions: { label: 'Preferred regions', description: 'Enter one region per line.' },
  dietaryRequirements: { label: 'Dietary requirements' },
  specialRequirements: { label: 'Accessibility and support needs' },
  travelModes: { label: 'Usual travel modes' },
  travelSeason: { label: 'Preferred travel season' },
  overnightPreferences: { label: 'Overnight preferences', description: 'Enter one preference per line. Your entries are saved as written.' },
  activities: { label: 'Preferred activities' },
  drivingPace: { label: 'Driving pace' },
  maxDrivingHoursPerDay: { label: 'Maximum driving hours per day' },
  budgetLevel: { label: 'Budget level' },
  budgetMode: { label: 'Budget basis' },
  budgetTimeframe: { label: 'Budget timeframe' },
  budgetAmount: { label: 'Budget amount' },
  budgetCurrency: { label: 'Budget currency' },
  comfortLevel: { label: 'Comfort level' },
  allowSplurge: { label: 'Allow splurges' },
  splurgeAmount: { label: 'Splurge amount' },
  splurgeCurrency: { label: 'Splurge currency' },
  splurgeMode: { label: 'Splurge basis' },
  splurgeTimeframe: { label: 'Splurge timeframe' },
  splurgeFrequency: { label: 'Splurge frequency' },
  splurgeTypes: { label: 'Splurge types' },
  needsFoodAccess: { label: 'Need reliable food access' },
  needsFacilities: { label: 'Need facilities' },
  needsWalkableTransit: { label: 'Need walkable transit' },
  includeSupportServices: { label: 'Include support services' },
  avoidHighways: { label: 'Avoid highways' },
  preferScenic: { label: 'Prefer scenic routes' },
  avoidTolls: { label: 'Avoid tolls' },
  avoidMountainRoutes: { label: 'Avoid mountain routes' },
  accessibility: { label: 'Accessibility preference' },
  needHookups: { label: 'Hookups preference' },
  sustainability: { label: 'Sustainability preference' },
  planningStyle: { label: 'Planning style' },
  budgetSensitivity: { label: 'Budget sensitivity' },
  preferredTransport: { label: 'Preferred transport' },
  travelScope: { label: 'Travel scope' },
  climate: { label: 'Preferred climate' },
  riskTolerance: { label: 'Risk tolerance' },
  physicalCapacity: { label: 'Physical activity level' },
  planningHorizon: { label: 'Planning horizon' },
  willingToReposition: { label: 'Open to nearby-region alternatives' },
  comparisonMode: { label: 'Compare multiple trip options' },
  terrain: { label: 'Preferred terrain' },
  incomeOffsets: { label: 'Income offsets', description: 'Enter one preference per line. Your entries are saved as written.' },
  legalSafety: { label: 'Legal and safety requirements' },
  emotionalGoals: { label: 'Travel goals' },
};

const FIELD_GROUPS: readonly FieldGroup[] = [
  { title: 'Home and travel party', fields: [
    'homeAddress', 'homePoint', 'alwaysBeginEndAtHome', 'groupComposition', 'travelerCount', 'ageGroups', 'hasPets', 'petTypes',
    'preferredRegions', 'dietaryRequirements', 'specialRequirements',
  ] },
  { title: 'Travel defaults', fields: [
    'travelModes', 'travelSeason', 'overnightPreferences', 'activities', 'drivingPace', 'maxDrivingHoursPerDay',
  ] },
  { title: 'Budget and comfort', fields: [
    'budgetLevel', 'budgetMode', 'budgetTimeframe', 'budgetAmount', 'budgetCurrency', 'comfortLevel',
  ] },
  { title: 'Splurge preferences', fields: [
    'allowSplurge', 'splurgeAmount', 'splurgeCurrency', 'splurgeMode', 'splurgeTimeframe', 'splurgeFrequency', 'splurgeTypes',
  ] },
  { title: 'Food and support', fields: [
    'needsFoodAccess', 'needsFacilities', 'needsWalkableTransit', 'includeSupportServices',
  ] },
  { title: 'Route preferences', fields: [
    'avoidHighways', 'preferScenic', 'avoidTolls', 'avoidMountainRoutes', 'accessibility', 'needHookups', 'sustainability',
    'planningStyle', 'budgetSensitivity',
  ] },
  { title: 'Broader travel preferences', fields: [
    'preferredTransport', 'travelScope', 'climate', 'riskTolerance', 'physicalCapacity', 'planningHorizon',
    'willingToReposition', 'comparisonMode', 'terrain', 'incomeOffsets', 'legalSafety', 'emotionalGoals',
  ] },
];

const groupedFieldNames = FIELD_GROUPS.flatMap(({ fields }) => fields);
const uniqueGroupedFieldNames = new Set(groupedFieldNames);
if (uniqueGroupedFieldNames.size !== groupedFieldNames.length ||
    Object.keys(FIELD_META).length !== Object.keys(PROFILE_FIELD_DEFINITIONS).length ||
    Object.keys(PROFILE_FIELD_DEFINITIONS).some(field => !uniqueGroupedFieldNames.has(field as FieldName))) {
  throw new Error('Profile field labels and sections must cover each supported v1 account field exactly once.');
}

function isDirty(dirtyFields: ProfileFieldsProps['dirtyFields'], field: FieldName) {
  if (typeof (dirtyFields as ReadonlySet<FieldName>).has === 'function') return (dirtyFields as ReadonlySet<FieldName>).has(field);
  return (dirtyFields as Partial<Record<FieldName, boolean>>)[field] === true;
}

function answerValue(answers: ProfileFieldsProps['canonicalAnswers'], field: FieldName): ProfileFieldAnswer {
  const type = PROFILE_FIELD_DEFINITIONS[field].type;
  const isList = ['choiceList', 'textList', 'manualChoiceList'].includes(type);
  return answers[field] ?? { value: isList ? [] : null, answered: false, scope: 'account' };
}

function draftValue(props: ProfileFieldsProps, field: FieldName): ProfileFieldAnswer {
  return props.draftAnswers[field] ?? answerValue(props.canonicalAnswers, field);
}

function changed(props: ProfileFieldsProps, field: FieldName, value: AnswerValue, answered: boolean) {
  props.onDraftChange(field, { value, answered, scope: 'account' });
  props.onDirtyChange(field, true);
}

function selectedValues(value: AnswerValue): string[] {
  return Array.isArray(value) ? value : [];
}

function renderField(props: ProfileFieldsProps, field: FieldName) {
  const definition = PROFILE_FIELD_DEFINITIONS[field];
  const answer = draftValue(props, field);
  const value = answer.value;
  const meta = FIELD_META[field];
  const id = `profile-${field}`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const error = props.validationErrors?.[field];
  const describedBy = [meta.description ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const dirty = isDirty(props.dirtyFields, field);
  const readonly = field === 'homePoint';
  const common = { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined };

  let control: React.ReactNode;
  switch (definition.type) {
    case 'boolean':
    case 'nullableBoolean':
      control = <select {...common} value={answer.answered && typeof value === 'boolean' ? String(value) : ''}
        onChange={event => changed(props, field, event.target.value === '' ? null : event.target.value === 'true', event.target.value !== '')}>
        <option value="">Not specified</option><option value="true">Yes</option><option value="false">No</option>
      </select>;
      break;
    case 'choice': {
      const choices = PROFILE_CATALOGS[definition.catalog as keyof typeof PROFILE_CATALOGS] ?? [];
      control = <select {...common} value={answer.answered && typeof value === 'string' ? value : ''}
        onChange={event => changed(props, field, event.target.value || null, event.target.value !== '')}>
        <option value="">Not specified</option>{choices.map(choice => <option key={choice} value={choice}>{choice}</option>)}
      </select>;
      break;
    }
    case 'choiceList': {
      const choices = PROFILE_CATALOGS[definition.catalog as keyof typeof PROFILE_CATALOGS] ?? [];
      const selected = selectedValues(value);
      control = <fieldset className="profile-choice-list" aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
        <legend>{meta.label}</legend>
        {choices.map(choice => <label key={choice}>
        <input type="checkbox" style={{ width: 'auto' }} checked={selected.includes(choice)} onChange={event => {
            const next = event.target.checked ? [...selected, choice] : selected.filter(item => item !== choice);
            changed(props, field, next, answer.answered || event.target.checked);
          }} />{choice}
        </label>)}
        <label className="profile-unspecified"><input type="checkbox" style={{ width: 'auto' }} checked={!answer.answered}
          onChange={event => changed(props, field, [], !event.target.checked)} />Not specified</label>
      </fieldset>;
      break;
    }
    case 'textList':
    case 'manualChoiceList': {
      const list = selectedValues(value);
      control = <>
        <textarea {...common} value={list.join('\n')} onChange={event => {
          const next = event.target.value === '' ? [] : event.target.value.split('\n');
          changed(props, field, next, true);
        }} />
        <label className="profile-unspecified"><input type="checkbox" style={{ width: 'auto' }} checked={!answer.answered}
          onChange={event => changed(props, field, [], !event.target.checked)} />Not specified</label>
        {definition.type === 'manualChoiceList' && <small>Enter one value per line. Your entries are saved as written.</small>}
      </>;
      break;
    }
    case 'nullableInteger':
    case 'nullableNumber': {
      const numeric = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
      control = <>
        <input {...common} type="text" inputMode={definition.type === 'nullableInteger' ? 'numeric' : 'decimal'}
          value={numeric} onChange={event => changed(props, field, event.target.value === '' ? null : event.target.value, event.target.value !== '')}
          onBlur={event => {
            const raw = event.target.value.trim();
            if (!raw) return;
            const parsed = Number(raw);
            if (Number.isFinite(parsed) && (definition.type !== 'nullableInteger' || Number.isSafeInteger(parsed))) changed(props, field, parsed, true);
          }} />
      </>;
      break;
    }
    case 'nullableDecimal':
      control = <>
        <input {...common} type="text" inputMode="decimal" value={typeof value === 'string' ? value : ''}
          onChange={event => changed(props, field, event.target.value === '' ? null : event.target.value, event.target.value !== '')} />
      </>;
      break;
    case 'nullableCurrency':
      control = <>
        <input {...common} type="text" inputMode="text" autoCapitalize="characters" maxLength={3} pattern="[A-Z]{3}"
          value={typeof value === 'string' ? value : ''}
          onChange={event => changed(props, field, event.target.value === '' ? null : event.target.value.toUpperCase(), event.target.value !== '')} />
        <small>Use a three-letter ISO currency code, such as USD.</small>
      </>;
      break;
    case 'nullablePoint':
      control = <output id={id} aria-labelledby={`${id}-label`} aria-describedby={describedBy}>
        {value && typeof value === 'object' && !Array.isArray(value)
          ? `${value.latitude}, ${value.longitude}`
          : 'Not resolved'}
        <span className="visually-hidden"> Read-only.</span>
      </output>;
      break;
    case 'text':
      control = field === 'homeAddress'
        ? <input {...common} type="text" value={typeof value === 'string' ? value : ''}
            onChange={event => changed(props, field, event.target.value === '' ? null : event.target.value, event.target.value !== '')} />
        : <textarea {...common} value={typeof value === 'string' ? value : ''}
            onChange={event => changed(props, field, event.target.value === '' ? null : event.target.value, event.target.value !== '')} />;
      break;
    default:
      control = <p>This preference cannot be edited here.</p>;
  }

  return <div className={`profile-field${dirty ? ' is-dirty' : ''}`} key={field}>
    {definition.type === 'choiceList' || readonly
      ? <span id={`${id}-label`} className="profile-field-label">{meta.label}</span>
      : <label id={`${id}-label`} htmlFor={id}>{meta.label}</label>}
    {meta.description && <p id={helpId} className="profile-field-help">{meta.description}</p>}
    <div className="profile-field-control" aria-disabled={(props.disabled || props.pending || readonly) || undefined}>{control}</div>
    {dirty && <span className="profile-dirty-indicator">Unsaved edit</span>}
    {!answer.answered && field !== 'homePoint' && <span className="profile-answer-state">Not specified</span>}
    {error && <p id={errorId} role="alert" className="profile-field-error">{error}</p>}
  </div>;
}

export default function ProfileFields(props: ProfileFieldsProps) {
  const disabled = props.disabled === true || props.pending === true;
  const splurge = draftValue(props, 'allowSplurge');
  return <section className="account-form profile-fields" aria-label="Account profile preferences" aria-busy={props.pending || undefined}>
    {props.pending && <p role="status" aria-live="polite">Saving profile changes…</p>}
    {FIELD_GROUPS.map(group => {
      const fields = group.title === 'Splurge preferences'
        ? splurge.answered && splurge.value === true ? group.fields : (['allowSplurge'] as const)
        : group.fields;
      return <fieldset className="profile-section" disabled={disabled} key={group.title}>
        <legend>{group.title}</legend>
        {fields.map(field => renderField(props, field))}
        {group.title === 'Splurge preferences' && !(splurge.answered && splurge.value === true) &&
          <p className="profile-inactive-note">These details are kept when splurges are off.</p>}
      </fieldset>;
    })}
  </section>;
}
