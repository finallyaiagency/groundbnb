import Link from 'next/link';

export default function NotFound() {
  return <main className="not-found"><p className="eyebrow">Groundbnb control center</p><h1>Page unavailable</h1><p>This view does not exist.</p><Link className="button primary" href="/">Return to overview</Link></main>;
}
