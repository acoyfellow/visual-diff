// cascade({perceptual:true}) tests: Tier C swaps engines cleanly, defaults
// unchanged, and the opt-in produces the exact separation diffPerceptual
// proved on its own (AA noise passes, a real shift fails).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { cascade } from '../src/cascade.js';

const good = { tagHistogram: { span: 1 }, control: { tags: { span: 1 }, descendantCount: 0 }, hasSvg: false, elements: [] };

const W = 64, H = 64;
function makePng(fn) {
  const p = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const [r, g, b] = fn(x, y);
    p.data[i] = r; p.data[i + 1] = g; p.data[i + 2] = b; p.data[i + 3] = 255;
  }
  return p;
}
const box = (bx) => makePng((x, y) => (x >= bx && x < bx + 20 && y >= 16 && y < 48) ? [40, 40, 40] : [255, 255, 255]);
const boxNoisy = (bx) => makePng((x, y) => {
  const inside = x >= bx && x < bx + 20 && y >= 16 && y < 48;
  const edge = x === bx || x === bx + 19 || y === 16 || y === 47;
  const jitter = edge ? ((x * 7 + y * 13) % 3) - 1 : 0;
  const v = Math.max(0, Math.min(255, (inside ? 40 : 255) + jitter));
  return [v, v, v];
});

test('default cascade() (no opts.perceptual) uses raw pixelmatch as before', () => {
  const r = cascade(good, good, { baselinePng: box(20), candidatePng: box(20) });
  assert.equal(r.tiers.C, true);
});

test('cascade({perceptual:true}) PASSES sub-visual anti-alias noise on Tier C', () => {
  const r = cascade(good, good, { baselinePng: box(20), candidatePng: boxNoisy(20), perceptual: true });
  assert.equal(r.tiers.C, true);
  assert.equal(r.pass, true);
});

test('cascade({perceptual:true}) still FLAGS a real 1px shift on Tier C', () => {
  const r = cascade(good, good, { baselinePng: box(20), candidatePng: box(21), perceptual: true });
  assert.equal(r.tiers.C, false);
  assert.equal(r.pass, false);
});

test('opts.pixels forwards to the perceptual metric as {minSsim}', () => {
  // A very lenient minSsim should PASS even the real shift.
  const r = cascade(good, good, { baselinePng: box(20), candidatePng: box(21), perceptual: true, pixels: { minSsim: 0.5 } });
  assert.equal(r.tiers.C, true);
});
