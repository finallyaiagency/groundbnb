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
  for (const path of ['spec', 'tasks', 'source']) cpSync(join(project, 'docs', path), join(root, 'docs', path), { recursive: true });
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
