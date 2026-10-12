import { notFound } from 'next/navigation';
import { browserAuthConfiguration, safeAuthNext } from '@/lib/browser-auth.mjs';
import AuthForm from './sign-in-form';
export const dynamic = 'force-dynamic';
export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const config = browserAuthConfiguration(process.env);
  if (!config) notFound();
  const query = await searchParams;
  const next = safeAuthNext(query.next ?? '/profile');
  if (!next) return <main><div className="mark">Groundbnb</div><h1>Invalid destination</h1><p><a href="/auth">Return to sign in</a></p></main>;
  return <main className="account-page"><div className="mark">Groundbnb</div><h1>Welcome back</h1><AuthForm email={config.email} next={next} /></main>;
}
