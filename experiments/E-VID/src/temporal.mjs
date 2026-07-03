// E-VID spike: video/temporal diff. Extend the cascade to a SEQUENCE of renders
// and flag the FIRST frame where the tiers diverge. KEEP IF a real anim-
// regression (a transition that breaks mid-way) is caught at the right frame AND
// a matching animation passes; pure, deterministic. Sanity-anchored both ways.
import { fileURLToPath } from 'node:url';
import { cascade } from '../../../src/index.js';

// cascadeSequence: baseline frames vs candidate frames -> first divergent frame.
// Frames are normalized render objects (same shape the pure tiers consume).
export function cascadeSequence(baseFrames, candFrames, opts = {}) {
  const n = Math.max(baseFrames.length, candFrames.length);
  const frames = [];
  let firstDivergence = -1;
  for (let i = 0; i < n; i++) {
    const b = baseFrames[i], c = candFrames[i];
    if (!b || !c) { // length mismatch = a dropped/extra frame = divergence
      frames.push({ frame: i, pass: false, reason: 'frame-count-mismatch' });
      if (firstDivergence < 0) firstDivergence = i;
      continue;
    }
    const r = cascade(b, c, opts);
    frames.push({ frame: i, pass: r.pass, tiers: r.tiers });
    if (!r.pass && firstDivergence < 0) firstDivergence = i;
  }
  return { pass: firstDivergence < 0, firstDivergence, frames };
}

// A tiny synthetic animation: a control whose child count grows over 4 frames
// (an expanding disclosure). Frame renders are minimal normalized structs.
const frame = (childCount, extra = {}) => ({
  tagHistogram: { div: 1, span: childCount, ...(extra.tagHistogram || {}) },
  control: { tag: 'div', role: 'group', descendantCount: childCount, tags: { span: childCount } },
  hasSvg: false,
  elements: [],
});

function main() {
  const baseline = [frame(1), frame(2), frame(3), frame(4)]; // healthy expand

  // ANCHOR 1 (must PASS): identical animation.
  const identical = baseline.map(f => ({ ...f, control: { ...f.control }, tagHistogram: { ...f.tagHistogram } }));
  const passRun = cascadeSequence(baseline, identical);

  // ANCHOR 2 (must be FLAGGED at the exact divergent frame): the transition breaks
  // at frame index 1 — baseline[1] has 2 spans, the broken candidate still has 1
  // (a span failed to appear mid-animation, the exact "element gone" class). The
  // divergence is therefore at frame 1, and the tier must pinpoint it.
  const broken = [frame(1), frame(1)/*<- should have grown to 2*/, frame(3), frame(4)];
  const brokenRun = cascadeSequence(baseline, broken);

  const anchorsHeld = passRun.pass === true
    && brokenRun.pass === false
    && brokenRun.firstDivergence === 1;   // pinpoints the exact frame the anim broke

  const receipt = {
    experiment: 'E-VID',
    criterion: 'identical anim PASSES; broken transition FLAGGED at the exact divergent frame (index 1)',
    identical: { pass: passRun.pass },
    broken: { pass: brokenRun.pass, firstDivergence: brokenRun.firstDivergence },
    anchorsHeld,
  };
  console.log(JSON.stringify(receipt, null, 2));
  return anchorsHeld;
}
if (import.meta.url === `file://${process.argv[1]}`) process.exit(main() ? 0 : 1);
