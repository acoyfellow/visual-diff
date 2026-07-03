// Producer-agnosticism CONTRACT test. cascade() must accept a normalized
// render object from ANY producer — not just the built-in browser extractor.
// This test feeds a deliberately naive, zero-Chromium HTML walker (its own
// tiny producer) into the exact same cascade() the browser path uses, and
// asserts a correct verdict. If this ever fails, something coupled the engine
// to a specific producer's internals — the contract broke.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cascade } from '../src/cascade.js';

// A minimal, independent producer: a regex HTML walker with NO browser
// dependency. Deliberately naive — it exists to prove the CONTRACT is
// satisfiable by any producer, not to replace src/extract.js.
function produce(html) {
  const tagRe = /<(\w+)([^>]*)\/?>/g;
  const elements = [];
  const tagHistogram = {};
  let m;
  while ((m = tagRe.exec(html))) {
    const tag = m[1].toLowerCase();
    if (tag === 'html' || tag === 'body' || tag === 'head') continue;
    const roleM = /role="([^"]+)"/.exec(m[2]);
    const role = roleM ? roleM[1] : null;
    elements.push({ tag, role, attrs: role ? { role } : {} });
    tagHistogram[tag] = (tagHistogram[tag] || 0) + 1;
  }
  const control = elements.find((e) => e.role === 'checkbox') || elements[0] || { tag: 'div' };
  return {
    tagHistogram,
    control: { tag: control.tag, role: control.role, descendantCount: elements.length - 1, tags: tagHistogram },
    hasSvg: !!tagHistogram.svg,
    elements,
  };
}

test('a second, non-browser producer feeds cascade() and PASSES on an identical pair', () => {
  const html = '<span role="checkbox"><svg><path/></svg></span>';
  const r = cascade(produce(html), produce(html));
  assert.equal(r.pass, true);
});

test('a second, non-browser producer feeds cascade() and is FLAGGED on a real defect (dropped svg+path)', () => {
  const good = '<span role="checkbox"><svg><path/></svg></span>';
  const broken = '<span role="checkbox"></span>';
  const r = cascade(produce(good), produce(broken));
  assert.equal(r.pass, false);
  assert.deepEqual(r.A.control.missingInCandidate, { svg: 1, path: 1 });
});
