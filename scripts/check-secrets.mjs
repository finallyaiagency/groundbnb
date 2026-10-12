import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const patterns = [
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /postgres(?:ql)?:\/\/[^:@\s]+:[^@\s]+@/i,
];
const failures = [];
for (const file of files) {
  if (/^\.env(?!\.example$)/.test(file)) failures.push(`${file}: environment file tracked`);
  if (file === '.env.example') continue;
  let body;
  try { body = readFileSync(file, 'utf8'); } catch { continue; }
  if (patterns.some(pattern => pattern.test(body))) failures.push(`${file}: possible credential`);
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`No common credential patterns in ${files.length} source files`);
