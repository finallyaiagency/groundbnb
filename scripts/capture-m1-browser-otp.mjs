import { publicEncrypt, constants } from 'node:crypto';
import { realpath, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const deadline = setTimeout(() => process.exit(1), 22000);
let client;
try {
  let input = '';
  for await (const chunk of process.stdin) { input += chunk; if (input.length > 10000) throw Error(); }
  const { account, sentAt, publicKey, runId, outputPath } = JSON.parse(input); input = '';
  const sent = Date.parse(sentAt);
  if (account.kind !== 'local' || account.host !== 'smtp.ethereal.email' || account.port !== 587 ||
      !account.user?.endsWith('@ethereal.email') || !account.pass || !Number.isFinite(sent) ||
      sent > Date.now() || Date.now() - sent > 300000 || !publicKey?.startsWith('-----BEGIN PUBLIC KEY-----')) throw Error();
  let target = new URL('../.tmp/evidence/m1-browser-code.encrypted', import.meta.url);
  if (runId !== undefined || outputPath !== undefined) {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const expectedRunId = typeof runId === 'string' && /^[0-9a-f]{32}$/.test(runId) ? runId : null;
    const expectedOutput = expectedRunId && resolve(root, '.tmp/evidence/m1-browser-runs', expectedRunId, 'code.encrypted');
    if (!expectedOutput || typeof outputPath !== 'string' || resolve(root, outputPath) !== expectedOutput) throw Error();
    const evidenceRoot = resolve(root, '.tmp/evidence/m1-browser-runs');
    const [realEvidenceRoot, realRunDir] = await Promise.all([realpath(evidenceRoot), realpath(dirname(expectedOutput))]);
    if (realRunDir !== resolve(realEvidenceRoot, expectedRunId)) throw Error();
    target = expectedOutput;
  }
  client = new ImapFlow({ host: 'imap.ethereal.email', port: 993, secure: true,
    auth: { user: account.user, pass: account.pass }, tls: { rejectUnauthorized: true },
    logger: false, logRaw: false, emitLogs: false, disableAutoIdle: true,
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 8000 });
  client.on('error', () => {});
  await client.connect();
  const lock = await client.getMailboxLock('INBOX', { readOnly: true });
  try {
    const count = client.mailbox.exists;
    if (!client.mailbox.readOnly || !Number.isInteger(count) || count < 1 || count > 20) throw Error();
    const messages = await client.fetchAll(`1:${count}`, { envelope: true, internalDate: true, size: true });
    const codes = new Set();
    for (const message of messages) {
      if (message.internalDate.getTime() < sent || message.size > 50000 ||
          !message.envelope?.to?.some(to => to.address === 'local-01@example.test') ||
          !message.envelope?.from?.some(from => from.address === account.user)) continue;
      const full = await client.fetchOne(message.uid, { source: true }, { uid: true });
      const mail = await simpleParser(full.source, { skipTextToHtml: true, skipImageLinks: true });
      for (const code of (mail.text ?? '').match(/\b\d{6}\b/g) ?? []) codes.add(code);
    }
    if (codes.size !== 1) throw Error();
    const encrypted = publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256' }, Buffer.from([...codes][0]));
    await writeFile(target, encrypted, { flag: 'wx' });
  } finally { lock.release(); }
  process.stdout.write('Captured');
} catch { process.exitCode = 1; }
finally { client?.close(); clearTimeout(deadline); }
