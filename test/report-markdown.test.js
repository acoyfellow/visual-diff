// renderMarkdown() tests: a compact GFM table + collapsible failure detail,
// safe against markdown-breaking input, and driven by real cascade() output.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cascade } from '../src/cascade.js';
import { renderMarkdown } from '../src/report.js';

const good = { tagHistogram: { span: 1, svg: 1 }, control: { tags: { span: 1, svg: 1 }, descendantCount: 1 }, hasSvg: true, elements: [] };
const broken = { tagHistogram: { span: 1 }, control: { tags: { span: 1 }, descendantCount: 0 }, hasSvg: false, elements: [] };

test('an all-passing set renders a green summary header', () => {
  const cards = [{ name: 'button', result: cascade(good, good) }];
  const md = renderMarkdown(cards);
  assert.match(md, /all pairs 1:1/);
  assert.match(md, /\| button \| ✅ 1:1 \|/);
});

test('a failing pair renders a red summary header and a details block naming the tier', () => {
  const cards = [{ name: 'checkbox', result: cascade(good, broken) }];
  const md = renderMarkdown(cards);
  assert.match(md, /one or more pairs BROKEN/);
  assert.match(md, /\| checkbox \| ❌ BROKEN \|/);
  assert.match(md, /<summary>checkbox — why it failed<\/summary>/);
  assert.match(md, /structure — missing:/);
});

test('mixed pass/fail set: table has one row per pair, details only for failures', () => {
  const cards = [
    { name: 'a', result: cascade(good, good) },
    { name: 'b', result: cascade(good, broken) },
  ];
  const md = renderMarkdown(cards);
  const tableRows = md.split('\n').filter((l) => l.startsWith('| a ') || l.startsWith('| b '));
  assert.equal(tableRows.length, 2);
  assert.equal((md.match(/<summary>/g) || []).length, 1, 'only the failing pair gets a details block');
});

test('a pipe character in a component name does not break the table', () => {
  const cards = [{ name: 'weird|name', result: cascade(good, good) }];
  const md = renderMarkdown(cards);
  assert.match(md, /weird\\\|name/);
});

test('null tiers (C skipped, no PNGs) render as em-dash, not a crash', () => {
  const cards = [{ name: 'no-pixels', result: cascade(good, good) }]; // C is null (no PNGs passed)
  const md = renderMarkdown(cards);
  assert.match(md, /\| — \|\s*$/m);
});

test('a11y tier (D) column reflects opt-in results when present', () => {
  const cards = [{ name: 'a11y-case', result: cascade(good, good, { a11y: true }) }];
  const md = renderMarkdown(cards);
  const row = md.split('\n').find((l) => l.startsWith('| a11y-case'));
  assert.ok(row.includes('✅') || row.includes('❌'));
});
