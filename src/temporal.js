// Video / temporal diff: run the cascade over a SEQUENCE of renders (frames of
// an animation or transition) and pinpoint the FIRST frame where the tiers
// diverge, instead of only judging a single static pair.
//
// Frames are the same normalized render objects the pure tiers already
// consume — this is not a new capability substrate, it's cascade() applied
// frame-by-frame with a frame-count-mismatch treated as an immediate,
// fail-closed divergence (a dropped or extra frame IS a defect).

import { cascade } from './cascade.js';

/**
 * @param {Array<Object>} baseFrames   baseline renders, in order
 * @param {Array<Object>} candFrames   candidate renders, in order
 * @param {Object} [opts] forwarded to cascade() for every frame
 * @returns {{pass:boolean, firstDivergence:number, frames:Array}}
 *   firstDivergence is -1 when every frame passes.
 */
export function cascadeSequence(baseFrames, candFrames, opts = {}) {
  const n = Math.max(baseFrames.length, candFrames.length);
  const frames = [];
  let firstDivergence = -1;
  for (let i = 0; i < n; i++) {
    const b = baseFrames[i];
    const c = candFrames[i];
    if (!b || !c) {
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
