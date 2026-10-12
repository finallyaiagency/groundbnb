import { notFound } from 'next/navigation';
import { browserAuthConfiguration } from '@/lib/browser-auth.mjs';
import ProfileEditor from './profile-editor';
export const dynamic = 'force-dynamic';
export default function ProfilePage() {
  if (!browserAuthConfiguration(process.env)) notFound();
  return <main className="account-page"><div className="mark">Groundbnb</div><h1>Your travel profile</h1><ProfileEditor /></main>;
}
