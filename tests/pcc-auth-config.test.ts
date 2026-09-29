import assert from 'node:assert/strict';
import test from 'node:test';
import { previewAuthConfig } from '../lib/pcc-auth-config.ts';

const host = 'ep-example.neonauth.c-14.us-east-1.aws.neon.tech';
const url = `https://${host}/groundbnb/auth`;
const secret = 'x'.repeat(32);

test('PCC Auth accepts only the named Neon preview target', () => {
  const preview = 'preview/control-center';
  assert.equal(previewAuthConfig(url, host, secret, 'preview', preview).baseUrl, url);
  assert.throws(() => previewAuthConfig(url, host, secret, 'production', preview));
  assert.throws(() => previewAuthConfig(url, host, secret, 'preview', 'main'));
  assert.throws(() => previewAuthConfig(url, host, secret, undefined, preview));
  assert.throws(() => previewAuthConfig(url.replace('/groundbnb/', '/neondb/'), host, secret, 'preview', preview));
  assert.throws(() => previewAuthConfig(url, 'other.neonauth.c-14.us-east-1.aws.neon.tech', secret, 'preview', preview));
  assert.throws(() => previewAuthConfig(url, host, 'short', 'preview', preview));
  assert.throws(() => previewAuthConfig(url + '?key=leak', host, secret, 'preview', preview));
});
