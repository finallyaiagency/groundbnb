import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const controls = await readFile(new URL('../app/profile/profile-transfer-controls.tsx', import.meta.url), 'utf8');
const downloadHelper = await readFile(new URL('../lib/profile-export-download.mjs', import.meta.url), 'utf8');

// Source contract only: this does not establish browser download completion.
test('native profile export reports that the download was started, not completed', () => {
  assert.match(controls, /startProfileExportDownload\(\{ bytes: result\.bytes, contentType: result\.contentType, exportedAt,/);
  assert.match(controls, /setMessage\('Profile file download started\.'\)/);
  assert.match(downloadHelper, /anchor\.click\(\)/);
  assert.doesNotMatch(controls, /setMessage\('Profile file downloaded\.'\)/);
});

test('download action requires the current reviewed profile, available controls, and sensitive confirmation', () => {
  assert.match(controls, /function canUseReviewedExport\(\)\s*\{\s*return Boolean\(profile\.accountId && currentExportPreview && !disabled && !busy && !pending && !conflict &&\s*sessionGeneration === getSessionGeneration\(\) &&\s*\(!currentExportPreview\.requiresSensitiveConfirmation \|\| confirmSensitive\)\);/);
  assert.match(controls, /function downloadExport\(\)\s*\{\s*if \(!canUseReviewedExport\(\)\) return;[\s\S]*?if \(!canUseReviewedExport\(\)\) return;[\s\S]*?startProfileExportDownload/);
  assert.match(controls, /<button type="button" disabled=\{!canUseReviewedExport\(\)\} onClick=\{downloadExport\}>Download profile file<\/button>/);
});

test('export review is hidden and discarded when account, revision, session, source, or options change', () => {
  assert.match(controls, /exportPreviewIsCurrent = Boolean\(exportPreview && profile\.accountId && exportPreviewBinding &&[\s\S]*?exportPreviewBinding\.accountId === profile\.accountId && exportPreviewBinding\.revision === profile\.revision &&[\s\S]*?exportPreviewBinding\.sessionGeneration === sessionGeneration && exportPreviewBinding\.sourceBinding === exportSourceBinding &&[\s\S]*?exportPreviewBinding\.optionsBinding === exportOptionsBinding\)/);
  assert.match(controls, /if \(exportPreview && !exportPreviewIsCurrent\) \{\s*setExportPreview\(null\);\s*setExportPreviewBinding\(null\);\s*setConfirmSensitive\(false\);\s*setExportContent\(null\);/);
  assert.match(controls, /const currentExportPreview = exportPreviewIsCurrent \? exportPreview : null/);
  assert.match(controls, /\{currentExportPreview && <div aria-label="Export preview">/);
});

test('reviewed native JSON can be shown for manual copy without clipboard or storage writes', () => {
  assert.match(controls, /bytes: Uint8Array; contentType: string; text: string/);
  assert.match(controls, /function showExportJsonToCopy\(\)[\s\S]*?const exportSource = \{ \.\.\.profile, profileNotes: profile\.profileNotes \?\? \[\] \};\s*const sourceBinding = JSON\.stringify\(\{ answers: exportSource\.answers, profileNotes: exportSource\.profileNotes \}\);\s*const optionsBinding = JSON\.stringify\(options\);\s*const result = buildExportFile\(exportSource/);
  assert.match(controls, /setExportContent\(\{ text: result\.text, accountId: profile\.accountId!, revision: profile\.revision, sessionGeneration, sourceBinding, optionsBinding \}\)/);
  assert.match(controls, /value=\{exportContent\?\.text \?\? ''\} readOnly rows=\{12\}[\s\S]*?currentTarget\.select\(\)/);
  assert.match(controls, /Show JSON to copy/);
  assert.match(controls, /function showExportJsonToCopy\(\)\s*\{\s*if \(!canUseReviewedExport\(\)\) return;/);
  assert.match(controls, /JSON\.stringify\(\{ answers: exportSource\.answers, profileNotes: exportSource\.profileNotes \}\)/);
  assert.match(controls, /exportContent\.accountId !== profile\.accountId \|\| exportContent\.revision !== profile\.revision \|\|[\s\S]*?exportContent\.sourceBinding !== exportSourceBinding \|\|\s*exportContent\.optionsBinding !== exportOptionsBinding\)\) setExportContent\(null\)/);
  assert.match(controls, /exportContent\.sessionGeneration === sessionGeneration && exportContent\.sourceBinding === exportSourceBinding &&\s*exportContent\.optionsBinding === exportOptionsBinding/);
  assert.match(controls, /function clearPreview\(\) \{\s*clearExportText\(\)/);
  assert.match(controls, /function reviewExport\(\) \{\s*clearExportText\(\)/);
  assert.match(controls, /function clearExportText\(\) \{\s*setExportContent\(null\)/);
  assert.doesNotMatch(controls, /navigator\.clipboard|localStorage|sessionStorage/);
});
