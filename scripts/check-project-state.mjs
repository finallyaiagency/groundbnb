import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const source = readFileSync('docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md');
const hash = createHash('sha256').update(source).digest('hex').toUpperCase();
const expected = readFileSync('docs/spec/SOURCE-HASH.txt', 'utf8').split(' ')[0];
const errors = [];
if (hash !== expected) errors.push('Frozen source hash changed');
for (const file of readdirSync('docs/spec').filter(x => x.endsWith('.md'))) {
  if (!readFileSync(`docs/spec/${file}`, 'utf8').includes(`SHA-256 ${hash}`)) errors.push(`Stale derived view ${file}`);
}
const rows = source.toString('utf8').split(/\r?\n/).flatMap((line, index) => {
  const match = line.match(/^\| ([A-Z]+-\d+) \*\*\[([^\]]+)\]\*\* \|/);
  return match ? [{ id: match[1], tier: match[2], line: index + 1 }] : [];
});
const ledger = readFileSync('docs/ledger.csv', 'utf8').trim().split(/\r?\n/).slice(1).map(line => {
  const cells = [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(x => x[1].replaceAll('""','"'));
  return { id: cells[0], tier: cells[2], status: cells[5], evidence: cells[6], sourceLine: Number(cells[12]) };
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
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Project state valid: ${rows.length} IDs, source SHA-256 ${hash}`);
