// fidelity() tests: the continuous design<->implementation score. Verifies the
// two properties that justify shipping a NUMBER instead of a vanity percentage:
// it is monotonic as defects accumulate, and it explains itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fidelity } from '../src/fidelity.js';

const el = (tag, styles = {}) => ({ tag, role: null, styles });
const render = (tags, els) => ({
  tagHistogram: tags,
  control: { tags, descendantCount: Object.values(tags).reduce((a, b) => a + b, 0) },
  hasSvg: !!tags.svg,
  elements: els,
});

const fullTags = { div: 1, span: 1, svg: 1 };
const droppedTags = { div: 1, span: 1 };

const baseline = render(fullTags, [el('div', { paddingTop: '8px' }), el('span', { color: 'rgb(0, 0, 0)' }), el('svg')]);
const identical = render(fullTags, [el('div', { paddingTop: '8px' }), el('span', { color: 'rgb(0, 0, 0)' }), el('svg')]);
const styleOff = render(fullTags, [el('div', { paddingTop: '20px' }), el('span', { color: 'rgb(0, 0, 0)' }), el('svg')]);
const styleAndStructOff = render(droppedTags, [el('div', { paddingTop: '20px' }), el('span', { color: 'rgb(0, 0, 0)' })]);

test('a perfect match scores exactly 1 with no explanation', () => {
  const f = fidelity(baseline, identical);
  assert.equal(f.score, 1);
  assert.equal(f.explain, 'no defects');
});

test('score is MONOTONIC as defects accumulate (each step strictly lower)', () => {
  const f0 = fidelity(baseline, identical);
  const f1 = fidelity(baseline, styleOff);
  const f2 = fidelity(baseline, styleAndStructOff);
  assert.ok(f0.score > f1.score, `expected ${f0.score} > ${f1.score}`);
  assert.ok(f1.score > f2.score, `expected ${f1.score} > ${f2.score}`);
});

test('a style-only regression explains the style delta and leaves structure at 1', () => {
  const f = fidelity(baseline, styleOff);
  assert.equal(f.tiers.structure, 1);
  assert.ok(f.tiers.style < 1);
  assert.match(f.explain, /style -[\d.]+pp \(1 property delta\)/);
  assert.doesNotMatch(f.explain, /structure/);
});

test('a combined regression explains BOTH tiers with their own magnitudes', () => {
  const f = fidelity(baseline, styleAndStructOff);
  assert.ok(f.tiers.structure < 1);
  assert.ok(f.tiers.style < 1);
  assert.match(f.explain, /structure -[\d.]+pp \(1 missing, 0 extra\)/);
  assert.match(f.explain, /style -[\d.]+pp/);
});

test('score is bounded to [0,1] even under total mismatch', () => {
  const empty = render({}, []);
  const f = fidelity(baseline, empty);
  assert.ok(f.score >= 0 && f.score <= 1, `score out of bounds: ${f.score}`);
});

test('fidelity is a companion metric, not a gate: a <1 score does not imply cascade would pass or fail on its own', () => {
  // fidelity() never returns a boolean pass/fail — it is deliberately NOT a verdict.
  const f = fidelity(baseline, styleOff);
  assert.equal('pass' in f, false);
  assert.equal(typeof f.score, 'number');
});
