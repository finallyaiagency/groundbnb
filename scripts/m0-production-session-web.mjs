// Local client handoff only. Never log request bodies or inspect client inputs.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const worker = fileURLToPath(new URL('./verify-m0-production-session.mjs', import.meta.url));
const evidence = fileURLToPath(new URL('../.tmp/evidence/m0-production-session.json', import.meta.url));
const origin = 'http://127.0.0.1:4317';
const nonce = randomBytes(24).toString('base64url');
const revision = execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, '-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
let email = '';
let sentAt = null;
let sendAttempted = false;
let verifyAttempted = false;

function privateWorker(body) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [worker], { cwd: root, windowsHide: true,
      env: { ...process.env, M0_CLIENT_PRIVATE_PIPE: '1' }, stdio: ['pipe', 'pipe', 'ignore'] });
    let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Timeout')); }, 65000);
    child.on('error', () => { clearTimeout(timer); reject(new Error('Worker failed')); });
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.length > 4096) { child.kill(); reject(new Error('Output bound')); }
    });
    child.on('close', () => {
      clearTimeout(timer);
      try { resolve(JSON.parse(output)); } catch { reject(new Error('Worker failed')); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(body));
  });
}

const page = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Groundbnb private production check</title>
<style nonce="${nonce}">body{background:#111b22;color:#eef4f6;font:17px system-ui;margin:0;padding:48px 24px}main{max-width:580px;margin:auto}h1{font-size:28px}p{line-height:1.5;color:#bdccd4}label{display:block;margin-top:24px}input,button{box-sizing:border-box;width:100%;padding:14px;margin-top:10px;border-radius:8px;font:inherit}input{background:#20303b;color:white;border:1px solid #607985}button{background:#a1edcb;color:#0c2419;border:0;cursor:pointer}button:disabled{opacity:.5;cursor:default}#status{min-height:52px}</style>
<main><h1>Private production sign-in check</h1><p>Use the real email you added to Groundbnb’s <strong>production</strong> Auth account. This requests one sign-in code from Neon.</p>
<p>The check signs in to production, checks that preview/local reject that session, then signs this session out. Your email, code and session are not saved in the evidence or shown to Codex.</p>
<form id="form"><label for="email">Production account email</label><input id="email" type="email" autocomplete="off" spellcheck="false" required maxlength="254"><button id="send" type="button">Send one code</button>
<label for="otp">Code from your inbox</label><input id="otp" type="password" inputmode="numeric" autocomplete="off" maxlength="6" disabled><button id="verify" type="button" disabled>Verify and sign out</button></form>
<p id="status" role="status">Enter your email above. Keep the code out of chat.</p></main>
<script nonce="${nonce}">const email=document.getElementById('email'),otp=document.getElementById('otp'),send=document.getElementById('send'),verify=document.getElementById('verify'),status=document.getElementById('status');
document.getElementById('form').onsubmit=e=>e.preventDefault();
async function post(path,body){try{const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-M0-CSRF':'${nonce}'},body:JSON.stringify(body)});return await response.json()}catch{return {ok:false}}}
send.onclick=async()=>{if(!email.reportValidity())return;send.disabled=true;email.readOnly=true;status.textContent='Requesting one code…';const result=await post('/send-code',{email:email.value.trim()});if(result.ok){otp.disabled=false;verify.disabled=false;otp.focus();status.textContent='Check your inbox. Enter the code within five minutes.'}else{status.textContent='Code request failed or was already attempted. Reply failed; do not resend.'}};
verify.onclick=async()=>{if(!/^\\d{6}$/.test(otp.value)){status.textContent='Enter the six-digit code.';return}verify.disabled=true;status.textContent='Checking isolation and signing out…';const result=await post('/verify',{otp:otp.value});email.value='';otp.value='';otp.disabled=true;status.textContent=result.ok?'PASS. Session signed out. Reply done in Codex.':'Check failed. Reply failed in Codex; no secrets are needed.'};</script></html>`;

const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'`);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  const reply = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
  if (request.headers.host !== '127.0.0.1:4317') { reply(403, { ok: false }); return; }
  if (request.method === 'GET' && request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(page); return;
  }
  if (request.method !== 'POST' || !['/send-code', '/verify'].includes(request.url) ||
      request.headers.origin !== origin || request.headers['x-m0-csrf'] !== nonce ||
      request.headers['content-type'] !== 'application/json') { reply(403, { ok: false }); return; }
  try {
    let input = '';
    for await (const chunk of request) { input += chunk; if (input.length > 2048) throw new Error('Input bound'); }
    const body = JSON.parse(input); input = '';
    if (request.url === '/send-code') {
      if (sendAttempted || typeof body.email !== 'string' || body.email.length > 254 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || /(?:\.test|@ethereal\.email)$/i.test(body.email)) throw new Error('Invalid or already attempted');
      sendAttempted = true;
      await mkdir(new URL('../.tmp/evidence/', import.meta.url), { recursive: true });
      const marker = await open(evidence, 'wx');
      try { await marker.writeFile(JSON.stringify({ ok: false, phase: 'production_otp_attempted', revision, maxRealEmails: 1, checkedAtUtc: new Date().toISOString() })); }
      finally { await marker.close(); }
      email = body.email; sentAt = Date.now();
      let accepted = false;
      let sendRecord = { ok: false, revision, phase: 'production_otp_worker_failed',
        maxRealEmails: 1, deliveryConfirmed: null, checkedAtUtc: new Date().toISOString() };
      try {
        const result = await privateWorker({ mode: 'send', email });
        accepted = result.ok === true;
        sendRecord.phase = accepted ? 'production_otp_request_accepted' : 'production_otp_request_failed';
        sendRecord.sendAccepted = accepted;
        if (Number.isInteger(result.status)) sendRecord.status = result.status;
      } finally {
        sendRecord.checkedAtUtc = new Date().toISOString();
        await writeFile(evidence, JSON.stringify(sendRecord));
        if (!accepted) email = '';
      }
      reply(200, { ok: accepted });
    } else {
      if (!email || verifyAttempted || Date.now() - sentAt > 300000 || !/^\d{6}$/.test(body.otp ?? '')) throw new Error('Invalid or expired');
      verifyAttempted = true;
      let record;
      try {
        const result = await privateWorker({ mode: 'verify', email, otp: body.otp });
        record = { revision, checkedAtUtc: new Date().toISOString(), ok: result.ok === true && result.cleanupVerified === true,
          productionOwnSessionVerified: result.productionOwnSessionVerified === true,
          previewRejected: result.previewRejected === true, localRejected: result.localRejected === true,
          signOutVerified: result.cleanupVerified ?? null, maxRealEmails: 1 };
        if (/^[a-z_]+$/.test(result.phase ?? '')) record.phase = result.phase;
        if (Number.isInteger(result.status)) record.status = result.status;
      } catch { record = { ok: false, revision, phase: 'worker_failed', signOutVerified: null, checkedAtUtc: new Date().toISOString(), maxRealEmails: 1 }; }
      finally { email = ''; body.otp = ''; }
      await writeFile(evidence, JSON.stringify(record));
      reply(200, { ok: record.ok });
    }
  } catch { reply(400, { ok: false }); }
});
server.requestTimeout = 75000;
server.headersTimeout = 10000;
server.on('error', () => { process.stderr.write('Local handoff could not start.\n'); process.exitCode = 1; });
server.listen(4317, '127.0.0.1', () => process.stdout.write('Private local page ready: http://127.0.0.1:4317/\n'));
setTimeout(() => { email = ''; server.close(); server.closeAllConnections(); }, 30 * 60000).unref();
