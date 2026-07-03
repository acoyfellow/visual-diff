// The 3-tier cascade + the sanity-anchor pattern.
//
// PASS = A (structure equivalent) AND B (no significant style delta) AND
//        C (pixel diff under fuzz threshold).
//
// No single tier is honest alone: A is blind to style, B is blind to a
// correctly-styled-but-wrong tree, C is blind to WHY. The fail-closed AND of all
// three is the "1:1" verdict, mirroring the WPT-reftest blueprint.

import { diffStructure } from './structure.js';
import { diffStyle } from './style.js';
import { diffPixels } from './pixels.js';

/**
 * Run all three tiers on one baseline/candidate pair.
 *
 * @param {Object} baseline   normalized render (from extract.js)
 * @param {Object} candidate  normalized render
 * @param {{baselinePng?, candidatePng?, style?, pixels?}} [opts]
 *   PNGs are optional; when omitted Tier C is skipped (recorded as `null`) and
 *   the verdict is A AND B only. Pass PNGs to get the full 3-tier verdict.
 * @returns {{pass:boolean, A, B, C:(Object|null), tiers:{A:boolean,B:boolean,C:(boolean|null)}}}
 */
export function cascade(baseline, candidate, opts = {}) {
  const A = diffStructure(baseline, candidate);
  const B = diffStyle(baseline, candidate, opts.style);
  const C = (opts.baselinePng && opts.candidatePng)
    ? diffPixels(opts.baselinePng, opts.candidatePng, opts.pixels)
    : null;

  const cPass = C == null ? true : C.pass;
  const pass = A.pass && B.pass && cPass;

  return {
    pass,
    A, B, C,
    tiers: { A: A.pass, B: B.pass, C: C == null ? null : C.pass },
  };
}

/**
 * The sanity-anchor pattern: a fidelity gate you cannot trust unless it still
 * (a) PASSES a pair you KNOW is identical and (b) FLAGS a pair you KNOW is
 * broken. Run the cascade over labelled anchors and fail-closed if either
 * expectation is violated — this proves the harness itself is not rubber-stamping
 * (a positive control that always passes) nor over-strict (a negative control it
 * fails to catch).
 *
 * @param {Array<{name:string, expect:('pass'|'broken'), baseline, candidate,
 *   baselinePng?, candidatePng?}>} anchors
 * @param {Object} [opts] forwarded to cascade()
 * @returns {{ok:boolean, results:Array, violations:Array<string>}}
 */
export function sanityCheck(anchors, opts = {}) {
  const results = [];
  const violations = [];
  for (const a of anchors) {
    const r = cascade(a.baseline, a.candidate, {
      ...opts,
      baselinePng: a.baselinePng,
      candidatePng: a.candidatePng,
    });
    const verdict = r.pass ? 'pass' : 'broken';
    const held = verdict === a.expect;
    if (!held) {
      violations.push(`anchor "${a.name}" expected ${a.expect} but cascade said ${verdict}`);
    }
    results.push({ name: a.name, expect: a.expect, verdict, held, cascade: r });
  }
  return { ok: violations.length === 0, results, violations };
}
