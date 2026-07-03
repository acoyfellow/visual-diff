// Tier D (semantic/a11y) tests. Proves it catches a class of defect A/B/C
// cannot see, joins cascade() only when opted in, and never changes the
// default 3-tier contract for existing callers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffA11y } from '../src/a11y.js';
import { cascade } from '../src/cascade.js';

const el = (tag, role, attrs = {}) => ({ tag, role, attrs, styles: {} });
const render = (elements) => ({
  tagHistogram: { span: 1 },
  control: { tags: { span: 1 }, descendantCount: 0 },
  hasSvg: false,
  elements,
});

const checked = render([el('span', 'checkbox', { role: 'checkbox', 'aria-checked': 'true' })]);
const checkedCopy = render([el('span', 'checkbox', { role: 'checkbox', 'aria-checked': 'true' })]);
const brokenChecked = render([el('span', 'checkbox', { role: 'checkbox', 'aria-checked': 'false' })]);

test('diffA11y PASSES an a11y-equivalent pair', () => {
  const r = diffA11y(checked, checkedCopy);
  assert.equal(r.pass, true);
});

test('diffA11y FLAGS an aria-checked regression, naming missing/extra signatures', () => {
  const r = diffA11y(checked, brokenChecked);
  assert.equal(r.pass, false);
  assert.deepEqual(r.missing, { 'checkbox|role=checkbox|aria-checked=true': 1 });
  assert.deepEqual(r.extra, { 'checkbox|role=checkbox|aria-checked=false': 1 });
});

test('cascade() default (no opts.a11y) never includes D — the 3-tier contract is unchanged', () => {
  const r = cascade(checked, checkedCopy);
  assert.equal('D' in r.tiers, false);
  assert.equal(r.pass, true);
});

test('cascade({a11y:true}) catches an a11y regression that structure+style MISS (same tag, same style)', () => {
  const r = cascade(checked, brokenChecked, { a11y: true });
  assert.equal(r.A.pass, true, 'structure agrees (same tags)');
  assert.equal(r.B.pass, true, 'style agrees (no style set)');
  assert.equal(r.tiers.D, false, 'a11y tier catches what A and B cannot');
  assert.equal(r.pass, false, 'the overall verdict is fail-closed on D too');
});

test('cascade({a11y:true}) still PASSES when a11y is genuinely equivalent', () => {
  const r = cascade(checked, checkedCopy, { a11y: true });
  assert.equal(r.tiers.D, true);
  assert.equal(r.pass, true);
});
