// The agent-verification oracle: wrap the cascade as a structured, actionable
// verdict any caller — an MCP tool, a CI step, a CLI — can trust.
//
// This exists because the cascade's raw return ({pass, A, B, C, tiers}) is the
// right shape for a library, but the wrong shape for a caller that just wants
// to KNOW and ACT: "did this pass, and if not, why, in one sentence." verify()
// is that thin, honest translation — it adds no new judgment, it only narrates
// the cascade's own verdict. Promoted from experiments/E-MCP after it returned
// the correct verdict on all three real E03 defects (checkbox, switch, button).

import { cascade } from './cascade.js';

/**
 * Run the cascade and return an agent/CI-shaped verdict: PASS/FAIL plus a
 * short, tier-attributed reason when it fails. No new judgment over cascade() —
 * this is a narration layer, not a fourth tier.
 *
 * @param {Object} before  normalized baseline render (see structure.js)
 * @param {Object} after   normalized candidate render
 * @param {{baselinePng?, candidatePng?, style?, pixels?}} [opts] forwarded to cascade()
 * @returns {{verdict:('1:1'|'BROKEN'), pass:boolean, tiers:Object, why:(string|null)}}
 */
export function verify(before, after, opts = {}) {
  const r = cascade(before, after, opts);
  return {
    verdict: r.pass ? '1:1' : 'BROKEN',
    pass: r.pass,
    tiers: r.tiers,
    why: r.pass ? null : failReason(r),
  };
}

/** Build a short, tier-attributed reason string from a failed cascade result. */
function failReason(r) {
  const parts = [];
  if (r.A && !r.A.pass) {
    const missing = r.A.control?.missingInCandidate;
    parts.push(`structure: missing ${JSON.stringify(missing && Object.keys(missing).length ? missing : r.A.whole?.missingInCandidate ?? {})}`);
  }
  if (r.B && !r.B.pass) {
    const named = (r.B.deltas || []).slice(0, 3).map((d) => `${d.tag}.${d.prop}`).join(', ');
    parts.push(`style: ${named}`);
  }
  if (r.C && !r.C.pass) {
    parts.push(`pixels: ${r.C.pct}% differ`);
  }
  return parts.join(' | ') || 'cascade failed with no tier detail';
}
