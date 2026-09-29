import { notFound } from 'next/navigation';
import Dashboard from '@/components/dashboard';
import { loadProject } from '@/lib/project';

export const dynamic = 'force-dynamic';
const views = ['milestones','requirements','tasks','tests','risks','decisions','changes','integrations','usage','prediction','activity','market','handoff'] as const;

export default async function SectionPage({ params, searchParams }: {
  params: Promise<{ view: string }>;
  searchParams: Promise<{ status?: string; tier?: string; milestone?: string; q?: string }>;
}) {
  const { view } = await params;
  if (!views.includes(view as typeof views[number])) notFound();
  return <Dashboard view={view} project={loadProject()} filters={await searchParams} />;
}
