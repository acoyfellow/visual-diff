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
import { diffA11y } from './a11y.js';
import { diffPerceptual } from './perceptual.js';

/**
 * Run the tiers on one baseline/candidate pair. A and B always run; C runs
 * when PNGs are supplied (raw pixelmatch by default, or perceptual SSIM when
 * `opts.perceptual` is set); D (semantic/a11y) is OPT-IN via `opts.a11y` and is
 * omitted from `tiers`/the verdict entirely unless requested — the default
 * 3-tier contract is unchanged for every existing caller.
 *
 * @param {Object} baseline   normalized render (from extract.js)
 * @param {Object} candidate  normalized render
 * @param {{baselinePng?, candidatePng?, style?, pixels?, a11y?:boolean, perceptual?:boolean}} [opts]
 *   PNGs are optional; when omitted Tier C is skipped (recorded as `null`) and
 *   the verdict is A AND B only. Pass `a11y: true` to add Tier D (semantic/aria)
 *   to the fail-closed AND — it catches a defect A/B/C cannot see (a correct
 *   look with a broken aria-checked/role), but requires `elements[].attrs`.
 *   Pass `perceptual: true` to swap Tier C from strict pixelmatch to a
 *   windowed-SSIM metric that suppresses sub-visual anti-alias noise while
 *   still flagging a real shift (opts.pixels is then forwarded as { minSsim }).
 * @returns {{pass:boolean, A, B, C:(Object|null), D:(Object|null), tiers:Object}}
 */
export function cascade(baseline, candidate, opts = {}) {
  const A = diffStructure(baseline, candidate);
  const B = diffStyle(baseline, candidate, opts.style);
  const C = (opts.baselinePng && opts.candidatePng)
    ? (opts.perceptual
      ? diffPerceptual(opts.baselinePng, opts.candidatePng, opts.pixels)
      : diffPixels(opts.baselinePng, opts.candidatePng, opts.pixels))
    : null;
  const D = opts.a11y ? diffA11y(baseline, candidate) : null;

  const cPass = C == null ? true : C.pass;
  const dPass = D == null ? true : D.pass;
  const pass = A.pass && B.pass && cPass && dPass;

  const tiers = { A: A.pass, B: B.pass, C: C == null ? null : C.pass };
  if (opts.a11y) tiers.D = D.pass; // only present when requested — default shape is unchanged

  return { pass, A, B, C, D, tiers };
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
