'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isCurrentRequestGeneration,
  isMatchingProfileRecordsAcknowledgment,
  advanceRequestGeneration,
  acknowledgedRecordIds,
} from '@/lib/profile-editor-state.mjs';
import { buildProfileRecordsOperation, buildReviewedProfileRecordsOperation } from '@/lib/profile-record-editor-state.mjs';
import { preferCurrentCanonicalProfile, selectCanonicalAfterStatusRefresh } from '@/lib/profile-transfer-editor-state.mjs';

type FuelEconomy = { value: number; unit: string; origin?: 'user' } | null;
type Location = { latitude: number; longitude: number; origin?: 'user' } | null;
type Vehicle = {
  id: string;
  name: string;
  type: string;
  ownership: 'owned' | 'rented';
  propulsion: string | null;
  fuelEconomy: FuelEconomy;
  dimensions: { lengthMeters: number | null; widthMeters: number | null; heightMeters: number | null } | null;
  location: Location;
  locationVerifiedAt: string | null;
};
type Note = { id: string; text: string; origin: 'user' | 'AI'; selectedQuoteIds: string[]; userRemoved: boolean };
type Profile = { accountId?: string; revision: number; answers: Record<string, unknown>; vehicles?: Vehicle[]; notes?: Note[] };
type VehicleDraft = {
  id: string; name: string; type: string; ownership: 'owned' | 'rented'; propulsion: string;
  fuelValue: string; fuelUnit: string; lengthMeters: string; widthMeters: string; heightMeters: string;
  location: Location; locationVerifiedAt: string | null;
};
type NoteDraft = { id: string; text: string; origin: 'user' | 'AI'; selectedQuoteIds: string[]; userRemoved: boolean };
type VehicleUpsert = Omit<Vehicle, 'fuelEconomy' | 'location'> & {
  fuelEconomy: { value: number; unit: string } | null;
  location: null;
};
type NoteUpsert = Omit<Note, 'origin'>;
type Operation = { operationId: string; expectedRevision: number; vehicleUpserts: VehicleUpsert[]; noteUpserts: NoteUpsert[] };
type Conflict = { currentRevision: number; fieldComparison: Record<string, Record<string, { current: Vehicle | Note | null; proposed: Vehicle | Note }>> };
type Props = {
  profile: Profile;
  recordsMode: 'off' | 'manual-v1';
  disabled?: boolean;
  canStartWrite: (reapplyingReviewedRecords?: boolean) => boolean;
  registerController: (controller: AbortController) => () => void;
  getSessionGeneration: () => number;
  onBusyChange: (busy: boolean) => void;
  onOperationPendingChange: (pending: boolean) => void;
  onDraftDirtyChange: (dirty: boolean) => void;
  onProfileUpdate: (profile: Profile) => void;
  onSessionExpired: () => void;
};

function toVehicleDraft(vehicle: Vehicle): VehicleDraft {
  return {
    id: vehicle.id, name: vehicle.name, type: vehicle.type, ownership: vehicle.ownership,
    propulsion: vehicle.propulsion ?? '', fuelValue: vehicle.fuelEconomy ? String(vehicle.fuelEconomy.value) : '',
    fuelUnit: vehicle.fuelEconomy?.unit ?? '',
    lengthMeters: vehicle.dimensions?.lengthMeters == null ? '' : String(vehicle.dimensions.lengthMeters),
    widthMeters: vehicle.dimensions?.widthMeters == null ? '' : String(vehicle.dimensions.widthMeters),
    heightMeters: vehicle.dimensions?.heightMeters == null ? '' : String(vehicle.dimensions.heightMeters),
    location: vehicle.location, locationVerifiedAt: vehicle.locationVerifiedAt,
  };
}

function sameDraft(left: unknown, right: unknown) { return JSON.stringify(left) === JSON.stringify(right); }
function mergeVehicleDrafts(canonical: Vehicle[], overrides: VehicleDraft[], dirtyIds: string[]) {
  const dirty = new Set(dirtyIds);
  const byId = new Map(overrides.filter(item => dirty.has(item.id)).map(item => [item.id, item]));
  const next = canonical.map(vehicle => byId.get(vehicle.id) ?? toVehicleDraft(vehicle));
  const canonicalIds = new Set(canonical.map(item => item.id));
  return [...next, ...overrides.filter(item => !canonicalIds.has(item.id))];
}
function mergeNoteDrafts(canonical: Note[], overrides: NoteDraft[], dirtyIds: string[]) {
  const dirty = new Set(dirtyIds);
  const byId = new Map(overrides.filter(item => dirty.has(item.id)).map(item => [item.id, item]));
  const next = canonical.map(note => byId.get(note.id) ?? { ...note, selectedQuoteIds: [...note.selectedQuoteIds] });
  const canonicalIds = new Set(canonical.map(item => item.id));
  return [...next, ...overrides.filter(item => !canonicalIds.has(item.id))];
}

function cleanNote(note: NoteDraft): NoteUpsert {
  return { id: note.id, text: note.text, selectedQuoteIds: [...note.selectedQuoteIds], userRemoved: note.userRemoved };
}
async function trackedJson(registerController: (controller: AbortController) => () => void, ownedControllers: Set<AbortController>, url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  ownedControllers.add(controller);
  const unregister = registerController(controller);
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { response, result: await response.json() };
  } finally { clearTimeout(timer); unregister(); ownedControllers.delete(controller); }
}

export default function ProfileRecordsControls({
  profile, recordsMode, disabled = false, canStartWrite, registerController, getSessionGeneration,
  onBusyChange, onOperationPendingChange, onDraftDirtyChange, onProfileUpdate, onSessionExpired,
}: Props) {
  const [vehicleOverrides, setVehicleOverrides] = useState<VehicleDraft[]>([]);
  const [noteOverrides, setNoteOverrides] = useState<NoteDraft[]>([]);
  const [dirtyVehicles, setDirtyVehicles] = useState<string[]>([]);
  const [dirtyNotes, setDirtyNotes] = useState<string[]>([]);
  const vehicleDrafts = useMemo(() => mergeVehicleDrafts(profile.vehicles ?? [], vehicleOverrides, dirtyVehicles),
    [dirtyVehicles, profile.vehicles, vehicleOverrides]);
  const noteDrafts = useMemo(() => mergeNoteDrafts(profile.notes ?? [], noteOverrides, dirtyNotes),
    [dirtyNotes, profile.notes, noteOverrides]);
  const [pending, setPending] = useState<Operation | null>(null);
  const [retryAllowed, setRetryAllowed] = useState(false);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [selectedConflictIds, setSelectedConflictIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const generation = useRef(0);
  const busyRef = useRef(false);
  const pendingRef = useRef<Operation | null>(null);
  const ownedControllers = useRef(new Set<AbortController>());
  const sessionIsCurrent = (capturedGeneration: number) => capturedGeneration === getSessionGeneration();

  const setBusyState = useCallback((value: boolean) => {
    busyRef.current = value;
    setBusy(value);
    onBusyChange(value);
  }, [onBusyChange]);
  const setPendingOperation = useCallback((operation: Operation | null) => {
    pendingRef.current = operation;
    setPending(operation);
    onOperationPendingChange(operation !== null);
  }, [onOperationPendingChange]);

  function setVehicleDrafts(update: VehicleDraft[] | ((current: VehicleDraft[]) => VehicleDraft[])) {
    setVehicleOverrides(currentOverrides => {
      const current = mergeVehicleDrafts(profile.vehicles ?? [], currentOverrides, dirtyVehicles);
      const next = typeof update === 'function' ? update(current) : update;
      const canonical = new Map((profile.vehicles ?? []).map(item => [item.id, toVehicleDraft(item)]));
      return next.filter(item => !canonical.has(item.id) || !sameDraft(item, canonical.get(item.id)));
    });
  }
  function setNoteDrafts(update: NoteDraft[] | ((current: NoteDraft[]) => NoteDraft[])) {
    setNoteOverrides(currentOverrides => {
      const current = mergeNoteDrafts(profile.notes ?? [], currentOverrides, dirtyNotes);
      const next = typeof update === 'function' ? update(current) : update;
      const canonical = new Map((profile.notes ?? []).map(item => [item.id, { ...item, selectedQuoteIds: [...item.selectedQuoteIds] }]));
      return next.filter(item => !canonical.has(item.id) || !sameDraft(item, canonical.get(item.id)));
    });
  }

  useEffect(() => () => onDraftDirtyChange(false), [onDraftDirtyChange]);

  useEffect(() => () => {
    generation.current = advanceRequestGeneration(generation.current);
    for (const controller of ownedControllers.current) controller.abort();
    ownedControllers.current.clear();
  }, []);

  function markVehicleDirty(id: string) {
    setDirtyVehicles(current => current.includes(id) ? current : [...current, id]);
    onDraftDirtyChange(true);
  }
  function markNoteDirty(id: string) {
    setDirtyNotes(current => current.includes(id) ? current : [...current, id]);
    onDraftDirtyChange(true);
  }

  async function getStatus(operation: Operation, currentGeneration: number, sessionGeneration: number) {
    if (!isCurrentRequestGeneration(currentGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return 'stale' as const;
    try {
      const { response, result } = await trackedJson(registerController, ownedControllers.current,
        `/api/account/profile/operations/${encodeURIComponent(operation.operationId)}`,
        { credentials: 'same-origin', cache: 'no-store' });
      if (!isCurrentRequestGeneration(currentGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return 'stale' as const;
      if (response.ok && result.status === 'saved' && result.operationKind === 'profile_records' &&
          isMatchingProfileRecordsAcknowledgment(result, operation, profile.accountId ?? '')) {
        let refreshed: Profile | null = null;
        let refreshFailed = false;
        try {
          const latest = await trackedJson(registerController, ownedControllers.current, '/api/account/profile',
            { credentials: 'same-origin', cache: 'no-store' });
          if (!isCurrentRequestGeneration(currentGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return 'stale' as const;
          if (latest.response.status === 401) { onSessionExpired(); return 'saved' as const; }
          const candidate = latest.result?.profile as Profile | undefined;
          if (latest.response.ok && latest.result?.ok === true && candidate !== undefined && candidate.accountId === profile.accountId &&
              Number.isSafeInteger(candidate.revision) && candidate.revision >= result.profile.revision &&
              candidate.answers && Array.isArray(candidate.vehicles) && Array.isArray(candidate.notes)) refreshed = candidate;
          else refreshFailed = true;
        } catch { refreshFailed = true; }
        if (!isCurrentRequestGeneration(currentGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return 'stale' as const;
        const canonical = selectCanonicalAfterStatusRefresh(profile, result.profile, refreshed, profile.accountId ?? '') as Profile;
        acceptAcknowledgment({ ...result, profile: canonical }, operation, refreshFailed);
        return 'saved' as const;
      }
      if (response.status === 401) {
        onSessionExpired();
        return 'unknown' as const;
      }
      if (response.ok && result.ok === true && result.status === 'not_found' && result.operationId === operation.operationId) {
        setPendingOperation(operation);
        setRetryAllowed(true);
        setMessage('No completed save was found. Your changes are kept. Retry the same save when ready.');
        return 'not_found' as const;
      }
      setMessage('Could not confirm the save. Your changes are kept. Check again before retrying.');
      return 'unknown' as const;
    } catch {
      if (isCurrentRequestGeneration(currentGeneration, generation.current) && sessionIsCurrent(sessionGeneration)) setMessage('Could not confirm the save. Your changes are kept. Check again before retrying.');
      return 'unknown' as const;
    }
  }

  function acceptAcknowledgment(result: { profile: Profile; requestId?: string }, operation: Operation, refreshFailed = false) {
    const submittedVehicles = operation.vehicleUpserts;
    const submittedNotes = operation.noteUpserts;
    const acknowledgedVehicles = acknowledgedRecordIds(
      vehicleDrafts.map(draft => ({ ...draft })),
      submittedVehicles.map(vehicle => toVehicleDraft(vehicle)),
      submittedVehicles,
    );
    const acknowledgedNotes = acknowledgedRecordIds(noteDrafts.map(cleanNote), submittedNotes, submittedNotes);
    const remainingVehicles = dirtyVehicles.filter(id => !acknowledgedVehicles.includes(id));
    const remainingNotes = dirtyNotes.filter(id => !acknowledgedNotes.includes(id));
    setDirtyVehicles(remainingVehicles);
    setDirtyNotes(remainingNotes);
    onDraftDirtyChange(remainingVehicles.length + remainingNotes.length > 0);
    setPendingOperation(null);
    setRetryAllowed(false);
    setConflict(null);
    setSelectedConflictIds([]);
    setErrors({});
    onProfileUpdate(preferCurrentCanonicalProfile(profile, result.profile) as Profile);
    setMessage(`${refreshFailed ? 'Save confirmed. The latest profile could not be refreshed; the confirmed save is shown.' : 'Saved.'}${result.requestId ? ` Request: ${result.requestId}` : ''}`);
  }

  async function post(operation: Operation, currentGeneration: number, sessionGeneration: number) {
    if (!isCurrentRequestGeneration(currentGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return;
    try {
      const { response, result } = await trackedJson(registerController, ownedControllers.current, '/api/account/profile/records', {
        method: 'PATCH', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(operation),
      });
      if (!isCurrentRequestGeneration(currentGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return;
      if (response.ok && isMatchingProfileRecordsAcknowledgment(result, operation, profile.accountId ?? '')) {
        acceptAcknowledgment(result, operation);
      } else if (response.status === 409 && result.category === 'conflict' && Number.isSafeInteger(result.currentRevision)) {
        setPendingOperation(operation);
        setRetryAllowed(false);
        setConflict({ currentRevision: result.currentRevision, fieldComparison: result.fieldComparison ?? {} });
        const comparisons = (result.fieldComparison ?? {}) as Conflict['fieldComparison'];
        const available = [
          ...Object.entries(comparisons.vehicles ?? {}).filter(([, raw]) => {
            const values = raw as { current: Vehicle | null };
            return !values.current || values.current.location === null;
          }).map(([id]) => `vehicles:${id}`),
          ...Object.entries(comparisons.notes ?? {}).filter(([, raw]) => {
            const values = raw as { current: Note | null; proposed: Note };
            return !(values.current?.userRemoved && !values.proposed.userRemoved);
          }).map(([id]) => `notes:${id}`),
        ];
        setSelectedConflictIds(available);
        setMessage('These records changed elsewhere. Review the current and proposed versions, then select any changes to reapply.');
      } else if (response.status === 400) {
        setPendingOperation(null);
        setRetryAllowed(false);
        setErrors({ operation: 'The server rejected these changes. Review the fields before saving again.' });
        setMessage('The changes were not accepted. Your draft is kept for review.');
      } else if (response.status === 401) {
        onSessionExpired();
      } else {
        setPendingOperation(operation);
        setMessage('Save could not be confirmed. Checking its status.');
        await getStatus(operation, currentGeneration, sessionGeneration);
      }
    } catch {
      if (!isCurrentRequestGeneration(currentGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return;
      setPendingOperation(operation);
      setMessage('Save could not be confirmed. Checking its status.');
      await getStatus(operation, currentGeneration, sessionGeneration);
    }
  }

  async function runSave(operation: Operation, checkFirst = false, reapplyingReviewedRecords = false) {
    if (busyRef.current || (pendingRef.current && !reapplyingReviewedRecords) || !canStartWrite(reapplyingReviewedRecords)) {
      setMessage('Finish or review the other profile save before saving these records.'); return;
    }
    generation.current = advanceRequestGeneration(generation.current);
    const currentGeneration = generation.current;
    const sessionGeneration = getSessionGeneration();
    setBusyState(true);
    setPendingOperation(operation);
    setRetryAllowed(false);
    setConflict(null);
    setMessage(checkFirst ? 'Checking the previous save before retrying…' : 'Saving records…');
    try {
      if (checkFirst) {
        const status = await getStatus(operation, currentGeneration, sessionGeneration);
        if (status !== 'not_found' || !isCurrentRequestGeneration(currentGeneration, generation.current)) return;
        setRetryAllowed(false);
        setMessage('Retrying the same save…');
      }
      await post(operation, currentGeneration, sessionGeneration);
    } finally {
      if (isCurrentRequestGeneration(currentGeneration, generation.current) && sessionIsCurrent(sessionGeneration)) setBusyState(false);
    }
  }

  async function checkPending(retry = false) {
    const operation = pendingRef.current;
    if (!operation || busyRef.current) return;
    generation.current = advanceRequestGeneration(generation.current);
    const currentGeneration = generation.current;
    const sessionGeneration = getSessionGeneration();
    setBusyState(true);
    setMessage('Checking save status…');
    try {
      const status = await getStatus(operation, currentGeneration, sessionGeneration);
      if (retry && status === 'not_found' && isCurrentRequestGeneration(currentGeneration, generation.current)) {
        setRetryAllowed(false);
        await post(operation, currentGeneration, sessionGeneration);
      }
    } finally {
      if (isCurrentRequestGeneration(currentGeneration, generation.current) && sessionIsCurrent(sessionGeneration)) setBusyState(false);
    }
  }

  function saveDrafts() {
    if (!canStartWrite() || busyRef.current || pendingRef.current) { setMessage('Finish or review the other profile save before saving these records.'); return; }
    try {
      const operation = buildProfileRecordsOperation({ operationId: crypto.randomUUID(), expectedRevision: profile.revision,
        vehicleDrafts, noteDrafts, dirtyVehicleIds: dirtyVehicles, dirtyNoteIds: dirtyNotes }) as Operation;
      setErrors({});
      void runSave(operation);
    } catch (error) {
      setErrors({ operation: error instanceof Error ? error.message : 'Review the record values.' });
      setMessage('Review the highlighted record changes before saving.');
    }
  }

  function reapplyConflict() {
    if (!conflict || !pending || !selectedConflictIds.length || !canStartWrite(true)) return;
    try {
      const operation = buildReviewedProfileRecordsOperation({ pending, currentRevision: conflict.currentRevision,
        selectedKeys: selectedConflictIds, fieldComparison: conflict.fieldComparison, operationId: crypto.randomUUID() }) as Operation;
      void runSave(operation, false, true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Select safe changes to reapply.');
    }
  }

  async function discardConflict() {
    if (!conflict || !pending) return;
    generation.current = advanceRequestGeneration(generation.current);
    const currentGeneration = generation.current;
    const sessionGeneration = getSessionGeneration();
    setBusyState(true);
    setMessage('Loading the latest saved profile…');
    try {
      const { response, result } = await trackedJson(registerController, ownedControllers.current,
        '/api/account/profile', { credentials: 'same-origin', cache: 'no-store' });
      const latest = result.profile as Profile | undefined;
      if (!isCurrentRequestGeneration(currentGeneration, generation.current) || !sessionIsCurrent(sessionGeneration)) return;
      if (response.status === 401) {
        onSessionExpired();
        return;
      }
      if (!response.ok || result.ok !== true || !latest || latest.accountId !== profile.accountId ||
          !Number.isSafeInteger(latest.revision) || !Array.isArray(latest.vehicles) || !Array.isArray(latest.notes)) {
        setMessage('Could not load the latest saved records. Your conflict review is kept.');
        return;
      }
      setVehicleOverrides([]);
      setNoteOverrides([]);
      setDirtyVehicles([]);
      setDirtyNotes([]);
      onDraftDirtyChange(false);
      setConflict(null);
      setPendingOperation(null);
      setRetryAllowed(false);
      onProfileUpdate(latest);
      setMessage('Your proposed changes were discarded. The latest saved values are shown.');
    } catch {
      if (isCurrentRequestGeneration(currentGeneration, generation.current) && sessionIsCurrent(sessionGeneration)) setMessage('Could not load the latest saved records. Your conflict review is kept.');
    } finally {
      if (isCurrentRequestGeneration(currentGeneration, generation.current) && sessionIsCurrent(sessionGeneration)) setBusyState(false);
    }
  }

  if (recordsMode !== 'manual-v1' || !Array.isArray(profile.vehicles) || !Array.isArray(profile.notes)) return null;

  const isDisabled = disabled || busy || pending !== null || conflict !== null;
  return <section className="profile-records" aria-labelledby="profile-records-heading">
    <h2 id="profile-records-heading">Vehicles, vessels, and profile notes</h2>
    <p>These details are saved with your profile. Unknown fuel use and dimensions can be left blank.</p>
    <p role="status" aria-live="polite">{message}</p>
    {errors.operation && <p role="alert">{errors.operation}</p>}
    <section aria-labelledby="profile-vehicles-heading">
      <h3 id="profile-vehicles-heading">Vehicles and vessels</h3>
      {vehicleDrafts.map(vehicle => {
        const readOnly = vehicle.location !== null;
        const isNew = !(profile.vehicles ?? []).some(item => item.id === vehicle.id);
        return <fieldset key={vehicle.id} disabled={isDisabled || readOnly}>
          <legend>{vehicle.name || 'New vehicle or vessel'}</legend>
          {readOnly && <p>This record has a saved location and is read-only here.</p>}
          <label htmlFor={`vehicle-name-${vehicle.id}`}>Name</label>
          <input id={`vehicle-name-${vehicle.id}`} value={vehicle.name} maxLength={1000} onChange={event => {
            setVehicleDrafts(current => current.map(item => item.id === vehicle.id ? { ...item, name: event.target.value } : item)); markVehicleDirty(vehicle.id);
          }} />
          <label htmlFor={`vehicle-type-${vehicle.id}`}>Type</label>
          <input id={`vehicle-type-${vehicle.id}`} value={vehicle.type} maxLength={1000} onChange={event => {
            setVehicleDrafts(current => current.map(item => item.id === vehicle.id ? { ...item, type: event.target.value } : item)); markVehicleDirty(vehicle.id);
          }} />
          <label htmlFor={`vehicle-ownership-${vehicle.id}`}>Ownership</label>
          <select id={`vehicle-ownership-${vehicle.id}`} value={vehicle.ownership} onChange={event => {
            setVehicleDrafts(current => current.map(item => item.id === vehicle.id ? { ...item, ownership: event.target.value as VehicleDraft['ownership'] } : item)); markVehicleDirty(vehicle.id);
          }}><option value="owned">Owned</option><option value="rented">Rented</option></select>
          <label htmlFor={`vehicle-propulsion-${vehicle.id}`}>Propulsion (optional)</label>
          <input id={`vehicle-propulsion-${vehicle.id}`} value={vehicle.propulsion} maxLength={1000} onChange={event => {
            setVehicleDrafts(current => current.map(item => item.id === vehicle.id ? { ...item, propulsion: event.target.value } : item)); markVehicleDirty(vehicle.id);
          }} />
          <label htmlFor={`vehicle-fuel-${vehicle.id}`}>Fuel use or consumption (optional)</label>
          <div className="profile-record-pair">
            <input id={`vehicle-fuel-${vehicle.id}`} aria-label="Fuel use or consumption value" type="text" inputMode="decimal" value={vehicle.fuelValue} onChange={event => {
              setVehicleDrafts(current => current.map(item => item.id === vehicle.id ? { ...item, fuelValue: event.target.value } : item)); markVehicleDirty(vehicle.id);
            }} />
            <input id={`vehicle-fuel-unit-${vehicle.id}`} aria-label="Fuel use or consumption unit" placeholder="Unit, such as mpg or gallons/hour" value={vehicle.fuelUnit} maxLength={64} onChange={event => {
              setVehicleDrafts(current => current.map(item => item.id === vehicle.id ? { ...item, fuelUnit: event.target.value } : item)); markVehicleDirty(vehicle.id);
            }} />
          </div>
          <fieldset><legend>Dimensions (optional, meters)</legend>
            {(['lengthMeters', 'widthMeters', 'heightMeters'] as const).map(key => <div key={key}>
              <label htmlFor={`vehicle-${key}-${vehicle.id}`}>{key.replace('Meters', '')}</label>
              <input id={`vehicle-${key}-${vehicle.id}`} type="text" inputMode="decimal" value={vehicle[key]} onChange={event => {
                setVehicleDrafts(current => current.map(item => item.id === vehicle.id ? { ...item, [key]: event.target.value } : item)); markVehicleDirty(vehicle.id);
              }} />
            </div>)}
          </fieldset>
          {vehicle.location && <p>Saved location: {vehicle.location.latitude}, {vehicle.location.longitude}</p>}
          {isNew && <button type="button" disabled={isDisabled} onClick={() => {
            setVehicleDrafts(current => current.filter(item => item.id !== vehicle.id));
            setDirtyVehicles(current => current.filter(id => id !== vehicle.id));
          }}>Discard new vehicle</button>}
        </fieldset>;
      })}
      <button type="button" disabled={isDisabled} onClick={() => {
        const id = crypto.randomUUID();
        setVehicleDrafts(current => [...current, { id, name: '', type: '', ownership: 'owned', propulsion: '', fuelValue: '', fuelUnit: '',
          lengthMeters: '', widthMeters: '', heightMeters: '', location: null, locationVerifiedAt: null }]);
        markVehicleDirty(id);
      }}>Add vehicle or vessel</button>
    </section>
    <section aria-labelledby="profile-notes-heading">
      <h3 id="profile-notes-heading">Profile notes and personal quotes</h3>
      {noteDrafts.map(note => {
        const isNew = !(profile.notes ?? []).some(item => item.id === note.id);
        return <fieldset key={note.id} disabled={isDisabled || note.userRemoved}>
        <legend>{note.userRemoved ? 'Removed note' : `${note.origin === 'AI' ? 'AI suggestion' : 'Personal note'}`}</legend>
        <label htmlFor={`profile-note-${note.id}`}>Note text</label>
        <textarea id={`profile-note-${note.id}`} maxLength={10000} value={note.text} onChange={event => {
          setNoteDrafts(current => current.map(item => item.id === note.id ? { ...item, text: event.target.value } : item)); markNoteDirty(note.id);
        }} />
        {note.selectedQuoteIds.length > 0 && <p>Linked quote IDs are kept as saved.</p>}
        {note.origin === 'AI' && <p>This note was originally suggested by AI. Editing it does not change its saved origin.</p>}
        {!note.userRemoved && <button type="button" disabled={isDisabled} onClick={() => {
          setNoteDrafts(current => current.map(item => item.id === note.id ? { ...item, userRemoved: true } : item)); markNoteDirty(note.id);
        }}>Remove note</button>}
        {isNew && <button type="button" disabled={isDisabled} onClick={() => {
          setNoteDrafts(current => current.filter(item => item.id !== note.id));
          setDirtyNotes(current => current.filter(id => id !== note.id));
        }}>Discard new note</button>}
      </fieldset>;
      })}
      <button type="button" disabled={isDisabled} onClick={() => {
        const id = crypto.randomUUID();
        setNoteDrafts(current => [...current, { id, text: '', origin: 'user', selectedQuoteIds: [], userRemoved: false }]);
        markNoteDirty(id);
      }}>Add personal note</button>
    </section>
    {conflict && pending && <section aria-label="Review record changes">
      <h3>Review changes</h3>
      {(['vehicles', 'notes'] as const).map(kind => Object.entries(conflict.fieldComparison[kind] ?? {}).map(([id, values]) => {
        const proposed = values.proposed;
        const current = values.current;
        const unsafeVehicle = kind === 'vehicles' && current !== null && (current as Vehicle).location !== null;
        const removedNote = kind === 'notes' && current !== null && (current as Note).userRemoved && !(proposed as Note).userRemoved;
        const describe = (value: Vehicle | Note | null) => {
          if (!value) return 'not present';
          if ('text' in value) return `${value.text}${value.userRemoved ? ' (removed)' : ''}`;
          const fuel = value.fuelEconomy ? `${value.fuelEconomy.value} ${value.fuelEconomy.unit}` : 'unknown fuel use';
          return `${value.name} · ${value.type} · ${value.ownership} · ${fuel}`;
        };
        const selectionKey = `${kind}:${id}`;
        return <label key={selectionKey} className="profile-record-conflict">
          <input type="checkbox" disabled={unsafeVehicle || removedNote} checked={selectedConflictIds.includes(selectionKey)} onChange={event => setSelectedConflictIds(previous =>
            event.target.checked ? [...previous, selectionKey] : previous.filter(item => item !== selectionKey))} />
          <span><strong>{kind === 'vehicles' ? (proposed as Vehicle).name : 'Profile note'}</strong>: saved — {describe(current as Vehicle | Note | null)}; your draft — {describe(proposed as Vehicle | Note)}{unsafeVehicle ? ' This vehicle cannot be safely reapplied here.' : ''}{removedNote ? ' A removed note cannot be restored with this ID.' : ''}</span>
        </label>;
      }))}
      <button type="button" disabled={busy || !selectedConflictIds.length} onClick={reapplyConflict}>Save selected changes</button>
      <button type="button" disabled={busy} onClick={() => void discardConflict()}>Discard draft and load latest</button>
    </section>}
    {pending && !conflict && <div aria-label="Record save recovery">
      <button type="button" disabled={busy} onClick={() => void checkPending()}>Check save status</button>
      {retryAllowed && <button type="button" disabled={busy} onClick={() => void checkPending(true)}>Retry same save</button>}
    </div>}
    <button type="button" disabled={isDisabled || (!dirtyVehicles.length && !dirtyNotes.length)} onClick={saveDrafts}>Save record changes</button>
  </section>;
}
