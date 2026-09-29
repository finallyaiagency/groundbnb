import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getVerifiedPccActor } from '@/lib/pcc-auth-server';
import PreviewGoogleSignIn from './preview-google-sign-in';

export const dynamic = 'force-dynamic';

export default async function PreviewSignInPage() {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'preview/control-center') {
    notFound();
  }

  const actor = await getVerifiedPccActor();

  return (
    <main style={{ maxWidth: 600, minHeight: '100vh', margin: '0 auto', padding: 'max(10vh, 48px) 20px 48px' }}>
      <p className="eyebrow">Groundbnb · Project Control Center</p>
      <section className="panel" style={{ padding: 28 }}>
        <h1>Preview sign-in</h1>
        <p>This page is for the designated test inbox. It gives no access to submit project decisions or change requests.</p>
        {actor ? (
          <p role="status" style={{ color: 'var(--teal)' }}>Your email is verified in this preview session.</p>
        ) : (
          <PreviewGoogleSignIn />
        )}
        <Link className="small-link" href="/">Back to project dashboard</Link>
      </section>
    </main>
  );
}
