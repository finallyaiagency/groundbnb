'use client';

import { useEffect, useMemo, useState } from 'react';
import { forecast } from '@/lib/forecast';

type Fields = { remaining: string; fiveHour: string; weekly: string; dwell: string; wait: string };
const empty: Fields = { remaining: '', fiveHour: '', weekly: '', dwell: '', wait: '0' };
const numberOrNull = (x: string) => x.trim() && Number.isFinite(Number(x)) ? Number(x) : null;
const formatDate = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));

export default function ForecastForm({ measuredCredits, verified, applicable }: { measuredCredits: number | null; verified: number; applicable: number }) {
  const [fields, setFields] = useState<Fields>(empty);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try { const saved = JSON.parse(localStorage.getItem('groundbnb-forecast-v1') || 'null'); if (saved) setFields({ ...empty, ...saved }); } catch {}
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const update = (key: keyof Fields, value: string) => { const next = { ...fields, [key]: value }; setFields(next); localStorage.setItem('groundbnb-forecast-v1', JSON.stringify(next)); };
  const observedRemaining = verified > 0 && measuredCredits !== null ? measuredCredits / verified * (applicable - verified) : null;
  const manualRemaining = numberOrNull(fields.remaining);
  const remainingCredits = manualRemaining ?? observedRemaining;
  const dwellSamples = useMemo(() => fields.dwell.split(/[\s,;]+/).map(Number).filter(x => Number.isFinite(x) && x >= 0 && fields.dwell.trim()), [fields.dwell]);
  const result = forecast({ remainingCredits, fiveHourCapacity: numberOrNull(fields.fiveHour), weeklyCapacity: numberOrNull(fields.weekly), dwellSamples,
    waitHours: numberOrNull(fields.wait) ?? 0, now: new Date() });
  const canShowMinimum = ready && result.minimum && remainingCredits !== null;
  const sampleLabel = dwellSamples.length ? `${dwellSamples.length} observed interval${dwellSamples.length === 1 ? '' : 's'}` : 'No observed intervals';
  return <div className="forecast-layout">
    <div className="panel"><div className="panel-head"><div><p className="eyebrow">Calibration</p><h2>Forecast inputs</h2></div><span className="tag muted">Saved on this device</span></div>
      <p className="quiet">Groundbnb is assumed to be the only project using this allowance. Manual numbers are planning inputs, not platform reports.</p>
      <div className="field-grid">
        <label>Remaining credits <span>Manual estimate</span><input type="number" min="0" step="0.01" value={fields.remaining} onChange={e => update('remaining', e.target.value)} placeholder="Unknown" /></label>
        <label>Five-hour capacity <span>Credit equivalent</span><input type="number" min="0" step="0.01" value={fields.fiveHour} onChange={e => update('fiveHour', e.target.value)} placeholder="Unknown" /></label>
        <label>Weekly capacity <span>Credit equivalent</span><input type="number" min="0" step="0.01" value={fields.weekly} onChange={e => update('weekly', e.target.value)} placeholder="Unknown" /></label>
        <label>Current mandatory wait <span>Hours</span><input type="number" min="0" step="0.25" value={fields.wait} onChange={e => update('wait', e.target.value)} /></label>
        <label className="wide">Observed dwell intervals <span>Hours after eligibility; comma-separated</span><input value={fields.dwell} onChange={e => update('dwell', e.target.value)} placeholder="e.g. 2.5, 4, 3" /></label>
      </div>
      <p className="source-note">Measured credits: {measuredCredits === null ? 'Unknown' : measuredCredits.toFixed(1)} · Verified v1 portions: {verified}/{applicable} · {sampleLabel}</p>
    </div>
    <div className="panel"><div className="panel-head"><div><p className="eyebrow">Allowance-constrained scenarios</p><h2>Completion outlook</h2></div><span className="tag amber">Estimate</span></div>
      <div className="scenario-grid">
        <div className="scenario-card"><p className="metric-label">Minimum dwell</p><strong>{canShowMinimum ? formatDate(result.minimum!.date) : 'Insufficient observed data'}</strong><p>{canShowMinimum ? `${result.minimum!.capacityPerWeek.toFixed(1)} credit-equivalent / week` : 'Add a remaining-credit basis and both capacity calibrations.'}</p></div>
        <div className="scenario-card"><p className="metric-label">Consistent dwell</p><strong>{ready && result.consistent ? formatDate(result.consistent.date) : 'Insufficient observed data'}</strong><p>{result.consistent ? `${result.observedDwell}h median dwell · ${result.consistent.capacityPerWeek.toFixed(1)} / week` : 'Needs at least three observed eligible-to-start intervals.'}</p></div>
      </div>
      <div className="forecast-facts"><div><span>Five-hour windows</span><b>{result.windows ?? 'Unknown'}</b></div><div><span>Active limiter</span><b>{result.minimum?.limiter ?? 'Unknown'}</b></div><div><span>Confidence</span><b>{manualRemaining !== null ? 'Low · manual input' : observedRemaining !== null ? 'Low · early sample' : 'Unknown'}</b></div></div>
      <p className="quiet">When the weekly ceiling is lower than five-hour throughput, shorter dwell does not improve the date. A forecast is a capacity scenario, not a delivery promise.</p>
    </div>
  </div>;
}
