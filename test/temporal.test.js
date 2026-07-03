// cascadeSequence() tests: an identical animation passes every frame; a
// transition that breaks mid-way is flagged at the EXACT frame it diverged,
// and a dropped/extra frame is treated as an immediate divergence.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cascadeSequence } from '../src/temporal.js';

const frame = (childCount) => ({
  tagHistogram: { div: 1, span: childCount },
  control: { tag: 'div', role: 'group', descendantCount: childCount, tags: { span: childCount } },
  hasSvg: false,
  elements: [],
});

test('an identical frame sequence PASSES every frame', () => {
  const seq = [frame(1), frame(2), frame(3), frame(4)];
  const copy = seq.map((f) => ({ ...f, control: { ...f.control }, tagHistogram: { ...f.tagHistogram } }));
  const r = cascadeSequence(seq, copy);
  assert.equal(r.pass, true);
  assert.equal(r.firstDivergence, -1);
  assert.ok(r.frames.every((f) => f.pass));
});

test('a transition that breaks mid-way is flagged at the EXACT divergent frame', () => {
  const baseline = [frame(1), frame(2), frame(3), frame(4)]; // healthy expand
  const broken = [frame(1), frame(1) /* should have grown to 2 */, frame(3), frame(4)];
  const r = cascadeSequence(baseline, broken);
  assert.equal(r.pass, false);
  assert.equal(r.firstDivergence, 1);
  assert.equal(r.frames[0].pass, true, 'frame 0 still matches');
  assert.equal(r.frames[1].pass, false, 'frame 1 is where it broke');
});

test('a dropped frame (candidate shorter) is an immediate fail-closed divergence', () => {
  const baseline = [frame(1), frame(2), frame(3)];
  const droppedLast = [frame(1), frame(2)];
  const r = cascadeSequence(baseline, droppedLast);
  assert.equal(r.pass, false);
  assert.equal(r.firstDivergence, 2);
  assert.equal(r.frames[2].reason, 'frame-count-mismatch');
});

test('an extra frame (candidate longer) is also an immediate fail-closed divergence', () => {
  const baseline = [frame(1), frame(2)];
  const extraFrame = [frame(1), frame(2), frame(3)];
  const r = cascadeSequence(baseline, extraFrame);
  assert.equal(r.pass, false);
  assert.equal(r.firstDivergence, 2);
});

test('an empty sequence pair trivially passes (nothing to diverge on)', () => {
  const r = cascadeSequence([], []);
  assert.equal(r.pass, true);
  assert.deepEqual(r.frames, []);
});
