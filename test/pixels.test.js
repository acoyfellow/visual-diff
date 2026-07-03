// Tier C tests — pixelmatch over the content bbox. Synthetic PNGs prove the
// identical/broken/dimension cases; the E01 pixel-diff receipt's recorded
// percentages are used to prove the flag-threshold decision matches.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { diffPixels, contentBBox, PIXEL_FLAG_PCT } from '../src/pixels.js';

const e01 = JSON.parse(readFileSync(new URL('./fixtures/e01-receipt.json', import.meta.url)));

// White canvas with an optional filled rect (near-black) drawn on it.
function canvas(w, h, rect) {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = png.data[i + 1] = png.data[i + 2] = 255;
    png.data[i + 3] = 255;
  }
  if (rect) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        const i = (y * w + x) * 4;
        png.data[i] = png.data[i + 1] = png.data[i + 2] = 0;
      }
    }
  }
  return png;
}

test('identical renders diff to 0% and PASS', () => {
  const a = canvas(64, 64, { x: 10, y: 10, w: 20, h: 20 });
  const b = canvas(64, 64, { x: 10, y: 10, w: 20, h: 20 });
  const r = diffPixels(a, b);
  assert.equal(r.pct, 0);
  assert.equal(r.pass, true);
});

test('a shifted/recolored block is flagged BROKEN (> threshold)', () => {
  const a = canvas(64, 64, { x: 10, y: 10, w: 20, h: 20 });
  const b = canvas(64, 64, { x: 20, y: 20, w: 20, h: 20 }); // moved
  const r = diffPixels(a, b);
  assert.ok(r.pct > PIXEL_FLAG_PCT, `expected >${PIXEL_FLAG_PCT}%, got ${r.pct}%`);
  assert.equal(r.pass, false);
});

test('dimension mismatch fails closed', () => {
  const r = diffPixels(canvas(64, 64), canvas(32, 32));
  assert.equal(r.pass, false);
  assert.equal(r.note, 'dimension mismatch');
});

test('contentBBox finds the non-white region', () => {
  const bbox = contentBBox([canvas(64, 64, { x: 10, y: 12, w: 8, h: 6 })], 64, 64, 0);
  assert.deepEqual({ x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h }, { x: 10, y: 12, w: 8, h: 6 });
});

test('E01 receipt: recorded percentages map to the correct verdicts', () => {
  const cases = [
    ['checkbox', e01.checkbox_diff_pct],
    ['switch', e01.switch_diff_pct],
    ['button', e01.button_diff_pct],
  ];
  for (const [name, pct] of cases) {
    const pass = pct <= PIXEL_FLAG_PCT;
    const expected = e01.verdict[name] === 'pass';
    assert.equal(pass, expected, `${name}: pct ${pct}% -> pass=${pass}, receipt says ${e01.verdict[name]}`);
  }
});
