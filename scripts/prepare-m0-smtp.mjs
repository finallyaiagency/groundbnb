// Private child of m0-smtp.ps1. stdout contains credentials and must remain piped.
if (process.env.M0_PRIVATE_PIPE !== '1') {
  process.stdout.write(JSON.stringify({ ok: false, reason: 'private_wrapper_required' }));
  process.exit(1);
}

process.env.ETHEREAL_CACHE = 'no';
delete process.env.ETHEREAL_API_KEY;
delete process.env.ETHEREAL_API;
const deadline = setTimeout(() => process.exit(1), 45000);
try {
  const { default: nodemailer } = await import('nodemailer');
  const accounts = [];
  for (const kind of ['preview', 'local']) {
    const account = await nodemailer.createTestAccount('https://api.nodemailer.com');
    if (account.smtp?.host !== 'smtp.ethereal.email' || account.smtp.port !== 587 ||
        account.smtp.secure !== false || account.mxEnabled !== false ||
        !account.user?.endsWith('@ethereal.email') || !account.pass ||
        accounts.some(previous => previous.user === account.user)) throw new Error('Unexpected capture account');
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email', port: 587, secure: false, requireTLS: true,
      tls: { rejectUnauthorized: true }, logger: false, debug: false,
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000,
      auth: { user: account.user, pass: account.pass },
    });
    try {
      const recipient = `${kind}-01@example.test`;
      const result = await transporter.sendMail({
        from: `Groundbnb ${kind} <${account.user}>`, to: recipient,
        subject: `Groundbnb M0 ${kind} capture check`,
        text: 'Synthetic SMTP capture check. No customer information or authentication tokens.',
      });
      if (!result.accepted.includes(recipient) || result.rejected.length) throw new Error('Capture refused');
      accounts.push({ kind, user: account.user, pass: account.pass,
        host: 'smtp.ethereal.email', port: 587, senderName: `Groundbnb ${kind}`,
        senderEmail: account.user, checkedAtUtc: new Date().toISOString(),
        checks: 'distinct_capture_account_tls_synthetic_smtp_accepted' });
    } finally { transporter.close(); }
  }
  process.stdout.write(JSON.stringify({ ok: true, accounts }));
} catch {
  process.stdout.write(JSON.stringify({ ok: false, reason: 'capture_setup_failed' }));
  process.exitCode = 1;
} finally { clearTimeout(deadline); }
