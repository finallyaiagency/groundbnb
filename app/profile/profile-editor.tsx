'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

type Answer = { value: string | number | boolean | string[] | null; answered: boolean };
type Profile = { revision: number; answers: Record<string, Answer>; updatedAt?: string };
type Operation = { operationId: string; expectedRevision: number; patch: Record<string, Answer> };
type Conflict = { currentRevision: number; fieldComparison: Record<string, { current: Answer | null; proposed: Answer }> };
const labels: Record<string, string> = { travelerCount: 'Travelers', hasPets: 'Traveling with pets', dietaryRequirements: 'Food needs',
  homeAddress: 'Home anchor', preferredRegions: 'Preferred regions', alwaysBeginEndAtHome: 'Begin and end at home', specialRequirements: 'Support needs' };
function readable(answer: Answer | null | undefined) {
  if (!answer?.answered || answer.value === null) return 'Not specified';
  if (typeof answer.value === 'boolean') return answer.value ? 'Yes' : 'No';
  if (Array.isArray(answer.value)) return answer.value.length ? answer.value.join(', ') : 'None';
  return String(answer.value);
}
export default function ProfileEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState({ travelerCount: '', hasPets: '', dietaryRequirements: '' });
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Operation | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Loading your profile…');
  const [signedOut, setSignedOut] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const generation = useRef(0);
  const acceptProfile = useCallback((value: Profile) => {
    setProfile(value); setDirty({}); setPending(null); setConflict(null);
    setDraft({ travelerCount: value.answers.travelerCount?.answered ? String(value.answers.travelerCount.value ?? '') : '',
      hasPets: value.answers.hasPets?.answered ? String(value.answers.hasPets.value ?? '') : '',
      dietaryRequirements: value.answers.dietaryRequirements?.answered ? String(value.answers.dietaryRequirements.value ?? '') : '' });
  }, []);
  const load = useCallback(async (signal?: AbortSignal) => {
    const currentGeneration = ++generation.current;
    try {
      const response = await fetch('/api/account/profile', { cache: 'no-store', credentials: 'same-origin', signal });
      const result = await response.json();
      if (signal?.aborted || currentGeneration !== generation.current) return;
      if (response.ok && result.ok === true) { acceptProfile(result.profile); setMessage('Your saved preferences are ready.'); }
      else if (response.status === 401) {
        setProfile(null); setDraft({ travelerCount: '', hasPets: '', dietaryRequirements: '' });
        setDirty({}); setPending(null); setConflict(null); setSignedOut(true);
        setMessage('Sign in to load your profile.');
      }
      else setMessage('Your profile could not be loaded. Try again.');
    } catch { if (!signal?.aborted && currentGeneration === generation.current) setMessage('Your profile could not be loaded. Try again.'); }
  }, [acceptProfile]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => { if (!controller.signal.aborted) return load(controller.signal); });
    return () => controller.abort();
  }, [load]);
  function change(field: keyof typeof draft, value: string) { setDraft(current => ({ ...current, [field]: value })); setDirty(current => ({ ...current, [field]: true })); }
  async function save(operation: Operation) {
    const currentGeneration = ++generation.current;
    setBusy(true); setPending(operation); setConflict(null); setMessage('Saving…');
    try {
      const response = await fetch('/api/account/profile', { method: 'PATCH', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(operation), signal: AbortSignal.timeout(25000) });
      const result = await response.json();
      if (currentGeneration !== generation.current) return;
      if (response.ok && result.ok === true && result.operationId === operation.operationId && result.savedAt) {
        acceptProfile(result.profile); setMessage('Saved.');
      } else if (response.status === 409 && result.category === 'conflict') {
        setConflict({ currentRevision: result.currentRevision, fieldComparison: result.fieldComparison });
        setMessage('Your profile changed elsewhere. Review the saved and proposed values before saving again.');
      } else if (response.status === 401) {
        setProfile(null); setDraft({ travelerCount: '', hasPets: '', dietaryRequirements: '' }); setDirty({}); setPending(null); setConflict(null);
        setSignedOut(true); setMessage('Your session is unavailable. Sign in again.');
      } else if (response.status === 400) { setPending(null); setMessage('Check the fields. Your draft is kept.'); }
      else setMessage('Save could not be confirmed. Your draft is kept. Retry this same save.');
    } catch {
      if (currentGeneration === generation.current) setMessage('Save could not be confirmed. Your draft is kept. Retry this same save.');
    } finally {
      if (currentGeneration === generation.current) setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault(); if (!profile || busy || pending || !Object.values(dirty).some(Boolean)) return;
    const patch: Record<string, Answer> = {};
    if (dirty.travelerCount) patch.travelerCount = { value: draft.travelerCount === '' ? null : Number(draft.travelerCount), answered: draft.travelerCount !== '' };
    if (dirty.hasPets) patch.hasPets = { value: draft.hasPets === '' ? null : draft.hasPets === 'true', answered: draft.hasPets !== '' };
    if (dirty.dietaryRequirements) patch.dietaryRequirements = { value: draft.dietaryRequirements === '' ? null : draft.dietaryRequirements, answered: draft.dietaryRequirements !== '' };
    void save({ operationId: crypto.randomUUID(), expectedRevision: profile.revision, patch });
  }
  async function logout() {
    if (busy) return;
    ++generation.current;
    setBusy(true); setProfile(null); setDraft({ travelerCount: '', hasPets: '', dietaryRequirements: '' });
    setDirty({}); setPending(null); setConflict(null); setLogoutPending(true); setMessage('Signing out…');
    try {
      const response = await fetch('/api/account/auth', { method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }), signal: AbortSignal.timeout(25000) });
      const result = await response.json();
      if (response.ok && result.signedOut === true) { setLogoutPending(false); setSignedOut(true); setMessage('Signed out.'); }
      else setMessage('Your profile is hidden. Sign-out could not be confirmed; retry sign-out.');
    } catch { setMessage('Your profile is hidden. Sign-out could not be confirmed; retry sign-out.'); }
    finally { setBusy(false); }
  }
  return <section>
    <p role="status" aria-live="polite">{message}</p>
    {signedOut && <Link href="/auth?next=%2Fprofile">Sign in</Link>}
    {logoutPending && <button type="button" disabled={busy} onClick={() => void logout()}>Retry sign-out</button>}
    {!profile && !signedOut && !logoutPending && <button type="button" onClick={() => void load()}>Load profile</button>}
    {profile && <>
      <form className="account-form" onSubmit={submit}>
        <fieldset disabled={busy || !!pending}><legend>Travel preferences</legend>
          <label htmlFor="travelers">Number of travelers</label><input id="travelers" type="number" min={1} max={200} value={draft.travelerCount} onChange={event => change('travelerCount', event.target.value)} />
          <label htmlFor="pets">Traveling with pets</label><select id="pets" value={draft.hasPets} onChange={event => change('hasPets', event.target.value)}><option value="">Not specified</option><option value="true">Yes</option><option value="false">No</option></select>
          <label htmlFor="food">Food needs</label><textarea id="food" maxLength={2000} value={draft.dietaryRequirements} onChange={event => change('dietaryRequirements', event.target.value)} />
        </fieldset>
        <button type="submit" disabled={busy || !!pending || !Object.values(dirty).some(Boolean)}>Save preferences</button>
      </form>
      {pending && !conflict && <button type="button" disabled={busy} onClick={() => void save(pending)}>Retry same save</button>}
      {conflict && pending && <section aria-label="Review changed values"><h2>Review changes</h2>
        {Object.entries(conflict.fieldComparison).map(([field, values]) => <p key={field}><strong>{labels[field] ?? 'Preference'}</strong>: saved — {readable(values.current)}; your draft — {readable(values.proposed)}.</p>)}
        <button type="button" disabled={busy} onClick={() => void save({ ...pending, operationId: crypto.randomUUID(), expectedRevision: conflict.currentRevision })}>Save reviewed draft</button>
        <button type="button" disabled={busy} onClick={() => void load()}>Discard draft and load saved values</button>
      </section>}
      <h2>Saved profile</h2><dl>{Object.entries(labels).map(([field, label]) => <div key={field}><dt>{label}</dt><dd>{readable(profile.answers[field])}</dd></div>)}</dl>
      <button type="button" disabled={busy} onClick={() => void logout()}>Sign out</button>
    </>}
  </section>;
}
