'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PROFILE_FIELD_GROUPS, PROFILE_FIELD_LABELS } from './profile-fields';

type PdfProfile = {
  accountId: string;
  revision: number;
  updatedAt?: string;
  answers: Record<string, unknown>;
  vehicles?: unknown[];
  notes?: unknown[];
};

type PdfAcknowledgment = { accountId: string; revision: number; savedAt: string };
type PdfPreview = {
  title: string;
  revision: number;
  savedAt: string;
  completion: { percentage: number; completedCategories: number; categories: { key: string; title: string; complete: boolean }[] };
  sections: { title: string; lines?: string[]; records?: { title: string; lines: string[] }[] }[];
  notes: string[];
  warnings: string[];
};

type Props = {
  profile: PdfProfile;
  disabled: boolean;
  registerController: (controller: AbortController) => () => void;
  getSessionGeneration: () => number;
};

const previewTextStyle = { whiteSpace: 'pre-wrap' as const, overflowWrap: 'anywhere' as const };

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return 'The PDF could not be prepared. Your saved profile has not changed.';
}

export default function ProfilePdfControls({ profile, disabled, registerController, getSessionGeneration }: Props) {
  const [includeHome, setIncludeHome] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [reviewed, setReviewed] = useState<{ content: PdfPreview; key: string } | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('Choose what to include, then review the PDF contents.');
  const controllerRef = useRef<AbortController | null>(null);
  const unregisterRef = useRef<(() => void) | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const revokeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  const cancelActiveWork = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    unregisterRef.current?.();
    unregisterRef.current = null;
  }, []);

  const revokeBlobUrl = useCallback(() => {
    if (revokeTimerRef.current) clearTimeout(revokeTimerRef.current);
    revokeTimerRef.current = null;
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelActiveWork();
      revokeBlobUrl();
    };
  }, [cancelActiveWork, revokeBlobUrl]);

  useEffect(() => {
    if (!disabled) return;
    cancelActiveWork();
  }, [cancelActiveWork, disabled]);

  useEffect(() => {
    cancelActiveWork();
  }, [cancelActiveWork, includeHome, includeNotes, profile.accountId, profile.revision, profile.updatedAt]);

  const acknowledgment: PdfAcknowledgment | null = profile.updatedAt
    ? { accountId: profile.accountId, revision: profile.revision, savedAt: profile.updatedAt }
    : null;
  const options = {
    profile,
    acknowledged: acknowledgment,
    saveState: 'saved',
    groups: PROFILE_FIELD_GROUPS,
    labels: PROFILE_FIELD_LABELS,
    includeHome,
    includeNotes,
  };
  const reviewKey = JSON.stringify([profile.accountId, profile.revision, profile.updatedAt, includeHome, includeNotes]);
  const preview = reviewed?.key === reviewKey && !disabled ? reviewed.content : null;

  const beginWork = useCallback(() => {
    cancelActiveWork();
    const controller = new AbortController();
    controllerRef.current = controller;
    unregisterRef.current = registerController(controller);
    return { controller, generation: getSessionGeneration() };
  }, [cancelActiveWork, getSessionGeneration, registerController]);

  const isCurrent = useCallback((controller: AbortController, generation: number) =>
    mountedRef.current && !controller.signal.aborted && generation === getSessionGeneration(), [getSessionGeneration]);

  async function reviewContents() {
    if (disabled || working || !acknowledgment) {
      setMessage('Wait until the latest saved profile is available before reviewing an export.');
      return;
    }
    const { controller, generation } = beginWork();
    setWorking(true);
    setReviewed(null);
    setMessage('Preparing the profile preview…');
    try {
      const pdf = await import('@/lib/profile-pdf.mjs');
      if (!isCurrent(controller, generation)) return;
      const next = pdf.createProfilePdfPreview(options) as PdfPreview;
      if (!isCurrent(controller, generation)) return;
      setReviewed({ content: next, key: reviewKey });
      setMessage('Review the included and omitted information below before downloading.');
    } catch (error) {
      if (isCurrent(controller, generation)) setMessage(errorMessage(error));
    } finally {
      if (controllerRef.current === controller) cancelActiveWork();
      if (mountedRef.current) setWorking(false);
    }
  }

  async function downloadPdf() {
    if (disabled || working || !preview || !acknowledgment) {
      setMessage('Review the current saved profile before downloading.');
      return;
    }
    const { controller, generation } = beginWork();
    setWorking(true);
    setMessage('Preparing your PDF on this device…');
    let fontFetchTimer: ReturnType<typeof setTimeout> | null = null;
    let fontFetchTimedOut = false;
    try {
      const pdf = await import('@/lib/profile-pdf.mjs');
      if (!isCurrent(controller, generation) || !pdf.isCurrentProfilePdfPreview(preview, options)) {
        if (isCurrent(controller, generation)) setMessage('The profile changed. Review the current saved profile before downloading.');
        return;
      }
      fontFetchTimer = setTimeout(() => { fontFetchTimedOut = true; controller.abort(); }, 25_000);
      const fontResponse = await fetch('/fonts/Manrope.ttf', {
        credentials: 'omit', cache: 'force-cache', signal: controller.signal,
      });
      if (!fontResponse.ok) throw new Error('The profile font is unavailable. Try again later.');
      const fontBuffer = await fontResponse.arrayBuffer();
      clearTimeout(fontFetchTimer);
      fontFetchTimer = null;
      const fontBytes = new Uint8Array(fontBuffer);
      if (!isCurrent(controller, generation)) return;
      const result = await pdf.createProfilePdf({ ...options, preview, fontBytes });
      if (!isCurrent(controller, generation) || !pdf.isCurrentProfilePdfPreview(preview, options)) return;
      revokeBlobUrl();
      const ownedBytes = new ArrayBuffer(result.bytes.byteLength);
      new Uint8Array(ownedBytes).set(result.bytes);
      const url = URL.createObjectURL(new Blob([ownedBytes], { type: 'application/pdf' }));
      blobUrlRef.current = url;
      const link = document.createElement('a');
      link.href = url;
      link.download = `groundbnb-profile-r${preview.revision}.pdf`;
      link.style.display = 'none';
      document.body.append(link);
      link.click();
      link.remove();
      revokeTimerRef.current = setTimeout(revokeBlobUrl, 60_000);
      setMessage(`PDF download started for saved revision ${preview.revision}.`);
    } catch (error) {
      if (fontFetchTimer) clearTimeout(fontFetchTimer);
      fontFetchTimer = null;
      if (fontFetchTimedOut && mountedRef.current && generation === getSessionGeneration()) {
        setMessage('The profile font took too long to load. Try downloading again later.');
      } else if (isCurrent(controller, generation)) setMessage(errorMessage(error));
    } finally {
      if (fontFetchTimer) clearTimeout(fontFetchTimer);
      if (controllerRef.current === controller) cancelActiveWork();
      if (mountedRef.current) setWorking(false);
    }
  }

  const controlsDisabled = disabled || working || !acknowledgment;

  return <section aria-labelledby="profile-pdf-heading" className="profile-pdf-controls">
    <h2 id="profile-pdf-heading">Download profile PDF</h2>
    <p>Review your saved profile before downloading. The PDF is prepared on this device.</p>
    <fieldset disabled={controlsDisabled} aria-describedby="profile-pdf-options-help">
      <legend>Optional personal details</legend>
      <label><input type="checkbox" checked={includeHome} onChange={event => { setReviewed(null); setIncludeHome(event.target.checked); }} /> Include home details</label>
      <label><input type="checkbox" checked={includeNotes} onChange={event => { setReviewed(null); setIncludeNotes(event.target.checked); }} /> Include saved notes</label>
    </fieldset>
    <p id="profile-pdf-options-help">Resolved home coordinates and quote text without a verified source are not included.</p>
    <div className="profile-pdf-actions">
      <button type="button" disabled={controlsDisabled} onClick={() => void reviewContents()}>Review PDF contents</button>
      <button type="button" disabled={controlsDisabled || !preview} onClick={() => void downloadPdf()}>Download PDF</button>
    </div>
    <p role="status" aria-live="polite">{message}</p>
    {preview && <section aria-labelledby="profile-pdf-preview-heading" className="profile-pdf-preview">
      <h3 id="profile-pdf-preview-heading">PDF preview · saved revision {preview.revision}</h3>
      <p>Saved {preview.savedAt}</p>
      <p>Profile completion: {preview.completion.percentage}% ({preview.completion.completedCategories} of 3 core categories)</p>
      <ul>{preview.completion.categories.map(category => <li key={category.key}>{category.title}: {category.complete ? 'Complete' : 'Not complete'}</li>)}</ul>
      {preview.sections.map(section => <section key={section.title} aria-label={section.title}>
        <h4>{section.title}</h4>
        {section.lines?.map((line, index) => <p style={previewTextStyle} key={`${section.title}-${index}`}>{line}</p>)}
        {section.records?.map(record => <div key={record.title}><h5>{record.title}</h5>
          {record.lines.map((line, index) => <p style={previewTextStyle} key={`${record.title}-${index}`}>{line}</p>)}
        </div>)}
      </section>)}
      {preview.notes.length > 0 && <section aria-label="Saved notes"><h4>Saved notes</h4>
        {preview.notes.map((note, index) => <p style={previewTextStyle} key={`note-${index}`}>{note}</p>)}
      </section>}
      {preview.warnings.length > 0 && <section aria-label="Information not included"><h4>Not included</h4>
        <ul>{preview.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
      </section>}
    </section>}
  </section>;
}
