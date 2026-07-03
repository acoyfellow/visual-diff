// Tier A tests — cross-checked against the REAL E03 dom-structure-diff receipt
// that this cascade was extracted from. The receipt records, per component, the
// control-subtree tag multisets and whether the pair was structurally
// equivalent; we rebuild render structs from it and assert diffStructure agrees.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { multisetDiff, diffStructure } from '../src/structure.js';

const e03 = JSON.parse(readFileSync(new URL('./fixtures/e03-receipt.json', import.meta.url)));

// Rebuild the two render structs for a receipt component. We reconstruct the
// whole-tree histograms from the receipt's recorded wholeTree diff so that our
// gate sees exactly the missing/extra elements the experiment observed.
function structsFrom(pc) {
  const cs = pc.controlSubtree;
  const wholeMissing = pc.wholeTree.missingInNative || {};
  const wholeExtra = pc.wholeTree.extraInNative || {};
  const baseline = {
    tagHistogram: wholeMissing,           // elements baseline has that candidate lacks
    control: { tags: cs.react.tags || {}, descendantCount: cs.react.descendantCount },
    hasSvg: !!(cs.react.tags && cs.react.tags.svg) || !!wholeMissing.svg,
  };
  const candidate = {
    tagHistogram: wholeExtra,             // elements candidate has that baseline lacks
    control: { tags: cs.native.tags || {}, descendantCount: cs.native.descendantCount },
    hasSvg: !!(cs.native.tags && cs.native.tags.svg),
  };
  return { baseline, candidate };
}

test('multisetDiff reports missing and extra correctly', () => {
  const { missing, extra } = multisetDiff({ span: 1, svg: 1, path: 1 }, { span: 1 });
  assert.deepEqual(missing, { svg: 1, path: 1 });
  assert.deepEqual(extra, {});
});

test('E03 receipt: verdicts match diffStructure for every component', () => {
  for (const pc of e03.perComponent) {
    const { baseline, candidate } = structsFrom(pc);
    const r = diffStructure(baseline, candidate);
    assert.equal(
      r.pass, pc.structurallyEquivalent,
      `${pc.name}: expected structurallyEquivalent=${pc.structurallyEquivalent}, got pass=${r.pass}`,
    );
  }
});

test('E03 checkbox: missing checkmark <svg> is caught (fail-closed)', () => {
  const pc = e03.perComponent.find((p) => p.name === 'checkbox');
  const { baseline, candidate } = structsFrom(pc);
  const r = diffStructure(baseline, candidate);
  assert.equal(r.pass, false);
  assert.equal(r.missingSvg, true);
  assert.deepEqual(r.control.missingInCandidate, { span: 1, svg: 1, path: 1 });
});

test('E03 button: known-good pair passes (no false positive)', () => {
  const pc = e03.perComponent.find((p) => p.name === 'button');
  const { baseline, candidate } = structsFrom(pc);
  const r = diffStructure(baseline, candidate);
  assert.equal(r.pass, true);
  assert.equal(r.missingSvg, false);
  assert.deepEqual(r.control.missingInCandidate, {});
});

test('E03 switch: missing thumb <div> is caught', () => {
  const pc = e03.perComponent.find((p) => p.name === 'switch');
  const { baseline, candidate } = structsFrom(pc);
  const r = diffStructure(baseline, candidate);
  assert.equal(r.pass, false);
  assert.deepEqual(r.control.missingInCandidate, { div: 1 });
});
