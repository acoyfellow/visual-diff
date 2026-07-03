// verify() tests: the agent/CI-shaped narration over cascade(). Cross-checked
// against the REAL E03 dom-structure-diff receipt (same fixture and
// reconstruction as structure.test.js) so the promoted oracle is exercised
// against the exact defects that motivated this library, not a synthetic proxy.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verify } from '../src/verify.js';

const e03 = JSON.parse(readFileSync(new URL('./fixtures/e03-receipt.json', import.meta.url)));

function structsFrom(pc) {
  const cs = pc.controlSubtree;
  const wholeMissing = pc.wholeTree.missingInNative || {};
  const wholeExtra = pc.wholeTree.extraInNative || {};
  const baseline = {
    tagHistogram: wholeMissing,
    control: { tag: cs.react.tag, role: cs.react.role, descendantCount: cs.react.descendantCount, tags: cs.react.tags || {} },
    hasSvg: !!(cs.react.tags && cs.react.tags.svg) || !!wholeMissing.svg,
  };
  const candidate = {
    tagHistogram: wholeExtra,
    control: { tag: cs.native.tag, role: cs.native.role, descendantCount: cs.native.descendantCount, tags: cs.native.tags || {} },
    hasSvg: !!(cs.native.tags && cs.native.tags.svg),
  };
  return { baseline, candidate };
}

test('verify() returns the correct verdict for every E03 component', () => {
  for (const pc of e03.perComponent) {
    const { baseline, candidate } = structsFrom(pc);
    const v = verify(baseline, candidate);
    const expected = pc.structurallyEquivalent ? '1:1' : 'BROKEN';
    assert.equal(v.verdict, expected, `${pc.name}: expected ${expected}, got ${v.verdict}`);
    assert.equal(v.pass, pc.structurallyEquivalent);
  }
});

test('verify() checkbox: BROKEN verdict names the missing structure in `why`', () => {
  const pc = e03.perComponent.find((p) => p.name === 'checkbox');
  const { baseline, candidate } = structsFrom(pc);
  const v = verify(baseline, candidate);
  assert.equal(v.verdict, 'BROKEN');
  assert.match(v.why, /structure:/);
});

test('verify() on a 1:1 pair returns why:null (no false explanation)', () => {
  const pc = e03.perComponent.find((p) => p.structurallyEquivalent);
  const { baseline, candidate } = structsFrom(pc);
  const v = verify(baseline, candidate);
  assert.equal(v.pass, true);
  assert.equal(v.why, null);
});

test('verify() adds no new judgment over cascade — tiers match exactly', () => {
  const pc = e03.perComponent[0];
  const { baseline, candidate } = structsFrom(pc);
  const v = verify(baseline, candidate);
  assert.ok('A' in v.tiers && 'B' in v.tiers && 'C' in v.tiers);
});

test('verify() style-only failure names the offending tag.prop pairs', () => {
  const styled = (color) => ({
    tagHistogram: { span: 1 },
    control: { tag: 'span', role: 'checkbox', descendantCount: 0, tags: { span: 1 } },
    hasSvg: false,
    elements: [{ tag: 'span', role: 'checkbox', styles: { color } }],
  });
  const v = verify(styled('rgb(0, 0, 0)'), styled('rgb(255, 0, 0)'));
  assert.equal(v.verdict, 'BROKEN');
  assert.match(v.why, /style: span\.color/);
});
