import 'server-only';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const docsRoot = join(root, 'docs');
const read = (path: string) => readFileSync(join(docsRoot, path), 'utf8');
const readJson = <T,>(path: string): T => JSON.parse(read(path));

export type Requirement = {
  id: string; title: string; tier: string; milestone: string; depends_on: string;
  status: string; evidence: string; notes: string; v1_portion_status: string;
  v1_portion_evidence: string; extension_status: string; extension_evidence: string; source_line: string;
};
export type Milestone = { id: string; name: string; tier: string; status: string; gate: string; source: string };
export type Question = { id: string; status: string; topic: string; nextAction: string };
export type Decision = { id: string; questionId: string; source: string; decision: string; rationale: string; date: string; implementationStatus: string };
export type ChangeRequest = { id: string; type: string; title: string; status: string; createdAt: string; requirementIds: string[] };
export type MarketRecord = { name: string; category: string; audience: string; capabilities: string[]; sourceUrl: string; checkedAt: string; notes: string };
export type Opportunity = { id: string; source: string; capability: string; userProblem: string; proposal: string; disposition: string; complexity: string; releaseTier: string; evidenceUrl: string };

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let value = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(value); value = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = '';
    } else value += c;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function records<T>(csv: string): T[] {
  const [headers, ...rows] = parseCsv(csv);
  return rows.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])) as T);
}

export function evidenceUrl(path: string, line?: string | number) {
  const safe = path.replaceAll('\\', '/').replace(/^\/+/, '');
  return `https://github.com/finallyaiagency/groundbnb/blob/main/${safe}${line ? `#L${line}` : ''}`;
}

function parseQuestions(md: string): Question[] {
  return md.split(/\r?\n/).filter(line => /^\| Q-\d+ \|/.test(line)).map(line => {
    const [, id, status, topic, nextAction] = line.split('|').map(x => x.trim());
    return { id, status, topic, nextAction };
  });
}

function parseIntegrations(md: string) {
  return md.split(/\r?\n/).filter(line => /^\| (GitHub|Neon|Vercel|Codex\/Work|Google Maps)/.test(line)).map(line => {
    const [, provider, identity, status, nextAction] = line.split('|').map(x => x.trim());
    return { provider, identity, status, nextAction };
  });
}

function parseTasks() {
  return readdirSync(join(docsRoot, 'tasks')).filter(x => x.endsWith('.md')).map(file => {
    const content = read(`tasks/${file}`);
    return { id: file.split('-').slice(0, file.startsWith('PCC') ? 2 : 2).join('-'), title: content.split(/\r?\n/)[0].replace(/^# /, ''), path: `docs/tasks/${file}` };
  });
}

export function loadProject() {
  const requirements = records<Requirement>(read('ledger.csv'));
  const usage = records<Record<string, string>>(readFileSync(join(root, 'implementation-usage.csv'), 'utf8'));
  const decisions = readdirSync(join(docsRoot, 'decisions')).filter(x => x.endsWith('.json')).map(x => readJson<Decision>(`decisions/${x}`));
  const market = readJson<{ competitors: MarketRecord[]; opportunities: Opportunity[] }>('market/intelligence.json');
  const v1Applicable = requirements.filter(r => r.tier === 'v1' || r.tier.startsWith('v1→'));
  const v1Implemented = v1Applicable.filter(r => ['Implemented','Verified'].includes(r.tier.includes('→') ? r.v1_portion_status : r.status));
  const v1Verified = v1Applicable.filter(r => (r.tier.includes('→') ? r.v1_portion_status : r.status) === 'Verified');
  const statuses = ['Not started','Implemented','Verified','Failed','Blocked'].map(status => ({ status, count: requirements.filter(r => r.status === status).length }));
  const tiers = [...new Set(requirements.map(r => r.tier))].map(tier => ({ tier, count: requirements.filter(r => r.tier === tier).length }));
  return {
    name: process.env.NEXT_PUBLIC_PROJECT_NAME || 'Groundbnb',
    revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'Local draft',
    generatedAt: '2026-09-29',
    requirements, milestones: readJson<Milestone[]>('milestones.json'),
    questions: parseQuestions(read('OPEN-DECISIONS.md')),
    decisions, changes: readJson<ChangeRequest[]>('changes/requests.json'),
    integrations: parseIntegrations(read('integrations.md')),
    tests: readJson<Array<{ id: string; category: string; result: string; revision: string; evidence: string; date: string }>>('qa/runs.json'),
    usage, tasks: parseTasks(), market,
    metrics: { total: requirements.length, v1Applicable: v1Applicable.length, v1Implemented: v1Implemented.length,
      v1Verified: v1Verified.length, statuses, tiers },
  };
}

export type Project = ReturnType<typeof loadProject>;
