import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const controls = await readFile(new URL('../app/profile/profile-transfer-controls.tsx', import.meta.url), 'utf8');

// Source contract only: this does not establish browser download completion.
test('native profile export reports that the download was started, not completed', () => {
  assert.match(controls, /anchor\.click\(\);[\s\S]*?setMessage\('Profile file download started\.'\)/);
  assert.doesNotMatch(controls, /setMessage\('Profile file downloaded\.'\)/);
});

test('reviewed native JSON can be shown for manual copy without clipboard or storage writes', () => {
  assert.match(controls, /bytes: Uint8Array; contentType: string; text: string/);
  assert.match(controls, /function showExportJsonToCopy\(\)[\s\S]*?const exportSource = \{ \.\.\.profile, profileNotes: profile\.profileNotes \?\? \[\] \};\s*const sourceBinding = JSON\.stringify\(\{ answers: exportSource\.answers, profileNotes: exportSource\.profileNotes \}\);\s*const result = buildExportFile\(exportSource/);
  assert.match(controls, /setExportContent\(\{ text: result\.text, accountId: profile\.accountId, revision: profile\.revision, sessionGeneration, sourceBinding \}\)/);
  assert.match(controls, /value=\{exportContent\?\.text \?\? ''\} readOnly rows=\{12\}[\s\S]*?currentTarget\.select\(\)/);
  assert.match(controls, /Show JSON to copy/);
  assert.match(controls, /if \(!profile\.accountId \|\| !exportPreview \|\| disabled \|\| busy \|\| sessionGeneration !== getSessionGeneration\(\)/);
  assert.match(controls, /JSON\.stringify\(\{ answers: profile\.answers, profileNotes: profile\.profileNotes \?\? \[\] \}\)/);
  assert.match(controls, /exportContent\.accountId !== profile\.accountId \|\| exportContent\.revision !== profile\.revision \|\|[\s\S]*?exportContent\.sourceBinding !== exportSourceBinding\)\) setExportContent\(null\)/);
  assert.match(controls, /exportContent\.sessionGeneration === sessionGeneration && exportContent\.sourceBinding === exportSourceBinding/);
  assert.match(controls, /function clearPreview\(\) \{\s*clearExportText\(\)/);
  assert.match(controls, /function reviewExport\(\) \{\s*clearExportText\(\)/);
  assert.match(controls, /function clearExportText\(\) \{\s*setExportContent\(null\)/);
  assert.doesNotMatch(controls, /navigator\.clipboard|localStorage|sessionStorage/);
});
