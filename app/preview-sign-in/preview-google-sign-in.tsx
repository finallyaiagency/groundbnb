'use client';

import { createAuthClient } from '@neondatabase/auth/next';
import { useState } from 'react';

const authClient = createAuthClient();

export default function PreviewGoogleSignIn() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setError('');
    setBusy(true);
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/preview-sign-in' });
      if (result.error) setError('Sign-in could not start. Please try again.');
    } catch {
      setError('Sign-in could not start. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ margin: '24px 0' }}>
      <button className="button primary" type="button" disabled={busy} onClick={signIn}>
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>
      {error && <p role="alert" style={{ color: 'var(--red)', marginTop: 12 }}>{error}</p>}
    </div>
  );
}
