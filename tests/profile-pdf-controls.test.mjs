import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [controls, editor] = await Promise.all([
  readFile(new URL('../app/profile/profile-pdf-controls.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/profile/profile-editor.tsx', import.meta.url), 'utf8'),
]);

// These source-level checks cover integration wiring only; they are not browser or download acceptance evidence.
test('PDF review is bound to the exact canonical account, revision, and server save time', () => {
  assert.match(controls, /profile\.updatedAt\s*\?\s*\{\s*accountId:\s*profile\.accountId,\s*revision:\s*profile\.revision,\s*savedAt:\s*profile\.updatedAt/s);
  assert.match(controls, /acknowledged:\s*acknowledgment/);
  assert.match(editor, /profile\.accountId\s*&&\s*profile\.updatedAt/);
  assert.match(editor, /key=\{`\$\{profile\.accountId\}:\$\{profile\.revision\}:\$\{profile\.updatedAt\}`\}/);
});

test('dirty, pending, conflicted, and record edits disable PDF controls', () => {
  assert.match(editor, /disabled=\{busy\s*\|\|\s*!!pending\s*\|\|\s*!!conflict\s*\|\|\s*recordsPending\s*\|\|\s*recordsDraftDirty\s*\|\|\s*Object\.values\(dirty\)\.some\(Boolean\)\s*\|\|\s*signedOut\}/);
  assert.match(controls, /if\s*\(disabled\s*\|\|\s*working\s*\|\|\s*!preview\s*\|\|\s*!acknowledgment\)/);
});

test('profile transfer and record controls use distinct stable sibling keys', () => {
  assert.match(editor, /<ProfileTransferControls key=\{`profile-transfer:\$\{profile\.accountId\}`\}/);
  assert.match(editor, /<ProfileRecordsControls key=\{`profile-records:\$\{profile\.accountId\}`\}/);
  assert.doesNotMatch(editor, /<ProfileTransferControls key=\{profile\.accountId\}/);
  assert.doesNotMatch(editor, /<ProfileRecordsControls key=\{profile\.accountId\}/);
});

test('local font and deferred PDF code are generation-guarded and controller-cancellable with a timeout', () => {
  assert.match(controls, /await import\('@\/lib\/profile-pdf\.mjs'\)/);
  assert.match(controls, /registerController\(controller\)/);
  assert.match(controls, /generation === getSessionGeneration\(\)/);
  assert.match(controls, /controllerRef\.current\?\.abort\(\)/);
  assert.match(controls, /fetch\('\/fonts\/Manrope\.ttf'/);
  assert.match(controls, /signal:\s*controller\.signal/);
  assert.match(controls, /setTimeout\([\s\S]*?25_000\)/);
  assert.match(controls, /clearTimeout\(fontFetchTimer\)/);
  const logout = editor.match(/async function logout\(\)\s*\{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.match(logout, /generation\.current\s*=\s*advanceRequestGeneration/);
  assert.match(logout, /abortClientRequests\(\)/);
  assert.match(logout, /clearPrivateState\(\)/);
});

test('preview preserves long whitespace safely; download wording and Blob URL revocation are accurate', () => {
  assert.match(controls, /whiteSpace:\s*'pre-wrap'/);
  assert.match(controls, /overflowWrap:\s*'anywhere'/);
  assert.match(controls, /PDF download started for saved revision/);
  assert.match(controls, /URL\.revokeObjectURL\(blobUrlRef\.current\)/);
});
