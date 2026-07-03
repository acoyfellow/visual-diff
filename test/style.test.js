// Tier B tests — LCS alignment + significant computed-style deltas. A real
// style value pair from the E02 computed-style-diff receipt is used to prove a
// genuine padding/size difference is flagged while sub-pixel noise is not.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { diffStyle, alignLCS, numClose } from '../src/style.js';

const e02 = JSON.parse(readFileSync(new URL('./fixtures/e02-receipt.json', import.meta.url)));

const el = (tag, role, styles) => ({ tag, role, styles });
const base = { width: '16px', height: '16px', paddingLeft: '8px', color: 'rgb(0, 0, 0)' };

test('numClose tolerates sub-pixel rounding but not real deltas', () => {
  assert.equal(numClose('16px', '16.4px'), true);
  assert.equal(numClose('16px', '20px'), false);
  assert.equal(numClose('rgb(0,0,0)', 'rgb(255,0,0)'), false);
});

test('identical element lists produce no deltas (PASS)', () => {
  const a = { elements: [el('span', 'checkbox', { ...base })] };
  const b = { elements: [el('span', 'checkbox', { ...base })] };
  const r = diffStyle(a, b);
  assert.equal(r.pass, true);
  assert.deepEqual(r.deltas, []);
});

test('a padding/color delta is flagged with the exact property named', () => {
  const a = { elements: [el('span', 'checkbox', { ...base })] };
  const b = { elements: [el('span', 'checkbox', { ...base, paddingLeft: '0px', color: 'rgb(255, 0, 0)' })] };
  const r = diffStyle(a, b);
  assert.equal(r.pass, false);
  const props = r.deltas.map((d) => d.prop).sort();
  assert.deepEqual(props, ['color', 'paddingLeft']);
  const pad = r.deltas.find((d) => d.prop === 'paddingLeft');
  assert.equal(pad.baseline, '8px');
  assert.equal(pad.candidate, '0px');
});

test('alignLCS pairs only structurally-corresponding elements', () => {
  const a = [el('div', null, {}), el('span', 'checkbox', {}), el('svg', '(graphic)', {})];
  const b = [el('div', null, {}), el('span', 'checkbox', {})]; // svg dropped
  const pairs = alignLCS(a, b);
  assert.equal(pairs.length, 2);
  assert.equal(pairs[1][0].role, 'checkbox');
});

test('E02 receipt: a real width value from the missing checkbox wrapper is a delta', () => {
  // The E02 receipt records the checkbox wrapper the native output is missing,
  // with width "69.4219px". Compared against a native "0px" that is a real,
  // flaggable delta (well beyond sub-pixel tolerance).
  const first = e02.per_component.checkbox.missing_in_native[0];
  const realWidth = first.styles.width; // "69.4219px"
  assert.equal(numClose(realWidth, '0px'), false);
  const a = { elements: [el('div', null, { width: realWidth })] };
  const b = { elements: [el('div', null, { width: '0px' })] };
  assert.equal(diffStyle(a, b).pass, false);
});
