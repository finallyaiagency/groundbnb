// Fixed-target private verifier: credentials arrive only on transient stdin.
const deadline = setTimeout(() => process.exit(1), 45000);
try {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 8192) throw new Error('Input too large');
  }
  const { accounts, startedAtUtc } = JSON.parse(input);
  input = '';
  const startedAt = new Date(startedAtUtc);
  if (!Number.isFinite(startedAt.getTime()) || !Array.isArray(accounts) || accounts.length !== 2 ||
      accounts[0].kind !== 'preview' || accounts[1].kind !== 'local' ||
      accounts[0].user === accounts[1].user || accounts.some(account =>
        account.host !== 'smtp.ethereal.email' || account.port !== 587 ||
        typeof account.user !== 'string' || !account.user.endsWith('@ethereal.email') ||
        typeof account.pass !== 'string' || !account.pass)) throw new Error('Unexpected target');
  const { ImapFlow } = await import('imapflow');
  const { simpleParser } = await import('mailparser');
  const results = [];
  for (const account of accounts) {
    const client = new ImapFlow({
      host: 'imap.ethereal.email', port: 993, secure: true,
      auth: { user: account.user, pass: account.pass },
      tls: { rejectUnauthorized: true }, logger: false, logRaw: false, emitLogs: false,
      disableAutoIdle: true, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000,
    });
    client.on('error', () => {}); // Raw protocol errors may contain credentials; never print them.
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX', { readOnly: true });
      try {
        const count = client.mailbox.exists;
        if (!client.mailbox.readOnly || !Number.isInteger(count) || count < 1 || count > 10) throw new Error('Unexpected mailbox');
        const messages = await client.fetchAll(`1:${count}`, { envelope: true, internalDate: true, size: true });
        const recipient = `${account.kind}-01@example.test`;
        const foreignRecipient = `${account.kind === 'preview' ? 'local' : 'preview'}-01@example.test`;
        const smokeSubject = `Groundbnb M0 ${account.kind} capture check`;
        const matchesRecipient = (message, address) => message.envelope?.to?.some(to => to.address === address);
        const smokeCount = messages.filter(message => matchesRecipient(message, recipient) &&
          message.envelope.subject === smokeSubject).length;
        const neonCount = messages.filter(message => matchesRecipient(message, recipient) &&
          message.internalDate >= startedAt && message.envelope.subject !== smokeSubject &&
          /test|smtp/i.test(message.envelope.subject ?? '') &&
          message.envelope.from?.some(from => from.address === account.user)).length;
        const foreignCount = messages.filter(message => matchesRecipient(message, foreignRecipient)).length;
        const authMessages = messages.filter(message => matchesRecipient(message, recipient) &&
          /verif|reset|confirm/i.test(message.envelope.subject ?? ''));
        const linkShapes = [];
        for (const message of authMessages) {
          if (message.size > 50000) throw new Error('Message bound');
          const full = await client.fetchOne(message.uid, { source: true }, { uid: true });
          const mail = await simpleParser(full.source, { skipHtmlToText: true, skipTextToHtml: true, skipImageLinks: true });
          for (const text of `${mail.text ?? ''} ${mail.html ?? ''}`.match(/https?:\/\/[^\s<>"']+/g) ?? []) {
            let url;
            try { url = new URL(text.replaceAll('&amp;', '&')); } catch { continue; }
            if (!/verif|reset/.test(url.pathname) && !url.searchParams.has('token')) continue;
            linkShapes.push({ sameAuthHost: url.hostname === (account.kind === 'preview' ?
              'ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech' :
              'ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech'),
              knownPathSegments: url.pathname.split('/').filter(part => ['auth', 'api', 'groundbnb', 'verify-email', 'reset-password'].includes(part)),
              tokenInQuery: url.searchParams.has('token'), pathSegmentCount: url.pathname.split('/').filter(Boolean).length });
          }
        }
        results.push({ kind: account.kind, ok: smokeCount === 1 && neonCount === 1 && foreignCount === 0,
          smokeCount, neonCount, foreignCount, readOnly: true, authMessageCount: authMessages.length, linkShapes });
      } finally { lock.release(); }
      await client.logout();
    } finally { client.close(); }
  }
  const ok = results.every(result => result.ok);
  process.stdout.write(JSON.stringify({ ok, checkedAtUtc: new Date().toISOString(), results }));
  if (!ok) process.exitCode = 1;
} catch {
  process.stdout.write(JSON.stringify({ ok: false, reason: 'mailbox_check_failed' }));
  process.exitCode = 1;
} finally { clearTimeout(deadline); }
