'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ProfileTransferError, buildProfileExport, createProfileExportPreview, createProfileMergeProposal, previewProfileImport,
} from '@/lib/profile-transfer.mjs';
import {
  advanceRequestGeneration, isCurrentRequestGeneration,
} from '@/lib/profile-editor-state.mjs';
import {
  buildProfileTransferOperation, buildReviewedProfileTransferOperation, isMatchingProfileTransferAcknowledgment,
  preferCurrentCanonicalProfile, selectCanonicalAfterStatusRefresh,
} from '@/lib/profile-transfer-editor-state.mjs';
import { startProfileExportDownload } from '@/lib/profile-export-download.mjs';
import { PROFILE_FIELD_LABELS, type ProfileFieldAnswer } from './profile-fields';
import { parseReadableProfileDraft } from '@/lib/profile-readable-import.mjs';

type Answer = { value: ProfileFieldAnswer['value']; answered: boolean; scope?: 'account'; updatedAt?: string | null };
type Note = { id: string; text: string; origin: 'user' | 'AI'; selectedQuoteIds: string[]; userRemoved: boolean };
type Profile = { accountId?: string; revision: number; answers: Record<string, Answer>; profileNotes?: string[]; notes?: Note[]; vehicles?: unknown[] };
type FieldPatch = Record<string, { value: ProfileFieldAnswer['value']; answered: boolean }>;
type Operation = { operationId: string; expectedRevision: number; patch: FieldPatch; noteUpserts: Array<Omit<Note, 'origin'>> };
type FieldComparison = { current: Answer | null; proposed: Answer };
type Conflict = { currentRevision: number; fieldComparison: { profileFields?: Record<string, FieldComparison>; notes?: Record<string, { current: Note | null; proposed: Note }> } };
type Props = {
  profile: Profile;
  transferMode: 'off' | 'reviewed-v1';
  disabled?: boolean;
  canStartWrite: (reapplyingReviewedTransfer?: boolean) => boolean;
  registerController: (controller: AbortController) => () => void;
  getSessionGeneration: () => number;
  onBusyChange: (busy: boolean) => void;
  onOperationPendingChange: (pending: boolean) => void;
  onProfileUpdate: (profile: Profile) => void;
  onSessionExpired: () => void;
  onApplyPatch: (patch: FieldPatch) => void;
};
type TransferPreview = {
  kind: 'profile-import-preview';
  exportedAt: string;
  fields: Record<string, ProfileFieldAnswer['value']>;
  reviewOnlyFields?: Record<string, unknown>;
  profileNotes: string[];
  warnings: readonly { code: string; field: string | null; message: string }[];
  requiresSensitiveConfirmation: boolean;
};
type ExportPreviewBinding = {
  accountId: string; revision: number; sessionGeneration: number; sourceBinding: string; optionsBinding: string;
};
const buildExportFile = buildProfileExport as unknown as (profile: Profile, options: Record<string, unknown>) => {
  bytes: Uint8Array; contentType: string; text: string;
};
const proposeMerge = createProfileMergeProposal as unknown as (preview: TransferPreview, profile: Profile, options: {
  selectedFields: string[]; selectedNotes: number[]; confirmSensitive: boolean;
}) => { patch: FieldPatch; selectedNoteTextPreview: string[] };
const createTransferOperation = buildProfileTransferOperation as unknown as (input: {
  operationId: string; expectedRevision: number; patch: FieldPatch; noteTexts: string[];
}) => Operation;

function readable(value: ProfileFieldAnswer['value'] | undefined, answered = true) {
  if (!answered || value === null || value === undefined) return 'Not specified';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'None';
  if (typeof value === 'object') return `${value.latitude}, ${value.longitude}`;
  return String(value);
}
function sameValue(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b); }
function errorText(error: unknown) { return error instanceof ProfileTransferError ? error.message : error instanceof Error ? error.message : 'This transfer could not be reviewed.'; }
function warningText(warning: { code: string; field: string | null; message: string }) {
  const field = warning.field ? PROFILE_FIELD_LABELS[warning.field as keyof typeof PROFILE_FIELD_LABELS] ?? warning.field : null;
  switch (warning.code) {
    case 'home_point_provenance_unknown': return 'The saved home point was left out because its original source could not be confirmed.';
    case 'home_point_unverified': return 'This file has a saved home point, but its original source cannot be confirmed. It cannot be imported.';
    case 'home_opt_in_required': return `${field} was left out. Allow home details above if you want to review it.`;
    case 'quotes_opt_in_required': return 'Personal quotes were left out. Turn on quote preview above if you want to review them.';
    case 'authority_field': return `${warning.field} is not a profile preference and was left out.`;
    case 'unknown_envelope_field': return `${warning.field} is not part of a Groundbnb profile and was ignored.`;
    case 'unsupported_tier': return `${warning.field} is not available to import yet.`;
    case 'wrong_scope': return `${field ?? warning.field} belongs to trip settings and was not imported into account preferences.`;
    case 'unknown_field': return `${warning.field} is not a supported profile preference and was left out.`;
    case 'invalid_field': return `${field ?? warning.field}: ${warning.message.replaceAll(warning.field ?? '', field ?? '')}`;
    default: return warning.message;
  }
}

async function trackedJson(registerController: (controller: AbortController) => () => void,
  ownedControllers: Set<AbortController>, url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  ownedControllers.add(controller);
  const unregister = registerController(controller);
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { response, result: await response.json() };
  } finally { clearTimeout(timer); unregister(); ownedControllers.delete(controller); }
}

export default function ProfileTransferControls({ profile, transferMode, disabled = false, canStartWrite, registerController,
  getSessionGeneration, onBusyChange, onOperationPendingChange, onProfileUpdate, onSessionExpired, onApplyPatch }: Props) {
  const [includeExportHome, setIncludeExportHome] = useState(false);
  const [includeExportQuotes, setIncludeExportQuotes] = useState(false);
  const [includeImportHome, setIncludeImportHome] = useState(false);
  const [includeImportQuotes, setIncludeImportQuotes] = useState(false);
  const [confirmSensitive, setConfirmSensitive] = useState(false);
  const [exportPreview, setExportPreview] = useState<ReturnType<typeof createProfileExportPreview> | null>(null);
  const [exportPreviewBinding, setExportPreviewBinding] = useState<ExportPreviewBinding | null>(null);
  const [exportContent, setExportContent] = useState<{
    text: string; accountId: string; revision: number; sessionGeneration: number; sourceBinding: string; optionsBinding: string;
  } | null>(null);
  const [importSource, setImportSource] = useState<'native' | 'readable'>('native');
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<TransferPreview | null>(null);
  const [parseWarnings, setParseWarnings] = useState<readonly { field: string | null; line: number | null; message: string }[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [selectedNotes, setSelectedNotes] = useState<number[]>([]);
  const [pending, setPending] = useState<Operation | null>(null);
  const [retryAllowed, setRetryAllowed] = useState(false);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [selectedConflictKeys, setSelectedConflictKeys] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  const pendingRef = useRef<Operation | null>(null);
  const busyRef = useRef(false);
  const ownedControllers = useRef(new Set<AbortController>());
  const sessionIsCurrent = (captured: number) => captured === getSessionGeneration();
  const sessionGeneration = getSessionGeneration();
  const exportSourceBinding = JSON.stringify({ answers: profile.answers, profileNotes: profile.profileNotes ?? [] });
  const exportOptionsBinding = JSON.stringify({ includeHome: includeExportHome, includeQuotes: includeExportQuotes });
  const exportPreviewIsCurrent = Boolean(exportPreview && profile.accountId && exportPreviewBinding &&
    exportPreviewBinding.accountId === profile.accountId && exportPreviewBinding.revision === profile.revision &&
    exportPreviewBinding.sessionGeneration === sessionGeneration && exportPreviewBinding.sourceBinding === exportSourceBinding &&
    exportPreviewBinding.optionsBinding === exportOptionsBinding);
  if (exportPreview && !exportPreviewIsCurrent) {
    setExportPreview(null);
    setExportPreviewBinding(null);
    setConfirmSensitive(false);
    setExportContent(null);
  }
  const currentExportPreview = exportPreviewIsCurrent ? exportPreview : null;
  if (exportContent && (exportContent.accountId !== profile.accountId || exportContent.revision !== profile.revision ||
      exportContent.sessionGeneration !== sessionGeneration || exportContent.sourceBinding !== exportSourceBinding ||
      exportContent.optionsBinding !== exportOptionsBinding)) setExportContent(null);
  const exportTextVisible = typeof profile.accountId === 'string' && !disabled && !busy && exportContent !== null &&
    exportContent.accountId === profile.accountId && exportContent.revision === profile.revision &&
    exportContent.sessionGeneration === sessionGeneration && exportContent.sourceBinding === exportSourceBinding &&
    exportContent.optionsBinding === exportOptionsBinding;
  const notesAvailable = Array.isArray(profile.profileNotes);

  function setPendingOperation(operation: Operation | null) {
    pendingRef.current = operation;
    setPending(operation);
    onOperationPendingChange(operation !== null);
  }

  useEffect(() => () => {
    generation.current = advanceRequestGeneration(generation.current);
    for (const controller of ownedControllers.current) controller.abort();
    ownedControllers.current.clear();
  }, []);

  function clearExportText() {
    setExportContent(null);
  }

  function clearPreview() {
    clearExportText();
    setExportPreview(null);
    setExportPreviewBinding(null);
    setImportPreview(null);
    setSelectedFields([]);
    setSelectedNotes([]);
    setParseWarnings([]);
    setConfirmSensitive(false);
    setMessage('');
  }

  function reviewExport() {
    clearExportText();
    try {
      const preview = createProfileExportPreview({ ...profile, profileNotes: profile.profileNotes ?? [] }, {
        includeHome: includeExportHome, includeQuotes: includeExportQuotes,
      });
      setExportPreview(preview);
      setExportPreviewBinding({ accountId: profile.accountId ?? '', revision: profile.revision, sessionGeneration,
        sourceBinding: exportSourceBinding, optionsBinding: exportOptionsBinding });
      setConfirmSensitive(false);
      setMessage('Review the included profile values before downloading.');
    } catch (error) { setMessage(errorText(error)); }
  }

  function canUseReviewedExport() {
    return Boolean(profile.accountId && currentExportPreview && !disabled && !busy && !pending && !conflict &&
      sessionGeneration === getSessionGeneration() &&
      (!currentExportPreview.requiresSensitiveConfirmation || confirmSensitive));
  }

  function downloadExport() {
    if (!canUseReviewedExport()) return;
    try {
      const options = { includeHome: includeExportHome, includeQuotes: includeExportQuotes };
      const exportedAt = new Date().toISOString();
      const result = buildExportFile({ ...profile, profileNotes: profile.profileNotes ?? [] }, {
        preview: currentExportPreview!, ...options, confirmSensitive, exportedAt,
      });
      if (!canUseReviewedExport()) return;
      startProfileExportDownload({ bytes: result.bytes, contentType: result.contentType, exportedAt,
        documentPort: document, urlPort: URL, BlobCtor: Blob,
        schedule: (callback: () => void, delay: number) => window.setTimeout(callback, delay) });
      setMessage('Profile file download started.');
    } catch (error) {
      setMessage(error instanceof ProfileTransferError ? error.message : 'Could not start the profile download. Try showing the reviewed JSON to copy.');
    }
  }

  function showExportJsonToCopy() {
    if (!canUseReviewedExport()) return;
    try {
      const options = { includeHome: includeExportHome, includeQuotes: includeExportQuotes };
      const exportSource = { ...profile, profileNotes: profile.profileNotes ?? [] };
      const sourceBinding = JSON.stringify({ answers: exportSource.answers, profileNotes: exportSource.profileNotes });
      const optionsBinding = JSON.stringify(options);
      const result = buildExportFile(exportSource, {
        preview: currentExportPreview!, ...options, confirmSensitive, exportedAt: new Date().toISOString(),
      });
      setExportContent({ text: result.text, accountId: profile.accountId!, revision: profile.revision, sessionGeneration, sourceBinding, optionsBinding });
      setMessage('Reviewed profile JSON is ready to select and copy.');
    } catch (error) { clearExportText(); setMessage(errorText(error)); }
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    try {
      setImportText(await file.text());
      setImportPreview(null);
      setSelectedFields([]);
      setSelectedNotes([]);
      setMessage('File loaded for review.');
    } catch { setMessage('Could not read that file. Choose a UTF-8 profile file or paste its contents.'); }
  }

  function reviewImport() {
    try {
      let source = importText;
      let readableWarnings: typeof parseWarnings = [];
      if (importSource === 'readable') {
        const parsed = parseReadableProfileDraft(importText, PROFILE_FIELD_LABELS);
        readableWarnings = parsed.warnings;
        source = JSON.stringify({ format: 'groundbnb', formatVersion: 1, kind: 'profile',
          exportedAt: new Date().toISOString(), profileFields: parsed.fields, profileNotes: [] });
      }
      const preview = previewProfileImport(source, { includeHome: includeImportHome, includeQuotes: includeImportQuotes }) as TransferPreview;
      setImportPreview(preview);
      setParseWarnings(readableWarnings);
      setSelectedFields([]);
      setSelectedNotes([]);
      setConfirmSensitive(false);
      setMessage('Review each proposed value and select only the changes you want.');
    } catch (error) { setImportPreview(null); setMessage(errorText(error)); }
  }

  const importableFields = importPreview ? Object.keys(importPreview.fields).filter(field => field !== 'homePoint' || importPreview.fields[field] === null) : [];
  const changedFields = importableFields.filter(field => {
    const current = profile.answers[field];
    const proposed = importPreview?.fields[field];
    return !current?.answered || !sameValue(current.value, proposed);
  });
  const selectedChangedFields = selectedFields.filter(field => changedFields.includes(field));
  const hasNotes = selectedNotes.length > 0;
  const canApply = !disabled && !busy && !pending && !conflict && importPreview !== null &&
    (selectedChangedFields.length > 0 || (hasNotes && transferMode === 'reviewed-v1')) &&
    (!importPreview.requiresSensitiveConfirmation || confirmSensitive);

  function handleTransferAcknowledgment(result: { profile: Profile; requestId?: string }, refreshFailed = false) {
    onProfileUpdate(preferCurrentCanonicalProfile(profile, result.profile) as Profile);
    setPendingOperation(null);
    setRetryAllowed(false);
    setConflict(null);
    setSelectedConflictKeys([]);
    setMessage(`${refreshFailed ? 'Save confirmed. The latest profile could not be refreshed; the confirmed save is shown.' : 'Saved.'}${result.requestId ? ` Request: ${result.requestId}` : ''}`);
    setImportPreview(null);
  }

  async function checkStatus(operation: Operation, localGeneration: number, sessionGeneration: number) {
    if (!isCurrentRequestGeneration(localGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return 'stale' as const;
    try {
      const { response, result } = await trackedJson(registerController, ownedControllers.current,
        `/api/account/profile/operations/${encodeURIComponent(operation.operationId)}`,
        { credentials: 'same-origin', cache: 'no-store' });
      if (!isCurrentRequestGeneration(localGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return 'stale' as const;
      if (response.ok && result.status === 'saved' && result.operationKind === 'profile_transfer' &&
          isMatchingProfileTransferAcknowledgment(result, operation, profile.accountId ?? '')) {
        let refreshed: Profile | null = null;
        let refreshFailed = false;
        try {
          const latest = await trackedJson(registerController, ownedControllers.current, '/api/account/profile',
            { credentials: 'same-origin', cache: 'no-store' });
          if (!isCurrentRequestGeneration(localGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return 'stale' as const;
          if (latest.response.status === 401) { onSessionExpired(); return 'saved' as const; }
          const candidate = latest.result?.profile as Profile | undefined;
          if (latest.response.ok && latest.result?.ok === true && candidate !== undefined && candidate.accountId === profile.accountId &&
              Number.isSafeInteger(candidate.revision) && candidate.revision >= result.profile.revision &&
              candidate.answers && Array.isArray(candidate.vehicles) && Array.isArray(candidate.notes)) refreshed = candidate;
          else refreshFailed = true;
        } catch { refreshFailed = true; }
        if (!isCurrentRequestGeneration(localGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return 'stale' as const;
        const canonical = selectCanonicalAfterStatusRefresh(profile, result.profile, refreshed, profile.accountId ?? '') as Profile;
        handleTransferAcknowledgment({ ...result, profile: canonical }, refreshFailed);
        return 'saved' as const;
      }
      if (response.status === 401) { onSessionExpired(); return 'unknown' as const; }
      if (response.ok && result.ok === true && result.status === 'not_found' && result.operationId === operation.operationId) {
        setPendingOperation(operation);
        setRetryAllowed(true);
        setMessage('No completed save was found. Your review is kept. Retry the same save when ready.');
        return 'not_found' as const;
      }
      setMessage('Could not confirm the save. Your exact review is kept. Check again before retrying.');
      return 'unknown' as const;
    } catch {
      if (isCurrentRequestGeneration(localGeneration, generation.current) && sessionIsCurrent(sessionGeneration)) {
        setMessage('Could not confirm the save. Your exact review is kept. Check again before retrying.');
      }
      return 'unknown' as const;
    }
  }

  async function post(operation: Operation, localGeneration: number, sessionGeneration: number) {
    if (!isCurrentRequestGeneration(localGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return;
    try {
      const { response, result } = await trackedJson(registerController, ownedControllers.current, '/api/account/profile/transfer', {
        method: 'PATCH', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(operation),
      });
      if (!isCurrentRequestGeneration(localGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return;
      if (response.ok && isMatchingProfileTransferAcknowledgment(result, operation, profile.accountId ?? '')) {
        handleTransferAcknowledgment(result);
      } else if (response.status === 409 && result.category === 'conflict' && Number.isSafeInteger(result.currentRevision)) {
        const nextConflict = { currentRevision: result.currentRevision, fieldComparison: result.fieldComparison ?? {} } as Conflict;
        setPendingOperation(operation);
        setRetryAllowed(false);
        setConflict(nextConflict);
        const keys = [
          ...Object.keys(nextConflict.fieldComparison.profileFields ?? {}).filter(field => Object.hasOwn(operation.patch, field)).map(field => `profileFields:${field}`),
          ...Object.keys(nextConflict.fieldComparison.notes ?? {}).filter(id => operation.noteUpserts.some(note => note.id === id)).map(id => `notes:${id}`),
        ];
        setSelectedConflictKeys(keys);
        setMessage('Your profile changed elsewhere. Review each saved and proposed value before reapplying selected changes.');
      } else if (response.status === 401) {
        onSessionExpired();
      } else if (response.status === 400) {
        setPendingOperation(null);
        setRetryAllowed(false);
        setMessage(result.message ?? 'The selection was not accepted. Deselect some fields or quotes and review a smaller selection.');
      } else {
        setPendingOperation(operation);
        setMessage(`Save could not be confirmed. Checking its status.${result.requestId ? ` Request: ${result.requestId}` : ''}`);
        await checkStatus(operation, localGeneration, sessionGeneration);
      }
    } catch {
      if (!isCurrentRequestGeneration(localGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return;
      setPendingOperation(operation);
      setMessage('Save could not be confirmed. Checking its status.');
      await checkStatus(operation, localGeneration, sessionGeneration);
    }
  }

  async function runTransfer(operation: Operation, { retry = false, reapplying = false } = {}) {
    if (busyRef.current || (!reapplying && pendingRef.current) || !canStartWrite(reapplying)) {
      setMessage('Finish or review the other profile save before applying this import.'); return;
    }
    generation.current = advanceRequestGeneration(generation.current);
    const localGeneration = generation.current;
    const sessionGeneration = getSessionGeneration();
    busyRef.current = true;
    setBusy(true);
    onBusyChange(true);
    setPendingOperation(operation);
    setRetryAllowed(false);
    if (!reapplying) setConflict(null);
    setMessage(retry ? 'Checking the earlier save before retrying…' : reapplying ? 'Saving reviewed changes…' : 'Saving reviewed import…');
    try {
      if (retry) {
        const status = await checkStatus(operation, localGeneration, sessionGeneration);
        if (status !== 'not_found' || !isCurrentRequestGeneration(localGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return;
      }
      await post(operation, localGeneration, sessionGeneration);
    } finally {
      if (isCurrentRequestGeneration(localGeneration, generation.current) && sessionIsCurrent(sessionGeneration)) {
        busyRef.current = false;
        setBusy(false);
        onBusyChange(false);
      }
    }
  }

  async function checkPending(retry = false) {
    const operation = pendingRef.current;
    if (!operation || busyRef.current) return;
    generation.current = advanceRequestGeneration(generation.current);
    const localGeneration = generation.current;
    const sessionGeneration = getSessionGeneration();
    busyRef.current = true;
    setBusy(true);
    onBusyChange(true);
    setMessage('Checking save status…');
    try {
      const status = await checkStatus(operation, localGeneration, sessionGeneration);
      if (retry && status === 'not_found' && isCurrentRequestGeneration(localGeneration, generation.current) && sessionIsCurrent(sessionGeneration)) {
        setRetryAllowed(false);
        await post(operation, localGeneration, sessionGeneration);
      }
    } finally {
      if (isCurrentRequestGeneration(localGeneration, generation.current) && sessionIsCurrent(sessionGeneration)) {
        busyRef.current = false;
        setBusy(false);
        onBusyChange(false);
      }
    }
  }

  async function discardConflict() {
    if (!conflict || !pending || busyRef.current) return;
    generation.current = advanceRequestGeneration(generation.current);
    const localGeneration = generation.current;
    const sessionGeneration = getSessionGeneration();
    busyRef.current = true;
    setBusy(true);
    onBusyChange(true);
    setMessage('Loading the latest saved profile…');
    try {
      const { response, result } = await trackedJson(registerController, ownedControllers.current,
        '/api/account/profile', { credentials: 'same-origin', cache: 'no-store' });
      if (!isCurrentRequestGeneration(localGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return;
      if (response.status === 401) { onSessionExpired(); return; }
      if (!response.ok || result.ok !== true || result.profile?.accountId !== profile.accountId ||
          !Number.isSafeInteger(result.profile?.revision) || !result.profile?.answers ||
          !Array.isArray(result.profile?.vehicles) || !Array.isArray(result.profile?.notes)) {
        setMessage('Could not load the latest profile. Your conflict review is kept.'); return;
      }
      onProfileUpdate(result.profile);
      setPendingOperation(null);
      setRetryAllowed(false);
      setConflict(null);
      setSelectedConflictKeys([]);
      setMessage('Your proposed import was discarded. The latest saved profile is shown.');
    } catch {
      if (isCurrentRequestGeneration(localGeneration, generation.current) && sessionIsCurrent(sessionGeneration)) setMessage('Could not load the latest profile. Your conflict review is kept.');
    } finally {
      if (isCurrentRequestGeneration(localGeneration, generation.current) && sessionIsCurrent(sessionGeneration)) {
        busyRef.current = false;
        setBusy(false);
        onBusyChange(false);
      }
    }
  }

  function applyImport() {
    if (!importPreview || !canApply) return;
    try {
      const proposal = proposeMerge(importPreview, profile, {
        selectedFields: selectedChangedFields, selectedNotes, confirmSensitive,
      });
      if (transferMode === 'reviewed-v1') {
        const operation = createTransferOperation({ operationId: crypto.randomUUID(), expectedRevision: profile.revision,
          patch: proposal.patch, noteTexts: proposal.selectedNoteTextPreview });
        void runTransfer(operation);
      } else if (selectedChangedFields.length > 0 && selectedNotes.length === 0) {
        onApplyPatch(proposal.patch);
        setMessage('Selected profile changes were sent for saving.');
        setImportPreview(null);
      }
    } catch (error) { setMessage(errorText(error)); }
  }

  function reapplyConflict() {
    if (!pending || !conflict || !selectedConflictKeys.length || !canStartWrite(true)) return;
    try {
      const operation = buildReviewedProfileTransferOperation({ pending, currentRevision: conflict.currentRevision,
        selectedKeys: selectedConflictKeys, fieldComparison: conflict.fieldComparison, operationId: crypto.randomUUID() });
      void runTransfer(operation, { reapplying: true });
    } catch (error) { setMessage(errorText(error)); }
  }

  const isDisabled = disabled || busy || pending !== null || conflict !== null;
  return <details className="profile-transfer">
    <summary>Import or export profile</summary>
    <p role="status" aria-live="polite">{message}</p>
    <section aria-labelledby="profile-export-heading">
      <h3 id="profile-export-heading">Export profile</h3>
      <p>Review the values in the file before downloading. Home details and personal quotes are optional.</p>
      <label><input type="checkbox" style={{ width: 'auto' }} disabled={disabled} checked={includeExportHome}
        onChange={event => { setIncludeExportHome(event.target.checked); clearPreview(); }} />Include home details</label>
      <label><input type="checkbox" style={{ width: 'auto' }} disabled={disabled || !notesAvailable} checked={includeExportQuotes}
        onChange={event => { setIncludeExportQuotes(event.target.checked); clearPreview(); }} />Include personal quotes</label>
      {!notesAvailable && <p>Personal quotes are not available to export from this profile yet.</p>}
      <button type="button" disabled={disabled || busy} onClick={reviewExport}>Review export</button>
      {currentExportPreview && <div aria-label="Export preview">
        <h4>Included profile values</h4>
        {Object.entries(currentExportPreview.profileFields).length ? <dl>{Object.entries(currentExportPreview.profileFields).map(([field, value]) => <div key={field}>
          <dt>{PROFILE_FIELD_LABELS[field as keyof typeof PROFILE_FIELD_LABELS] ?? field}</dt><dd>{readable(value as ProfileFieldAnswer['value'])}</dd>
        </div>)}</dl> : <p>No answered profile values are included.</p>}
        <h4>Included personal quotes</h4>
        {currentExportPreview.profileNotes.length ? <ul>{currentExportPreview.profileNotes.map((quote: string, index: number) => <li key={`${index}-${quote}`}>{quote}</li>)}</ul> : <p>None.</p>}
        {(currentExportPreview.warnings as readonly { code: string; field: string | null; message: string }[]).map((warning, index) => <p key={`${warning.code}-${index}`}>{warningText(warning)}</p>)}
        {currentExportPreview.requiresSensitiveConfirmation && <label><input type="checkbox" style={{ width: 'auto' }} disabled={disabled}
          checked={confirmSensitive} onChange={event => { setConfirmSensitive(event.target.checked); clearExportText(); }} />I reviewed these home details and quotes and want them in the file.</label>}
        <button type="button" disabled={!canUseReviewedExport()} onClick={downloadExport}>Download profile file</button>
        <button type="button" disabled={exportTextVisible ? false : !canUseReviewedExport()}
          onClick={exportTextVisible ? clearExportText : showExportJsonToCopy}>
          {exportTextVisible ? 'Hide profile JSON' : 'Show JSON to copy'}
        </button>
        {exportTextVisible && <div aria-label="Profile JSON to copy">
          <p>Select and copy this reviewed text if the file download is unavailable. It stays in this page only.</p>
          <label htmlFor="profile-export-json">Reviewed profile JSON</label>
          <textarea id="profile-export-json" value={exportContent?.text ?? ''} readOnly rows={12}
            onFocus={event => event.currentTarget.select()} />
        </div>}
      </div>}
    </section>

    <section aria-labelledby="profile-import-heading">
      <h3 id="profile-import-heading">Import profile</h3>
      <p>Choose a Groundbnb profile JSON file, paste its contents, or review readable text as explicitly labeled values.</p>
      <label htmlFor="profile-import-mode">Import format</label>
      <select id="profile-import-mode" disabled={isDisabled} value={importSource} onChange={event => { setImportSource(event.target.value as typeof importSource); clearPreview(); }}>
        <option value="native">Groundbnb profile JSON</option><option value="readable">Readable text draft</option>
      </select>
      {importSource === 'native' && <label htmlFor="profile-import-file">Choose profile file<input id="profile-import-file" type="file" accept="application/json,.json" disabled={isDisabled}
        onChange={event => void loadFile(event.target.files?.[0])} /></label>}
      <label htmlFor="profile-import-text">{importSource === 'native' ? 'Profile file contents' : 'Readable profile text'}</label>
      <textarea id="profile-import-text" value={importText} disabled={isDisabled} onChange={event => { setImportText(event.target.value); setImportPreview(null); }} />
      {importSource === 'readable' && <p>Use one exact profile label per line, followed by a colon and value. Repeat a label for list choices. Unclear or unsupported lines are left out for manual entry.</p>}
      <label><input type="checkbox" style={{ width: 'auto' }} disabled={isDisabled} checked={includeImportHome}
        onChange={event => { setIncludeImportHome(event.target.checked); clearPreview(); }} />Allow home details in this import</label>
      <label><input type="checkbox" style={{ width: 'auto' }} disabled={isDisabled} checked={includeImportQuotes}
        onChange={event => { setIncludeImportQuotes(event.target.checked); clearPreview(); }} />Preview personal quotes in this import</label>
      <button type="button" disabled={isDisabled || !importText.trim()} onClick={reviewImport}>Review import</button>
      {importPreview && <div aria-label="Import preview">
        <h4>Profile field changes</h4>
        {changedFields.length ? <ul>{changedFields.map(field => {
          const current = profile.answers[field];
          return <li key={field}><label><input type="checkbox" style={{ width: 'auto' }} disabled={isDisabled} checked={selectedFields.includes(field)}
            onChange={event => setSelectedFields(previous => event.target.checked ? [...previous, field] : previous.filter(item => item !== field))} />
            <strong>{PROFILE_FIELD_LABELS[field as keyof typeof PROFILE_FIELD_LABELS] ?? field}</strong>: {readable(current?.value, current?.answered)} → {readable(importPreview.fields[field])}</label></li>;
        })}</ul> : <p>No profile field changes were proposed.</p>}
        {importPreview.reviewOnlyFields?.homePoint !== undefined && <p>The resolved home point cannot be imported because its original source cannot be confirmed. The typed home address can still be reviewed separately.</p>}
        {importPreview.warnings.map((warning, index) => <p key={`${warning.code}-${index}`}>{warningText(warning)}</p>)}
        {parseWarnings.map((warning, index) => <p key={`parse-${index}`}>{warning.line ? `Line ${warning.line}: ` : ''}{warning.message}</p>)}
        <h4>Personal quotes</h4>
        {importPreview.profileNotes.length ? <ul>{importPreview.profileNotes.map((quote, index) => <li key={`${index}-${quote}`}>
          <label><input type="checkbox" style={{ width: 'auto' }} disabled={isDisabled || transferMode !== 'reviewed-v1'} checked={selectedNotes.includes(index)}
            onChange={event => setSelectedNotes(previous => event.target.checked ? [...previous, index] : previous.filter(item => item !== index))} />{quote}</label>
        </li>)}</ul> : <p>No personal quotes are included.</p>}
        {transferMode !== 'reviewed-v1' && importPreview.profileNotes.length > 0 && <p>Quotes can be reviewed here; saving them is not available yet.</p>}
        {selectedNotes.length > 0 && <p>Selected quotes will be saved as new personal notes.</p>}
        {selectedFields.length > 0 && selectedNotes.length > 0 && transferMode !== 'reviewed-v1' && <p>Apply profile fields and quotes separately.</p>}
        {importPreview.requiresSensitiveConfirmation && <label><input type="checkbox" style={{ width: 'auto' }} disabled={isDisabled}
          checked={confirmSensitive} onChange={event => setConfirmSensitive(event.target.checked)} />I reviewed the selected home details and quotes and want to include them.</label>}
        <button type="button" disabled={!canApply} onClick={applyImport}>Apply selected changes</button>
      </div>}
    </section>

    {pending && !conflict && <div aria-label="Transfer save recovery">
      <button type="button" disabled={busy} onClick={() => void checkPending()}>Check save status</button>
      {retryAllowed && <button type="button" disabled={busy} onClick={() => void checkPending(true)}>Retry same save</button>}
    </div>}
    {conflict && pending && <section aria-label="Review changed import values">
      <h3>Review profile changes</h3>
      {Object.entries(conflict.fieldComparison.profileFields ?? {}).map(([field, values]) => {
        const proposed = pending.patch[field];
        const selectable = proposed !== undefined;
        const key = `profileFields:${field}`;
        return <label key={key}>
          <input type="checkbox" style={{ width: 'auto' }} disabled={!selectable || busy} checked={selectedConflictKeys.includes(key)} onChange={event => setSelectedConflictKeys(previous =>
            event.target.checked ? [...previous, key] : previous.filter(item => item !== key))} />
          <strong>{PROFILE_FIELD_LABELS[field as keyof typeof PROFILE_FIELD_LABELS] ?? field}</strong>: saved — {readable(values.current?.value, values.current?.answered)}; proposed — {readable(proposed?.value, proposed?.answered)}
          {!selectable && <span> (updated with the selected home address)</span>}
        </label>;
      })}
      {Object.entries(conflict.fieldComparison.notes ?? {}).map(([id, values]) => {
        const key = `notes:${id}`;
        const note = pending.noteUpserts.find(item => item.id === id);
        return <label key={key}>
          <input type="checkbox" style={{ width: 'auto' }} disabled={!note || values.current !== null || busy} checked={selectedConflictKeys.includes(key)} onChange={event => setSelectedConflictKeys(previous =>
            event.target.checked ? [...previous, key] : previous.filter(item => item !== key))} />
          Personal quote: saved — {values.current?.text ?? 'not present'}; proposed — {note?.text ?? values.proposed.text}
          {values.current && <span> This new note ID is already present, so it cannot be re-added.</span>}
        </label>;
      })}
      <button type="button" disabled={busy || !selectedConflictKeys.length} onClick={reapplyConflict}>Save selected changes</button>
      <button type="button" disabled={busy} onClick={() => void discardConflict()}>Discard draft and load latest</button>
    </section>}
  </details>;
}
