'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import ProfileFields, { PROFILE_FIELD_GROUPS, PROFILE_FIELD_LABELS, type ProfileFieldAnswer } from './profile-fields';
import { PROFILE_FIELD_DEFINITIONS, validateProfilePatch } from '@/lib/profile-domain.mjs';
import { acknowledgedDraftFields, advanceRequestGeneration, createDebouncedTask, isCurrentRequestGeneration, isMatchingProfileAcknowledgment, pendingTextAutosaveFields } from '@/lib/profile-editor-state.mjs';
import ProfileTransferControls from './profile-transfer-controls';
import ProfileRecordsControls from './profile-records-controls';
import { preferCurrentCanonicalProfile, selectCanonicalAfterStatusRefresh } from '@/lib/profile-transfer-editor-state.mjs';
import { calculateProfileCompletion, createReadableProfileSummary } from '@/lib/profile-completion.mjs';

type Value = string | number | boolean | string[] | { latitude: number; longitude: number } | null;
type Answer = { value: Value; answered: boolean; scope?: 'account'; updatedAt?: string | null };
type ProfileVehicle = { id: string; name: string; type: string; ownership: 'owned' | 'rented'; propulsion: string | null;
  fuelEconomy: { value: number; unit: string; origin?: 'user' } | null;
  dimensions: { lengthMeters: number | null; widthMeters: number | null; heightMeters: number | null } | null;
  location: { latitude: number; longitude: number; origin?: 'user' } | null; locationVerifiedAt: string | null };
type ProfileNote = { id: string; text: string; origin: 'user' | 'AI'; selectedQuoteIds: string[]; userRemoved: boolean };
type Profile = { accountId?: string; revision: number; answers: Record<string, Answer>; updatedAt?: string; vehicles?: ProfileVehicle[]; notes?: ProfileNote[] };
type Operation = { operationId: string; expectedRevision: number; patch: Record<string, { value: Value; answered: boolean }> };
type Conflict = { currentRevision: number; fieldComparison: Record<string, { current: Answer | null; proposed: Answer }> };
type Mode = 'smoke' | 'full-v1';
const SMOKE_FIELDS = ['travelerCount', 'hasPets', 'dietaryRequirements'] as const;
const EMPTY_SMOKE = { travelerCount: '', hasPets: '', dietaryRequirements: '' };
const TEXT_TYPES = new Set(['text', 'textList', 'manualChoiceList']);

function readable(answer: Answer | null | undefined) {
  if (!answer?.answered || answer.value === null) return 'Not specified';
  if (typeof answer.value === 'boolean') return answer.value ? 'Yes' : 'No';
  if (Array.isArray(answer.value)) return answer.value.length ? answer.value.join(', ') : 'None';
  if (typeof answer.value === 'object') return `${answer.value.latitude}, ${answer.value.longitude}`;
  return String(answer.value);
}

function fieldError(error: unknown) {
  return error instanceof Error ? error.message : 'Review this value and try again.';
}

async function trackedJson(controllers: Set<AbortController>, url: string, init: RequestInit = {}, timeoutMs = 25_000) {
  const controller = new AbortController();
  controllers.add(controller);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const result = await response.json();
    return { response, result };
  } finally {
    clearTimeout(timer);
    controllers.delete(controller);
  }
}

function normalizeDraftAnswer(field: string, answer: ProfileFieldAnswer): ProfileFieldAnswer {
  const type = (PROFILE_FIELD_DEFINITIONS as Record<string, { type: string }>)[field]?.type;
  let value = answer.value;
  if (typeof value === 'string' && value.trim() === '' && ['nullableInteger', 'nullableNumber', 'nullableDecimal', 'nullableCurrency'].includes(type ?? '')) {
    value = null;
  } else if (typeof value === 'string' && ['nullableInteger', 'nullableNumber'].includes(type ?? '')) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) value = parsed;
  } else if (Array.isArray(value) && ['textList', 'manualChoiceList'].includes(type ?? '')) {
    value = value.map(item => item.trim()).filter(Boolean);
  }
  return { value, answered: value === null && !answer.answered ? false : answer.answered, scope: 'account' };
}

export default function ProfileEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileMode, setProfileMode] = useState<Mode>('smoke');
  const [recordsMode, setRecordsMode] = useState<'off' | 'manual-v1'>('off');
  const [transferMode, setTransferMode] = useState<'off' | 'reviewed-v1'>('off');
  const [smokeDraft, setSmokeDraft] = useState(EMPTY_SMOKE);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, ProfileFieldAnswer>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Operation | null>(null);
  const [retryAllowed, setRetryAllowed] = useState(false);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Loading your profile…');
  const [signedOut, setSignedOut] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [recordsPending, setRecordsPending] = useState(false);
  const [recordsDraftDirty, setRecordsDraftDirty] = useState(false);
  const generation = useRef(0);
  const profileRef = useRef<Profile | null>(null);
  const draftRef = useRef<Record<string, ProfileFieldAnswer>>({});
  const dirtyRef = useRef<Record<string, boolean>>({});
  const busyRef = useRef(false);
  const pendingRef = useRef<Operation | null>(null);
  const recordsPendingRef = useRef(false);
  const recordsDraftDirtyRef = useRef(false);
  const requestControllers = useRef(new Set<AbortController>());
  const logoutInFlight = useRef(false);
  const blockedAutoSaveFields = useRef(new Set<string>());
  const [debounce] = useState(() => createDebouncedTask(600));
  const submitFullRef = useRef<((fields?: readonly string[]) => void) | null>(null);

  const replaceDraft = useCallback((next: Record<string, ProfileFieldAnswer>) => {
    draftRef.current = next;
    setDraftAnswers(next);
  }, []);
  const replaceDirty = useCallback((next: Record<string, boolean>) => {
    dirtyRef.current = next;
    setDirty(next);
  }, []);
  const replacePending = useCallback((operation: Operation | null) => {
    pendingRef.current = operation;
    setPending(operation);
  }, []);
  const setBusyState = useCallback((value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  }, []);
  const setRecordsPendingState = useCallback((value: boolean) => {
    recordsPendingRef.current = value;
    setRecordsPending(value);
  }, []);
  const setRecordsDraftDirtyState = useCallback((value: boolean) => {
    recordsDraftDirtyRef.current = value;
    setRecordsDraftDirty(value);
  }, []);
  const registerRequestController = useCallback((controller: AbortController) => {
    requestControllers.current.add(controller);
    return () => requestControllers.current.delete(controller);
  }, []);
  const getSessionGeneration = useCallback(() => generation.current, []);

  const acceptProfile = useCallback((value: Profile, confirmedFields?: readonly string[]) => {
    profileRef.current = value;
    setProfile(value);
    const nextDirty = { ...dirtyRef.current };
    const nextDraft = { ...draftRef.current };
    if (confirmedFields) {
      for (const field of confirmedFields) {
        delete nextDirty[field];
        delete nextDraft[field];
      }
    } else {
      replaceDirty({});
      replaceDraft({});
      blockedAutoSaveFields.current.clear();
      setSmokeDraft({
        travelerCount: value.answers.travelerCount?.answered ? String(value.answers.travelerCount.value ?? '') : '',
        hasPets: value.answers.hasPets?.answered ? String(value.answers.hasPets.value ?? '') : '',
        dietaryRequirements: value.answers.dietaryRequirements?.answered ? String(value.answers.dietaryRequirements.value ?? '') : '',
      });
    }
    if (confirmedFields) {
      replaceDirty(nextDirty);
      replaceDraft(nextDraft);
    }
    replacePending(null);
    setRetryAllowed(false);
    setConflict(null);
    setValidationErrors({});
  }, [replaceDirty, replaceDraft, replacePending]);

  const clearPrivateState = useCallback(() => {
    profileRef.current = null;
    replaceDraft({});
    replaceDirty({});
    replacePending(null);
    setProfile(null);
    setProfileMode('smoke');
    setRecordsMode('off');
    setTransferMode('off');
    setRecordsPendingState(false);
    setRecordsDraftDirtyState(false);
    setSmokeDraft(EMPTY_SMOKE);
    setConflict(null);
    setRetryAllowed(false);
    setValidationErrors({});
    blockedAutoSaveFields.current.clear();
  }, [replaceDirty, replaceDraft, replacePending, setRecordsDraftDirtyState, setRecordsPendingState]);

  const abortClientRequests = useCallback(() => {
    for (const controller of requestControllers.current) controller.abort();
    requestControllers.current.clear();
    debounce.cancel();
  }, [debounce]);

  const load = useCallback(async () => {
    generation.current = advanceRequestGeneration(generation.current);
    const currentGeneration = generation.current;
    try {
      const { response, result } = await trackedJson(requestControllers.current, '/api/account/profile',
        { cache: 'no-store', credentials: 'same-origin' }, 15_000);
      if (!isCurrentRequestGeneration(currentGeneration, generation.current)) return;
      if (response.ok && result.ok === true && result.profile && Number.isSafeInteger(result.profile.revision)) {
        setProfileMode(result.profileMode === 'full-v1' ? 'full-v1' : 'smoke');
        setRecordsMode(result.recordsMode === 'manual-v1' && result.profileMode === 'full-v1' &&
          Array.isArray(result.profile.vehicles) && Array.isArray(result.profile.notes) ? 'manual-v1' : 'off');
        setTransferMode(result.transferMode === 'reviewed-v1' && result.recordsMode === 'manual-v1' &&
          result.profileMode === 'full-v1' && Array.isArray(result.profile.notes) ? 'reviewed-v1' : 'off');
        acceptProfile(result.profile);
        setSignedOut(false);
        setMessage('Your saved preferences are ready.');
      } else if (response.status === 401) {
        clearPrivateState();
        setSignedOut(true);
        setMessage('Sign in to load your profile.');
      } else setMessage('Your profile could not be loaded. Try again.');
    } catch {
      if (isCurrentRequestGeneration(currentGeneration, generation.current)) setMessage('Your profile could not be loaded. Try again.');
    }
  }, [acceptProfile, clearPrivateState]);

  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(() => { if (mounted) return load(); });
    return () => {
      mounted = false;
      generation.current = advanceRequestGeneration(generation.current);
      abortClientRequests();
    };
  }, [abortClientRequests, load]);

  async function requestStatus(operation: Operation, currentGeneration: number) {
    try {
      const { response, result } = await trackedJson(requestControllers.current,
        `/api/account/profile/operations/${encodeURIComponent(operation.operationId)}`,
        { credentials: 'same-origin', cache: 'no-store' }, 15_000);
      if (!isCurrentRequestGeneration(currentGeneration, generation.current)) return 'stale' as const;
      if (response.ok && result.status === 'saved' && isMatchingProfileAcknowledgment(result, operation, profileRef.current?.accountId ?? '')) {
        const confirmed = acknowledgedDraftFields(draftRef.current, dirtyRef.current, operation);
        for (const field of confirmed) blockedAutoSaveFields.current.delete(field);
        const ownerId = result.profile.accountId;
        let refreshed = null;
        let refreshFailed = false;
        try {
          const latest = await trackedJson(requestControllers.current, '/api/account/profile',
            { credentials: 'same-origin', cache: 'no-store' }, 15_000);
          if (!isCurrentRequestGeneration(currentGeneration, generation.current)) return 'stale' as const;
          if (latest.response.status === 401) {
            clearPrivateState();
            setSignedOut(true);
            setMessage('Your save was confirmed, but your session has ended. Sign in again to reload your profile.');
            return 'saved' as const;
          }
          if (latest.response.ok && latest.result?.ok === true && latest.result.profile?.accountId === ownerId &&
              Number.isSafeInteger(latest.result.profile?.revision) && latest.result.profile?.answers &&
              typeof latest.result.profile.answers === 'object' && !Array.isArray(latest.result.profile.answers)) {
            refreshed = latest.result.profile;
          } else refreshFailed = true;
        } catch { refreshFailed = true; }
        if (!isCurrentRequestGeneration(currentGeneration, generation.current)) return 'stale' as const;
        const canonical = selectCanonicalAfterStatusRefresh(profileRef.current, result.profile, refreshed, ownerId) as Profile;
        acceptProfile(canonical, confirmed);
        setMessage(`${refreshFailed ? 'Save confirmed. The latest profile could not be refreshed; the confirmed save is shown.' : 'Saved.'}${result.requestId ? ` Request: ${result.requestId}` : ''}`);
        return 'saved' as const;
      }
      if (response.ok && result.ok === true && result.operationId === operation.operationId && result.status === 'not_found') {
        replacePending(operation);
        setRetryAllowed(true);
        setMessage(`No completed save was found. Your draft is kept. Retry this same save.${result.requestId ? ` Request: ${result.requestId}` : ''}`);
        return 'not_found' as const;
      }
      if (response.status === 401) {
        clearPrivateState();
        setSignedOut(true);
        setMessage('Your session is unavailable. Sign in again.');
      } else setMessage(`Could not confirm your save. Your draft is kept. Check again.${result.requestId ? ` Request: ${result.requestId}` : ''}`);
      return 'unknown' as const;
    } catch {
      if (isCurrentRequestGeneration(currentGeneration, generation.current)) setMessage('Could not confirm your save. Your draft is kept. Check again.');
      return 'unknown' as const;
    }
  }

  async function postOperation(operation: Operation, currentGeneration: number) {
    try {
      const { response, result } = await trackedJson(requestControllers.current, '/api/account/profile', {
        method: 'PATCH', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(operation),
      }, 25_000);
      if (!isCurrentRequestGeneration(currentGeneration, generation.current)) return;
      if (response.ok && isMatchingProfileAcknowledgment(result, operation, profileRef.current?.accountId ?? '')) {
        const confirmed = acknowledgedDraftFields(draftRef.current, dirtyRef.current, operation);
        for (const field of confirmed) blockedAutoSaveFields.current.delete(field);
        acceptProfile(preferCurrentCanonicalProfile(profileRef.current, result.profile) as Profile, confirmed);
        setMessage(`Saved.${Object.keys(operation.patch).length > confirmed.length ? ' Newer edits remain unsaved.' : ''}${result.requestId ? ` Request: ${result.requestId}` : ''}`);
      } else if (response.status === 409 && result.category === 'conflict' && Number.isSafeInteger(result.currentRevision)) {
        replacePending(operation);
        setRetryAllowed(false);
        setConflict({ currentRevision: result.currentRevision, fieldComparison: result.fieldComparison ?? {} });
        setMessage(`Your profile changed elsewhere. Review the saved and proposed values before saving again.${result.requestId ? ` Request: ${result.requestId}` : ''}`);
      } else if (response.status === 401) {
        clearPrivateState();
        setSignedOut(true);
        setMessage('Your session is unavailable. Sign in again.');
      } else if (response.status === 400) {
        for (const field of Object.keys(operation.patch)) {
          if (TEXT_TYPES.has((PROFILE_FIELD_DEFINITIONS as Record<string, { type: string }>)[field]?.type)) blockedAutoSaveFields.current.add(field);
        }
        replacePending(null);
        setRetryAllowed(false);
        setMessage(`Check the fields. Your draft is kept.${result.requestId ? ` Request: ${result.requestId}` : ''}`);
      } else {
        replacePending(operation);
        setMessage(`Save could not be confirmed. Checking its status.${result.requestId ? ` Request: ${result.requestId}` : ''}`);
        await requestStatus(operation, currentGeneration);
      }
    } catch {
      if (isCurrentRequestGeneration(currentGeneration, generation.current)) {
        replacePending(operation);
        setMessage('Save could not be confirmed. Checking its status.');
        await requestStatus(operation, currentGeneration);
      }
    }
  }

  async function save(operation: Operation, checkFirst = false) {
    if (busyRef.current || recordsPendingRef.current || recordsDraftDirtyRef.current || !profileRef.current) return;
    generation.current = advanceRequestGeneration(generation.current);
    const currentGeneration = generation.current;
    setBusyState(true);
    replacePending(operation);
    setConflict(null);
    setRetryAllowed(false);
    setMessage(checkFirst ? 'Checking your save before retrying…' : 'Saving…');
    try {
      if (checkFirst) {
        const status = await requestStatus(operation, currentGeneration);
        if (status !== 'not_found' || !isCurrentRequestGeneration(currentGeneration, generation.current)) return;
        setRetryAllowed(false);
        setMessage('Retrying the same save…');
      }
      await postOperation(operation, currentGeneration);
    } finally {
      if (isCurrentRequestGeneration(currentGeneration, generation.current)) setBusyState(false);
    }
  }

  async function checkSave(operation: Operation, retry = false) {
    if (busyRef.current) return;
    generation.current = advanceRequestGeneration(generation.current);
    const currentGeneration = generation.current;
    setBusyState(true);
    setMessage('Checking your save…');
    try {
      const status = await requestStatus(operation, currentGeneration);
      if (retry && status === 'not_found' && isCurrentRequestGeneration(currentGeneration, generation.current)) {
        setRetryAllowed(false);
        setMessage('Retrying the same save…');
        await postOperation(operation, currentGeneration);
      }
    } finally {
      if (isCurrentRequestGeneration(currentGeneration, generation.current)) setBusyState(false);
    }
  }

  function patchFor(fields: readonly string[]): Operation | null {
    if (!profileRef.current) return null;
    const patch: Operation['patch'] = {};
    const nextErrors: Record<string, string> = {};
    for (const field of fields) {
      if (!dirtyRef.current[field]) continue;
      const answer = draftRef.current[field];
      if (!answer) continue;
      const normalized = normalizeDraftAnswer(field, answer);
      try {
        const validated = validateProfilePatch({ [field]: { ...normalized, scope: 'account' } }) as Record<string, Answer>;
        patch[field] = { value: validated[field].value, answered: validated[field].answered };
      } catch (error) { nextErrors[field] = fieldError(error); }
    }
    setValidationErrors(current => ({ ...current, ...nextErrors }));
    if (Object.keys(nextErrors).length || !Object.keys(patch).length) {
      if (Object.keys(nextErrors).length) {
        for (const field of Object.keys(nextErrors)) if (TEXT_TYPES.has((PROFILE_FIELD_DEFINITIONS as Record<string, { type: string }>)[field]?.type)) blockedAutoSaveFields.current.add(field);
        setMessage('Review the highlighted fields before saving.');
      }
      return null;
    }
    setValidationErrors(current => Object.fromEntries(Object.entries(current).filter(([field]) => !fields.includes(field))));
    return { operationId: crypto.randomUUID(), expectedRevision: profileRef.current.revision, patch };
  }

  function submitFull(fields?: readonly string[]) {
    if (busyRef.current || pendingRef.current || recordsPendingRef.current || recordsDraftDirtyRef.current) return;
    const chosen = fields ?? Object.keys(dirtyRef.current).filter(field => dirtyRef.current[field]);
    const operation = patchFor(chosen);
    if (operation) void save(operation);
  }
  useEffect(() => { submitFullRef.current = submitFull; });

  function submitSmoke(event: FormEvent) {
    event.preventDefault();
    if (!profile || busyRef.current || pendingRef.current || recordsPendingRef.current || recordsDraftDirtyRef.current || !Object.values(dirtyRef.current).some(Boolean)) return;
    const patch: Operation['patch'] = {};
    if (dirtyRef.current.travelerCount) {
      const raw = smokeDraft.travelerCount.trim();
      patch.travelerCount = { value: raw === '' ? null : Number(raw), answered: raw !== '' };
    }
    if (dirtyRef.current.hasPets) patch.hasPets = { value: smokeDraft.hasPets === '' ? null : smokeDraft.hasPets === 'true', answered: smokeDraft.hasPets !== '' };
    if (dirtyRef.current.dietaryRequirements) patch.dietaryRequirements = { value: smokeDraft.dietaryRequirements.trim() || null, answered: smokeDraft.dietaryRequirements.trim() !== '' };
    if (Object.keys(patch).length) void save({ operationId: crypto.randomUUID(), expectedRevision: profile.revision, patch });
  }

  function changeSmoke(field: keyof typeof EMPTY_SMOKE, value: string) {
    setSmokeDraft(current => ({ ...current, [field]: value }));
    replaceDirty({ ...dirtyRef.current, [field]: true });
  }

  function changeFull(field: string, answer: ProfileFieldAnswer) {
    blockedAutoSaveFields.current.delete(field);
    replaceDraft({ ...draftRef.current, [field]: answer });
    replaceDirty({ ...dirtyRef.current, [field]: true });
    setValidationErrors(current => { const next = { ...current }; delete next[field]; return next; });
  }

  function applyImportedPatch(patch: Record<string, { value: Value; answered: boolean }>) {
    const currentProfile = profileRef.current;
    if (!currentProfile || busyRef.current || pendingRef.current || recordsPendingRef.current || recordsDraftDirtyRef.current || conflict) return;
    const nextDraft = { ...draftRef.current };
    const nextDirty = { ...dirtyRef.current };
    for (const [field, answer] of Object.entries(patch)) {
      nextDraft[field] = { ...answer, scope: 'account' };
      nextDirty[field] = true;
      blockedAutoSaveFields.current.delete(field);
    }
    replaceDraft(nextDraft);
    replaceDirty(nextDirty);
    void save({ operationId: crypto.randomUUID(), expectedRevision: currentProfile.revision, patch });
  }

  useEffect(() => {
    debounce.cancel();
    if (profileMode !== 'full-v1' || busy || pending || recordsPending || recordsDraftDirty || conflict || !profile || signedOut) return;
    const textDirty = pendingTextAutosaveFields(dirty, PROFILE_FIELD_DEFINITIONS as Record<string, { type: string }>, blockedAutoSaveFields.current);
    if (!textDirty.length) return;
    debounce.schedule(() => submitFullRef.current?.(textDirty));
    return () => debounce.cancel();
  }, [busy, conflict, debounce, dirty, draftAnswers, pending, profile, profileMode, recordsDraftDirty, recordsPending, signedOut]);

  function flushText(field: string) {
    debounce.cancel();
    submitFull([field]);
  }

  const canStartRecordWrite = useCallback((reapplyingReviewedRecords = false) => !busyRef.current && !pendingRef.current &&
    (reapplyingReviewedRecords || !recordsPendingRef.current) && !conflict &&
    !Object.values(dirtyRef.current).some(Boolean) && profileRef.current !== null, [conflict]);
  const canStartTransferWrite = useCallback((reapplyingReviewedTransfer = false) => !busyRef.current && !pendingRef.current &&
    (reapplyingReviewedTransfer || (!recordsPendingRef.current && !recordsDraftDirtyRef.current)) && !conflict &&
    !Object.values(dirtyRef.current).some(Boolean) && profileRef.current !== null, [conflict]);

  const acceptRecordsProfile = useCallback((value: Profile) => {
    // A record acknowledgment advances the shared canonical revision without
    // resetting unrelated field drafts.
    profileRef.current = value;
    setProfile(value);
  }, []);
  const handleChildBusyChange = useCallback((value: boolean) => {
    if (!logoutInFlight.current) setBusyState(value);
  }, [setBusyState]);
  const handleChildSessionExpired = useCallback(() => {
    if (logoutInFlight.current) return;
    generation.current = advanceRequestGeneration(generation.current);
    abortClientRequests();
    clearPrivateState();
    setBusyState(false);
    setSignedOut(true);
    setMessage('Your session is unavailable. Sign in again.');
  }, [abortClientRequests, clearPrivateState, setBusyState]);

  async function logout() {
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;
    generation.current = advanceRequestGeneration(generation.current);
    const logoutGeneration = generation.current;
    abortClientRequests();
    setBusyState(true);
    clearPrivateState();
    setLogoutPending(true);
    setMessage('Signing out…');
    try {
      const { response, result } = await trackedJson(requestControllers.current, '/api/account/auth', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }),
      }, 25_000);
      if (!isCurrentRequestGeneration(logoutGeneration, generation.current)) return;
      if (response.ok && result.signedOut === true) { setLogoutPending(false); setSignedOut(true); setMessage('Signed out.'); }
      else setMessage('Your profile is hidden. Sign-out could not be confirmed; retry sign-out.');
    } catch {
      if (isCurrentRequestGeneration(logoutGeneration, generation.current)) setMessage('Your profile is hidden. Sign-out could not be confirmed; retry sign-out.');
    } finally {
      logoutInFlight.current = false;
      if (isCurrentRequestGeneration(logoutGeneration, generation.current)) setBusyState(false);
    }
  }

  function renderSummary() {
    const groups = createReadableProfileSummary(profile, PROFILE_FIELD_GROUPS, PROFILE_FIELD_LABELS);
    return <section aria-labelledby="saved-profile-summary-heading">
      <h2 id="saved-profile-summary-heading">Saved profile summary</h2>
      {groups.map(group => <section key={group.title} aria-label={group.title}>
        <h3>{group.title}</h3><p>{group.text}</p>
      </section>)}
    </section>;
  }

  const profileTransferView = profile ? {
    ...profile,
    profileNotes: Array.isArray(profile.notes)
      ? profile.notes.filter(note => !note.userRemoved).map(note => note.text)
      : undefined,
  } : null;

  return <section>
    <p role="status" aria-live="polite">{message}</p>
    {signedOut && <Link href="/auth?next=%2Fprofile">Sign in</Link>}
    {profile && <ProfileCompletionCard profile={profile} />}
    {logoutPending && <button type="button" disabled={busy} onClick={() => void logout()}>Retry sign-out</button>}
    {!profile && !signedOut && !logoutPending && <button type="button" disabled={busy} onClick={() => void load()}>Load profile</button>}
    {profile && profileMode === 'full-v1' ? <>
      <form onSubmit={event => { event.preventDefault(); submitFull(); }}>
        <ProfileFields canonicalAnswers={profile.answers} draftAnswers={draftAnswers} dirtyFields={dirty}
          onDraftChange={changeFull} onDirtyChange={(field, value) => replaceDirty({ ...dirtyRef.current, [field]: value })} onFlush={flushText}
          validationErrors={validationErrors} disabled={busy || !!pending || recordsPending || recordsDraftDirty} pending={busy} />
        <button type="submit" disabled={busy || !!pending || recordsPending || recordsDraftDirty || !Object.values(dirty).some(Boolean)}>Save preferences</button>
      </form>
      {renderSummary()}
      <ProfileTransferControls key={profile.accountId} profile={profileTransferView ?? profile} transferMode={transferMode}
        disabled={busy || !!pending || !!conflict || recordsPending || recordsDraftDirty} canStartWrite={canStartTransferWrite}
        registerController={registerRequestController} getSessionGeneration={getSessionGeneration} onBusyChange={handleChildBusyChange}
        onOperationPendingChange={setRecordsPendingState} onProfileUpdate={value => acceptRecordsProfile(value as Profile)}
        onSessionExpired={handleChildSessionExpired} onApplyPatch={applyImportedPatch} />
      <ProfileRecordsControls key={profile.accountId} profile={profile} recordsMode={recordsMode}
        disabled={busy || !!pending || !!conflict || recordsPending || signedOut} canStartWrite={canStartRecordWrite}
        registerController={registerRequestController} getSessionGeneration={getSessionGeneration} onBusyChange={handleChildBusyChange}
        onOperationPendingChange={setRecordsPendingState} onDraftDirtyChange={setRecordsDraftDirtyState}
        onProfileUpdate={value => acceptRecordsProfile(value as Profile)}
        onSessionExpired={handleChildSessionExpired} />
      {pending && !conflict && <div aria-label="Save recovery">
        <button type="button" disabled={busy} onClick={() => void checkSave(pending)}>Check save status</button>
        {retryAllowed && <button type="button" disabled={busy} onClick={() => void checkSave(pending, true)}>Retry same save</button>}
      </div>}
      {conflict && pending && <section aria-label="Review changed values"><h2>Review changes</h2>
        {Object.entries(conflict.fieldComparison).map(([field, values]) => <p key={field}><strong>{PROFILE_FIELD_LABELS[field as keyof typeof PROFILE_FIELD_LABELS] ?? 'Preference'}</strong>: saved — {readable(values.current)}; your draft — {readable(values.proposed)}.</p>)}
        <button type="button" disabled={busy} onClick={() => void save({ ...pending, operationId: crypto.randomUUID(), expectedRevision: conflict.currentRevision })}>Save reviewed draft</button>
        <button type="button" disabled={busy} onClick={() => void load()}>Discard draft and load saved values</button>
      </section>}
    </> : profile && <>
      <form className="account-form" onSubmit={submitSmoke}>
        <fieldset disabled={busy || !!pending}><legend>Travel preferences</legend>
          <label htmlFor="travelers">Number of travelers</label><input id="travelers" type="number" min={1} max={200} value={smokeDraft.travelerCount} onChange={event => changeSmoke('travelerCount', event.target.value)} />
          <label htmlFor="pets">Traveling with pets</label><select id="pets" value={smokeDraft.hasPets} onChange={event => changeSmoke('hasPets', event.target.value)}><option value="">Not specified</option><option value="true">Yes</option><option value="false">No</option></select>
          <label htmlFor="food">Food needs</label><textarea id="food" maxLength={2000} value={smokeDraft.dietaryRequirements} onChange={event => changeSmoke('dietaryRequirements', event.target.value)} />
        </fieldset>
        <button type="submit" disabled={busy || !!pending || !Object.values(dirty).some(Boolean)}>Save preferences</button>
      </form>
      <h2>Saved profile</h2><dl>{SMOKE_FIELDS.map(field => <div key={field}><dt>{field === 'travelerCount' ? 'Travelers' : field === 'hasPets' ? 'Traveling with pets' : 'Food needs'}</dt><dd>{readable(profile.answers[field])}</dd></div>)}</dl>
      {pending && !conflict && <div aria-label="Save recovery">
        <button type="button" disabled={busy} onClick={() => void checkSave(pending)}>Check save status</button>
        {retryAllowed && <button type="button" disabled={busy} onClick={() => void checkSave(pending, true)}>Retry same save</button>}
      </div>}
      {conflict && pending && <section aria-label="Review changed values"><h2>Review changes</h2>
        {Object.entries(conflict.fieldComparison).map(([field, values]) => <p key={field}><strong>{field}</strong>: saved — {readable(values.current)}; your draft — {readable(values.proposed)}.</p>)}
        <button type="button" disabled={busy} onClick={() => void save({ ...pending, operationId: crypto.randomUUID(), expectedRevision: conflict.currentRevision })}>Save reviewed draft</button>
        <button type="button" disabled={busy} onClick={() => void load()}>Discard draft and load saved values</button>
      </section>}
      <button type="button" onClick={() => void logout()}>Sign out</button>
    </>}
    {profile && profileMode === 'full-v1' && <button type="button" onClick={() => void logout()}>Sign out</button>}
  </section>;
}

function ProfileCompletionCard({ profile }: { profile: Profile }) {
  const completion = calculateProfileCompletion(profile);
  return <aside aria-labelledby="profile-completion-heading" style={{
    border: '1px solid #394148', borderRadius: 16, padding: 20, margin: '20px 0', background: '#19191b',
  }}>
    <h2 id="profile-completion-heading">Profile completion</h2>
    <p>{completion.coreComplete ? 'Core profile complete' : `${completion.percentage}% complete`}</p>
    <progress aria-label="Core profile completion" max={100} value={completion.percentage} style={{ width: '100%' }} />
    <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 12, listStyle: 'none', padding: 0 }}>
      {completion.categories.map(category => <li key={category.key} style={{ flex: '1 1 11rem' }}>
        <span aria-hidden="true">{category.complete ? '✓' : '○'} </span>
        <strong>{category.title}</strong>: {category.complete ? 'Complete' : 'Not complete'}
      </li>)}
    </ul>
  </aside>;
}
