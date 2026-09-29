import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePccDatabaseTarget } from '../lib/pcc-config.ts';

const host = 'ep-example.us-east-2.aws.neon.tech';
const url = `postgresql://test:secret@${host}/groundbnb?sslmode=require`;

test('PCC store accepts only the named Neon database and expected host in preview', () => {
  assert.equal(validatePccDatabaseTarget(url, host, 'preview'), url);
  assert.throws(() => validatePccDatabaseTarget(url, host, 'production'));
  assert.throws(() => validatePccDatabaseTarget(url, 'another.neon.tech', 'preview'));
  assert.throws(() => validatePccDatabaseTarget(url.replace('/groundbnb', '/neondb'), host, 'preview'));
  assert.throws(() => validatePccDatabaseTarget(url.replace('sslmode=require', 'sslmode=disable'), host, 'preview'));
  assert.throws(() => validatePccDatabaseTarget(undefined, host, 'preview'));
});
