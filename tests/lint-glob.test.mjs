import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { ESLint } from 'eslint';

const require = createRequire(import.meta.url);
const configRequire = createRequire(require.resolve('eslint-config-next'));
const pluginPath = configRequire.resolve('@next/eslint-plugin-next');
const pluginRequire = createRequire(pluginPath);
const plugin = pluginRequire('@next/eslint-plugin-next');
const { getRootDirs } = pluginRequire('./utils/get-root-dirs.js');

test('replacement glob preserves Next root discovery and internal-link enforcement', async () => {
  // Keep glob traversal inside the workspace under restricted Windows execution.
  const fixtureParent = resolve(import.meta.dirname, '../.tmp');
  mkdirSync(fixtureParent, { recursive: true });
  const root = mkdtempSync(join(fixtureParent, 'groundbnb-lint-'));
  const web = join(root, 'packages/web');
  const other = join(root, 'packages/other');
  try {
    mkdirSync(join(web, 'app/about'), { recursive: true });
    mkdirSync(other, { recursive: true });
    writeFileSync(join(web, 'app/page.jsx'), 'export default function Page() { return null; }');
    writeFileSync(join(web, 'app/about/page.jsx'), 'export default function Page() { return null; }');
    writeFileSync(join(root, 'packages/file.txt'), 'not a project directory');
    const pattern = join(root, 'packages/*');
    const found = getRootDirs({ cwd: root, settings: { next: { rootDir: pattern } } });
    assert.deepEqual(found.map(x => resolve(x)).sort(), [web, other].sort());
    assert.deepEqual(getRootDirs({ cwd: root, settings: { next: { rootDir: [pattern] } } }), found);
    assert.deepEqual(getRootDirs({ cwd: root, settings: {} }), [root]);

    const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: [{
      files: ['**/*.jsx'],
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { '@next/next': plugin },
      settings: { next: { rootDir: pattern } },
      rules: { '@next/next/no-html-link-for-pages': 'error' },
    }] });
    const options = { filePath: join(web, 'app/page.jsx') };
    const [bad] = await eslint.lintText('export default function Page() { return <a href="/">Home</a>; }', options);
    assert.equal(bad.errorCount, 1);
    assert.equal(bad.messages[0].ruleId, '@next/next/no-html-link-for-pages');
    const [good] = await eslint.lintText('export default function Page() { return <Link href="/">Home</Link>; }', options);
    assert.equal(good.errorCount, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
