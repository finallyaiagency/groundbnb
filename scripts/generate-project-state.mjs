import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { loadAmendments, amendView } from './spec-amendments.mjs';

const root = process.cwd();
const sourcePath = join(root, 'docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md');
const source = readFileSync(sourcePath, 'utf8');
const lines = source.split(/\r?\n/);
const hash = createHash('sha256').update(readFileSync(sourcePath)).digest('hex').toUpperCase();
const generatedAt = '2026-09-29';
const amendments = loadAmendments(root, source, hash);

const headings = lines.map((line, index) => ({ line, index })).filter(x => /^#{1,4} /.test(x.line));
function section(prefix) {
  const start = headings.find(x => x.line.startsWith(prefix));
  if (!start) throw new Error(`Missing section: ${prefix}`);
  const level = start.line.match(/^#+/)[0].length;
  const end = headings.find(x => x.index > start.index && x.line.match(/^#+/)[0].length <= level);
  return lines.slice(start.index, end?.index ?? lines.length).join('\n').trim();
}

const views = {
  '00-overview': ['## 0. v2.5', '## 1. Product contract'],
  '01-ui-nav': ['## 2. Navigation', '### 11.1 Navigation', '### 11.2 Visual'],
  '02-planner': ['## 3. Planner', '### 11.4 Mutations', '### 11.17 Low-friction'],
  '03-routing': ['## 4. Stops', '### 11.5 Routing'],
  '04-calendar-time': ['## 5. Calendar', '### 11.6 Scheduling'],
  '05-tour-files': ['## 6. Map tour', '### 11.7 Tours', '### 11.8 Portable', '### 11.19 Route-tour'],
  '06-pro-rec': ['## 7. Recommendations', '### 11.9 External'],
  '07-data-ops': ['## 8. Standalone', '### 11.3 Canonical'],
  '08-catalog': ['## 9. Exact choice', '## 10. End-to-end'],
  '09-admin-usage': ['### 11.10 Administration', '### 11.11 Token'],
  '10-mcp': ['### 11.12 Headless'],
  '11-maps-modes': ['### 11.13 Map modes'],
  '12-membership': ['### 11.14 Individual', '### 11.15 Special'],
  '13-launch': ['### 11.16 Fresh', '### 11.18 Capacity', '### 11.20 Public', '### 11.21 Units', '## 13. Completion'],
  '14-fixtures': ['### 12.2 Deterministic', '### 12.3 Visual'],
  '15-shared-safeguards': ['## 0. v2.5', '### 11.22 Release integrity'],
};
mkdirSync(join(root, 'docs/spec'), { recursive: true });
for (const [name, prefixes] of Object.entries(views)) {
  const body = amendView(prefixes.map(section).join('\n\n---\n\n'), name, amendments);
  writeFileSync(join(root, `docs/spec/${name}.md`), `<!-- Generated from docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md; SHA-256 ${hash}; ${generatedAt}. Do not edit directly. -->\n\n${body}\n`);
}

// Regenerate views without discarding the requirement status/evidence ledger.
if (process.argv.includes('--views-only')) {
  console.log(`Generated ${Object.keys(views).length} views; ledger preserved; SHA-256 ${hash}`);
  process.exit(0);
}

const milestoneByPrefix = {
  SYS: 'M0', UI: 'M1', NAV: 'M1', IN: 'M1', ACC: 'M1', MEM: 'M1', REL: 'M1',
  TRP: 'M2', DATA: 'M2', OP: 'M2', ROUTE: 'M3', MODE: 'M3', MAP: 'M3',
  CHAT: 'M4', PRO: 'M4', REC: 'M4', CAL: 'M5', TIME: 'M5',
  TOUR: 'M6', FILE: 'M6', ADM: 'M7', USG: 'M7', LEG: 'M8', SCL: 'M8',
  MCP: 'M9', OPT: 'M1', PLAN: 'M2', MOB: 'M1', RULE: 'M2', FLOW: 'M8',
};
const overrides = { 'SYS-12':'M2A', 'SYS-13':'M2A', 'RULE-12':'M0', 'RULE-13':'M0',
  'SYS-10':'M8', 'SYS-08':'M8', 'SYS-07':'M2', 'UI-09':'M8', 'SCL-02':'v2',
  'MCP-06':'v2' };
const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const header = ['id','title','tier','milestone','depends_on','status','evidence','notes','v1_portion_status','v1_portion_evidence','extension_status','extension_evidence','source_line'];
const rows = [];
const seen = new Set();
for (let i = 0; i < lines.length; i++) {
  const match = lines[i].match(/^\| ([A-Z]+-\d+) \*\*\[([^\]]+)\]\*\* \| (.+?) \|/);
  if (!match) continue;
  const [, id, tier, description] = match;
  if (seen.has(id)) throw new Error(`Duplicate requirement ${id}`);
  seen.add(id);
  const firstSentence = description.replace(/\*\*/g, '').split(/(?<=[.!?])\s/)[0];
  const title = firstSentence.length > 145 ? firstSentence.slice(0, 142) + '…' : firstSentence;
  const mixed = tier.includes('→');
  const milestone = tier === 'v2' ? 'v2' : tier.startsWith('v1.1') ? 'M9' : (overrides[id] ?? milestoneByPrefix[id.split('-')[0]] ?? 'M8');
  rows.push([id,title,tier,milestone,'','Not started','','',mixed && tier.startsWith('v1→') ? 'Not started' : '', '',mixed ? 'Not started' : '', '',i + 1]);
}
if (rows.length !== 249) throw new Error(`Expected 249 requirements, got ${rows.length}`);
writeFileSync(join(root, 'docs/ledger.csv'), [header.join(','), ...rows.map(row => row.map(escape).join(','))].join('\n') + '\n');
writeFileSync(join(root, 'docs/spec/SOURCE-HASH.txt'), `${hash}  docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md\n`);
console.log(`Generated ${Object.keys(views).length} views and ${rows.length} ledger rows; SHA-256 ${hash}`);
