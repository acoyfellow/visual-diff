// Cascade + sanity-anchor tests. Verifies the fail-closed AND of the three tiers
// and that sanityCheck refuses to trust a gate whose anchors don't hold.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { cascade, sanityCheck } from '../src/cascade.js';

const styles = { width: '16px', height: '16px', color: 'rgb(0, 0, 0)' };
function render({ control, extra = {} }) {
  const elements = [{ tag: 'span', role: 'checkbox', styles: { ...styles, ...extra } }];
  return {
    tagHistogram: { span: 1, ...(control.tags.svg ? { svg: 1, path: 1 } : {}) },
    control: { tag: 'span', role: 'checkbox', descendantCount: 0, tags: control.tags },
    hasSvg: !!control.tags.svg,
    elements,
  };
}
function canvas(w, h, black) {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < png.data.length; i += 4) {
    const on = black ? 0 : 255;
    png.data[i] = png.data[i + 1] = png.data[i + 2] = on;
    png.data[i + 3] = 255;
  }
  return png;
}

const good = render({ control: { tags: { span: 1, svg: 1, path: 1 } } });
const goodCopy = render({ control: { tags: { span: 1, svg: 1, path: 1 } } });
const missingSvg = render({ control: { tags: {} } });        // structural defect
const restyled = render({ control: { tags: { span: 1, svg: 1, path: 1 } }, extra: { color: 'rgb(255, 0, 0)' } });

const whitePng = canvas(32, 32, false);
const blackPng = canvas(32, 32, true);

test('cascade PASSES an identical pair (all tiers agree)', () => {
  const r = cascade(good, goodCopy, { baselinePng: whitePng, candidatePng: whitePng });
  assert.equal(r.pass, true);
  assert.deepEqual(r.tiers, { A: true, B: true, C: true });
});

test('cascade FAILS on a structural defect even if style/pixels are close', () => {
  const r = cascade(good, missingSvg);
  assert.equal(r.pass, false);
  assert.equal(r.tiers.A, false);
});

test('cascade FAILS on a style-only defect (structure equal)', () => {
  const r = cascade(good, restyled);
  assert.equal(r.tiers.A, true);
  assert.equal(r.tiers.B, false);
  assert.equal(r.pass, false);
});

test('cascade FAILS on a pixel-only defect (structure + style equal)', () => {
  const r = cascade(good, goodCopy, { baselinePng: whitePng, candidatePng: blackPng });
  assert.equal(r.tiers.A, true);
  assert.equal(r.tiers.B, true);
  assert.equal(r.tiers.C, false);
  assert.equal(r.pass, false);
});

test('Tier C is skipped (null) when no PNGs are provided', () => {
  const r = cascade(good, goodCopy);
  assert.equal(r.C, null);
  assert.equal(r.tiers.C, null);
  assert.equal(r.pass, true);
});

test('sanityCheck is OK when anchors hold', () => {
  const { ok, violations } = sanityCheck([
    { name: 'identical', expect: 'pass', baseline: good, candidate: goodCopy, baselinePng: whitePng, candidatePng: whitePng },
    { name: 'broken', expect: 'broken', baseline: good, candidate: missingSvg },
  ]);
  assert.equal(ok, true);
  assert.deepEqual(violations, []);
});

test('sanityCheck fails closed when the gate rubber-stamps a broken pair', () => {
  // Claim the known-broken pair should pass -> the gate would be untrustworthy.
  const { ok, violations } = sanityCheck([
    { name: 'wrongly-expected-pass', expect: 'pass', baseline: good, candidate: missingSvg },
  ]);
  assert.equal(ok, false);
  assert.equal(violations.length, 1);
});
