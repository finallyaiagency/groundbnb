import { loadProject } from '@/lib/project';
import Dashboard from '@/components/dashboard';

export const dynamic = 'force-dynamic';

export default function Home() {
  return <Dashboard view="overview" project={loadProject()} />;
}
