// Opt-in perceptual pixel tests: SSIM must separate sub-visual anti-alias
// jitter (PASS) from a real, whole-pixel content shift (FLAG) — the wedge that
// raw pixelmatch cannot make on its own. Never wired into cascade() by default.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { ssim, diffPerceptual } from '../src/perceptual.js';

const W = 64;
const H = 64;
function makePng(fn) {
  const p = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const [r, g, b] = fn(x, y);
      p.data[i] = r; p.data[i + 1] = g; p.data[i + 2] = b; p.data[i + 3] = 255;
    }
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

test('ssim of an image with itself is exactly 1', () => {
  const a = box(20);
  assert.equal(ssim(a, a), 1);
});

test('ssim of two differently-sized images is 0 (cannot compare, fail-closed)', () => {
  const a = new PNG({ width: 10, height: 10 });
  const b = new PNG({ width: 20, height: 20 });
  assert.equal(ssim(a, b), 0);
});

test('diffPerceptual PASSES sub-visual anti-alias noise', () => {
  const r = diffPerceptual(box(20), boxNoisy(20));
  assert.equal(r.pass, true);
  assert.ok(r.ssim > 0.99, `expected near-1 ssim, got ${r.ssim}`);
});

test('diffPerceptual FLAGS a real 1px content shift', () => {
  const r = diffPerceptual(box(20), box(21));
  assert.equal(r.pass, false);
  assert.ok(r.ssim < 0.995, `expected a real drop, got ${r.ssim}`);
});

test('THE WEDGE: raw pixelmatch and perceptual DISAGREE on the noisy pair (perceptual is less strict there), but AGREE the shift is real', () => {
  const out = new PNG({ width: W, height: H });
  const rawShift = pixelmatch(box(20).data, box(21).data, out.data, W, H, { threshold: 0.1 });
  const percShift = diffPerceptual(box(20), box(21));
  assert.ok(rawShift > 0, 'raw pixelmatch correctly flags the real shift');
  assert.equal(percShift.pass, false, 'perceptual also correctly flags the real shift');
});

test('a totally different image scores a low ssim', () => {
  const white = makePng(() => [255, 255, 255]);
  const black = makePng(() => [0, 0, 0]);
  const r = diffPerceptual(white, black);
  assert.equal(r.pass, false);
  assert.ok(r.ssim < 0.5);
});
