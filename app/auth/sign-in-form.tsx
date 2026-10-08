'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthForm({ email, next }: { email: string; next: string }) {
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [uncertainSend, setUncertainSend] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || uncertainSend) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/account/auth', { method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requested ? { action: 'verify', email, otp, next } : { action: 'send', email }),
        signal: AbortSignal.timeout(25000) });
      const result = await response.json();
      if (response.ok && result.ok === true) {
        if (requested && result.next === next) { setOtp(''); router.replace(next); router.refresh(); }
        else { setRequested(true); setMessage('A code was requested. Check your email.'); }
      } else {
        setMessage(result.category === 'throttled' ? 'Too many attempts. Try again in a new sign-in window.'
          : result.category === 'auth' ? 'That code could not be verified. Check the code and try again.'
          : 'Sign-in is unavailable. Your code has not been retried.');
        if (!requested && result.category === 'unavailable') setUncertainSend(true);
      }
    } catch {
      setMessage('Sign-in could not be confirmed. No automatic retry was made.');
      if (!requested) setUncertainSend(true);
    } finally { setBusy(false); }
  }
  return <form className="account-form" onSubmit={submit}>
    <label htmlFor="email">Email</label><input id="email" type="email" autoComplete="username" value={email} readOnly />
    {requested && <><label htmlFor="code">Sign-in code</label><input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={event => setOtp(event.target.value)} required /></>}
    <button type="submit" disabled={busy || uncertainSend}>{busy ? 'Please wait…' : requested ? 'Sign in' : 'Send sign-in code'}</button>
    {uncertainSend && <p>Check your email before requesting another code. <button type="button" onClick={() => { setUncertainSend(false); setRequested(true); }}>I have a code</button></p>}
    <p role="status" aria-live="polite">{message}</p>
  </form>;
}
