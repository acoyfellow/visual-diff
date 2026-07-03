// Badge formatter tests: pure formatting over fidelity()/verify() results,
// matching the shields.io endpoint-badge schema.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgeFromFidelity, badgeFromVerify } from '../src/badge.js';

test('a perfect fidelity score badges brightgreen at 100%', () => {
  const b = badgeFromFidelity({ score: 1 });
  assert.equal(b.schemaVersion, 1);
  assert.equal(b.message, '100%');
  assert.equal(b.color, 'brightgreen');
});

test('fidelity color thresholds step down correctly', () => {
  assert.equal(badgeFromFidelity({ score: 0.97 }).color, 'green');
  assert.equal(badgeFromFidelity({ score: 0.9 }).color, 'yellowgreen');
  assert.equal(badgeFromFidelity({ score: 0.75 }).color, 'yellow');
  assert.equal(badgeFromFidelity({ score: 0.6 }).color, 'orange');
  assert.equal(badgeFromFidelity({ score: 0.2 }).color, 'red');
});

test('fidelity badge message is a rounded percentage', () => {
  const b = badgeFromFidelity({ score: 0.8333 });
  assert.equal(b.message, '83.3%');
});

test('label is overridable', () => {
  const b = badgeFromFidelity({ score: 1 }, { label: 'my-fidelity' });
  assert.equal(b.label, 'my-fidelity');
});

test('badgeFromVerify: PASS is brightgreen "1:1"', () => {
  const b = badgeFromVerify({ pass: true });
  assert.equal(b.message, '1:1');
  assert.equal(b.color, 'brightgreen');
});

test('badgeFromVerify: BROKEN is red "broken"', () => {
  const b = badgeFromVerify({ pass: false });
  assert.equal(b.message, 'broken');
  assert.equal(b.color, 'red');
});

test('every badge is valid shields.io endpoint JSON (schemaVersion 1, label+message+color strings)', () => {
  for (const b of [badgeFromFidelity({ score: 0.5 }), badgeFromVerify({ pass: true })]) {
    assert.equal(b.schemaVersion, 1);
    assert.equal(typeof b.label, 'string');
    assert.equal(typeof b.message, 'string');
    assert.equal(typeof b.color, 'string');
  }
});
