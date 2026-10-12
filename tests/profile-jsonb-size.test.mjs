import assert from 'node:assert/strict';
import test from 'node:test';
import { profileJsonbByteLength } from '../lib/profile-jsonb-size.mjs';

test('counts PostgreSQL JSONB separators, keys, and nested containers', () => {
  assert.equal(profileJsonbByteLength({a: 1, bb: [true, null]}), 28);
  assert.equal(profileJsonbByteLength([]), 2);
  assert.equal(profileJsonbByteLength({}), 2);
  assert.equal(profileJsonbByteLength([1, 2]), 6);
});

test('counts UTF-8 multibyte values and JSONB string escapes', () => {
  assert.equal(profileJsonbByteLength('é'), 4);
  assert.equal(profileJsonbByteLength('😀'), 6);
  assert.equal(profileJsonbByteLength('"\\'), 6);
  assert.equal(profileJsonbByteLength('\n\u0001'), 10);
  assert.equal(profileJsonbByteLength({['é']: '漢'}), 13);
});

test('expands scientific notation to decimal JSONB text without undercounting', () => {
  assert.equal(profileJsonbByteLength(1e21), 22);
  assert.equal(profileJsonbByteLength(1e-7), 9);
  assert.equal(profileJsonbByteLength(-1.25e-5), 10);
  assert.equal(profileJsonbByteLength(-0), 1);
  assert.equal(profileJsonbByteLength(Number.MAX_VALUE), 309);
});

test('rejects JSONB-incompatible strings, numbers, and object structures', () => {
  for (const value of ['\u0000', '\ud800', '\udfff', NaN, Infinity, -Infinity, undefined, 1n,
    [undefined], new Date(), (() => { const row = {}; row.self = row; return row; })()]) {
    assert.throws(() => profileJsonbByteLength(value), TypeError);
  }
});

test('rejects sparse arrays and accessors rather than estimating an altered JSON value', () => {
  const sparse = [];
  sparse.length = 1;
  const getter = {};
  Object.defineProperty(getter, 'x', { enumerable: true, get() { throw new Error('must not execute'); } });
  assert.throws(() => profileJsonbByteLength(sparse), TypeError);
  assert.throws(() => profileJsonbByteLength(getter), TypeError);
});
