// Signed receipt tests: the sanity-anchor pattern applied to TRUST rather than
// pixels — a valid receipt MUST verify, and a receipt tampered with AFTER
// signing MUST fail verification, using the same secret.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signReceipt, verifyReceipt } from '../src/receipt.js';

const SECRET = 'a-test-signing-key-not-a-real-secret';
const passVerdict = { pass: true, tiers: { A: true, B: true, C: true } };
const failVerdict = { pass: false, tiers: { A: false, B: true, C: null } };

test('a freshly-signed receipt verifies with the same secret', () => {
  const r = signReceipt(passVerdict, SECRET, { at: '2026-07-02T00:00:00.000Z' });
  assert.equal(verifyReceipt(r, SECRET), true);
});

test('the receipt payload narrates the verdict correctly (1:1 vs BROKEN)', () => {
  const rPass = signReceipt(passVerdict, SECRET);
  const rFail = signReceipt(failVerdict, SECRET);
  assert.equal(rPass.payload.verdict, '1:1');
  assert.equal(rFail.payload.verdict, 'BROKEN');
});

test('TAMPER: flipping the verdict after signing fails verification', () => {
  const r = signReceipt(passVerdict, SECRET);
  const tampered = { ...r, payload: { ...r.payload, verdict: 'BROKEN' } };
  assert.equal(verifyReceipt(tampered, SECRET), false);
});

test('TAMPER: flipping a tier after signing fails verification', () => {
  const r = signReceipt(passVerdict, SECRET);
  const tampered = { ...r, payload: { ...r.payload, tiers: { ...r.payload.tiers, C: false } } };
  assert.equal(verifyReceipt(tampered, SECRET), false);
});

test('verifying with the WRONG secret fails', () => {
  const r = signReceipt(passVerdict, SECRET);
  assert.equal(verifyReceipt(r, 'a-different-key'), false);
});

test('two signings of the identical payload at the same timestamp produce the identical signature (canonical, deterministic)', () => {
  const a = signReceipt(passVerdict, SECRET, { at: 'fixed' });
  const b = signReceipt(passVerdict, SECRET, { at: 'fixed' });
  assert.equal(a.sig, b.sig);
});

test('key order in tiers does not affect the signature (canonical JSON)', () => {
  const r1 = signReceipt({ pass: true, tiers: { A: true, B: true, C: true } }, SECRET, { at: 'x' });
  const r2 = signReceipt({ pass: true, tiers: { C: true, A: true, B: true } }, SECRET, { at: 'x' });
  assert.equal(r1.sig, r2.sig);
});

test('a malformed receipt (missing sig) fails verification instead of throwing', () => {
  const r = signReceipt(passVerdict, SECRET);
  assert.equal(verifyReceipt({ payload: r.payload }, SECRET), false);
});
