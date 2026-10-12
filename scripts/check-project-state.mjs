import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadAmendments, amendmentsForView, amendmentNotice } from './spec-amendments.mjs';

const source = readFileSync('docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md');
const hash = createHash('sha256').update(source).digest('hex').toUpperCase();
const expected = readFileSync('docs/spec/SOURCE-HASH.txt', 'utf8').split(' ')[0];
const errors = [];
if (hash !== expected) errors.push('Frozen source hash changed');
let amendments = [];
try { amendments = loadAmendments(process.cwd(), source.toString('utf8'), hash); }
catch (error) { errors.push(error.message); }
for (const file of readdirSync('docs/spec').filter(x => x.endsWith('.md'))) {
  const view = readFileSync(`docs/spec/${file}`, 'utf8');
  if (!view.includes(`SHA-256 ${hash}`)) errors.push(`Stale derived view ${file}`);
  const active = amendmentsForView(amendments, file.replace(/\.md$/, ''));
  const notice = amendmentNotice(active).trim();
  const actualNotice = view.match(/<!-- Approved client amendments: .*? -->/)?.[0] ?? '';
  if (actualNotice !== notice) errors.push(`Stale amendment notice ${file}`);
  for (const amendment of active) {
    for (const replacement of amendment.replacements.filter(x => x.views.includes(file.replace(/\.md$/, '')))) {
      if (view.includes(replacement.before) || view.split(replacement.after).length !== 2) errors.push(`Stale amended view ${file}: ${amendment.id}`);
    }
  }
}
for (const amendment of amendments) {
  for (const replacement of amendment.replacements) {
    for (const name of replacement.views) {
      if (!readdirSync('docs/spec').includes(`${name}.md`)) errors.push(`Unknown amended view ${name}`);
    }
  }
}
const rows = source.toString('utf8').split(/\r?\n/).flatMap((line, index) => {
  const match = line.match(/^\| ([A-Z]+-\d+) \*\*\[([^\]]+)\]\*\* \|/);
  return match ? [{ id: match[1], tier: match[2], line: index + 1 }] : [];
});
const ledger = readFileSync('docs/ledger.csv', 'utf8').trim().split(/\r?\n/).slice(1).map(line => {
  const cells = [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(x => x[1].replaceAll('""','"'));
  return { id: cells[0], tier: cells[2], milestone: cells[3], dependsOn: cells[4], status: cells[5], evidence: cells[6], sourceLine: Number(cells[12]) };
});
if (rows.length !== 249 || ledger.length !== rows.length) errors.push(`Requirement count mismatch: source ${rows.length}, ledger ${ledger.length}`);
const sourceIds = new Set(rows.map(x => x.id));
if (sourceIds.size !== rows.length || new Set(ledger.map(x => x.id)).size !== ledger.length) errors.push('Duplicate requirement ID');
for (const row of rows) {
  const item = ledger.find(x => x.id === row.id);
  if (!item) { errors.push(`Missing ${row.id}`); continue; }
  if (item.tier !== row.tier || item.sourceLine !== row.line) errors.push(`Tier/source mismatch ${row.id}`);
  if (!['Not started','Implemented','Verified','Failed','Blocked'].includes(item.status)) errors.push(`Invalid status ${row.id}`);
  if (item.status === 'Verified' && !item.evidence) errors.push(`Verified without evidence ${row.id}`);
}
const tiers = new Map(ledger.map(x => [x.id, x.tier]));
for (const item of ledger) {
  for (const dependency of item.dependsOn.split(/[;|\s]+/).filter(Boolean)) {
    if (!tiers.has(dependency)) errors.push(`Unknown dependency ${item.id} -> ${dependency}`);
    if (item.tier.startsWith('v1') && item.milestone !== 'M9' && item.milestone !== 'v2' &&
        (tiers.get(dependency) === 'v1.1' || tiers.get(dependency) === 'v2' || tiers.get(dependency)?.startsWith('v1.1→'))) {
      errors.push(`Future-tier dependency ${item.id} -> ${dependency}`);
    }
  }
}
const task = readFileSync('docs/tasks/M0-01-repo-environments.md', 'utf8');
const binding = task.match(/Binding requirements: ([^.]+)\./)?.[1].match(/[A-Z]+-\d+/g) ?? [];
const fingerprint = task.match(/Source rows SHA-256[^`]*`([A-F0-9]{64})`/)?.[1];
const sourceLines = source.toString('utf8').split(/\r?\n/);
if (!binding.length || binding.some(id => !sourceIds.has(id))) errors.push('M0 task has missing or unknown binding IDs');
const currentFingerprint = createHash('sha256').update(binding.map(id => sourceLines.find(line => line.startsWith(`| ${id} **`)) ?? '').join('\n')).digest('hex').toUpperCase();
if (fingerprint !== currentFingerprint) errors.push('M0 task source-row fingerprint is stale');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Project state valid: ${rows.length} IDs, source SHA-256 ${hash}`);
