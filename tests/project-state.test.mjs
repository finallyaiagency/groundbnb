import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const project = resolve(import.meta.dirname, '..');
const checker = join(project, 'scripts/check-project-state.mjs');

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'groundbnb-state-'));
  mkdirSync(join(root, 'docs'), { recursive: true });
  for (const path of ['spec', 'tasks', 'source', 'changes']) cpSync(join(project, 'docs', path), join(root, 'docs', path), { recursive: true });
  cpSync(join(project, 'docs/ledger.csv'), join(root, 'docs/ledger.csv'));
  return root;
}
function check(root) { return spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' }); }

test('documentation gate detects stale task references and future-tier dependencies', () => {
  const root = fixture();
  try {
    assert.equal(check(root).status, 0);
    const taskPath = join(root, 'docs/tasks/M0-01-repo-environments.md');
    const task = readFileSync(taskPath, 'utf8');
    writeFileSync(taskPath, task.replace(/Source rows SHA-256[^`]*`[A-F0-9]{64}`/, 'Source rows SHA-256: `' + '0'.repeat(64) + '`'));
    assert.match(check(root).stderr, /source-row fingerprint is stale/);
    writeFileSync(taskPath, task);
    const ledgerPath = join(root, 'docs/ledger.csv');
    const ledger = readFileSync(ledgerPath, 'utf8');
    const altered = ledger.replace(/("SYS-01","[^"]+","v1","M0",)""/, '$1"SCL-02"');
    assert.notEqual(altered, ledger);
    writeFileSync(ledgerPath, altered);
    assert.match(check(root).stderr, /Future-tier dependency SYS-01 -> SCL-02/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('approved amendment regeneration preserves ledger and rejects stale launch views', () => {
  const root = fixture();
  try {
    const source = readFileSync(join(root, 'docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md'));
    const ledger = readFileSync(join(root, 'docs/ledger.csv'));
    const generated = spawnSync(process.execPath, [join(project, 'scripts/generate-project-state.mjs'), '--views-only'], { cwd: root, encoding: 'utf8' });
    assert.equal(generated.status, 0, generated.stderr);
    assert.deepEqual(readFileSync(join(root, 'docs/ledger.csv')), ledger);
    assert.deepEqual(readFileSync(join(root, 'docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md')), source);
    assert.equal(check(root).status, 0);
    const viewPath = join(root, 'docs/spec/13-launch.md');
    const view = readFileSync(viewPath, 'utf8');
    assert.match(view, /Approved client amendments: A-001/);
    assert.match(view, /recovery window of at least six hours/);
    writeFileSync(viewPath, view.replace('recovery window of at least six hours', 'recovery window of at least seven days'));
    assert.match(check(root).stderr, /Stale amended view/);
    writeFileSync(viewPath, view);
    const amendmentPath = join(root, 'docs/changes/A-001-recovery-window.json');
    const amendment = readFileSync(amendmentPath, 'utf8');
    writeFileSync(amendmentPath, amendment.replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'));
    assert.equal(check(root).status, 0, 'amendment fingerprint must survive Windows/Linux checkout');
    writeFileSync(amendmentPath, amendment.replace('"status": "Approved"', '"status": "Proposed"'));
    assert.match(check(root).stderr, /Stale amendment notice/);
    writeFileSync(amendmentPath, amendment.replace('"sourceSha256": "E1', '"sourceSha256": "00'));
    assert.match(check(root).stderr, /Invalid approved amendment/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
