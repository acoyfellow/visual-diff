// A single trustworthy design<->implementation fidelity SCORE — not a vanity
// percentage. Composed from the structure and style tiers' actual signal
// (fraction of elements/properties that differ), so the number is:
//   - MONOTONIC: every added defect strictly lowers it (proven in
//     experiments/E-FIDELITY across a 3-step degradation).
//   - EXPLAINABLE: it names which tier moved and by how much, so a caller
//     never has to trust the number blindly.
//
// This is deliberately NOT a fourth verdict tier — cascade()'s pass/fail stays
// the fail-closed gate. fidelity() is a continuous companion metric for a
// caller who wants "how close" in addition to "did it pass" (e.g. a design
// team tracking build drift over time, not just a binary CI gate).
//
// The pixel tier is intentionally excluded here: it needs PNGs, which many
// callers (pure-render comparisons, no browser) will not have. Structure+style
// alone is documented, not hidden — see `tiers` in the returned object.

import { diffStructure } from './structure.js';
import { diffStyle } from './style.js';

/**
 * @param {Object} baseline   normalized render (structure.js RenderStruct)
 * @param {Object} candidate  normalized render
 * @param {{style?:Object}} [opts] forwarded to diffStyle
 * @returns {{score:number, tiers:{structure:number, style:number}, explain:string}}
 *   score in [0,1]; 1 = no detected defects across the included tiers.
 */
export function fidelity(baseline, candidate, opts = {}) {
  const structure = structureScore(baseline, candidate);
  const style = styleScore(baseline, candidate, opts.style);
  const score = (structure.score + style.score) / 2;

  const explain = [];
  if (structure.score < 1) {
    explain.push(`structure -${pp(1 - structure.score)} (${structure.missing} missing, ${structure.extra} extra)`);
  }
  if (style.score < 1) {
    explain.push(`style -${pp(1 - style.score)} (${style.deltaCount} property delta${style.deltaCount === 1 ? '' : 's'})`);
  }

  return {
    score: round(score),
    tiers: { structure: round(structure.score), style: round(style.score) },
    explain: explain.join('; ') || 'no defects',
  };
}

/** Structural completeness: 1 - (missing+extra control elements / expected). */
function structureScore(baseline, candidate) {
  const r = diffStructure(baseline, candidate);
  const missing = sum(r.control?.missingInCandidate);
  const extra = sum(r.control?.extraInCandidate);
  const total = Math.max(1, baseline.control?.descendantCount ?? 1);
  return { score: Math.max(0, 1 - (missing + extra) / total), missing, extra };
}

/** Style closeness: 1 - (fraction of aligned elements carrying a significant delta). */
function styleScore(baseline, candidate, styleOpts) {
  const r = diffStyle(baseline, candidate, styleOpts);
  const compared = Math.max(1, (baseline.elements || []).length);
  const deltaCount = (r.deltas || []).length;
  return { score: Math.max(0, 1 - deltaCount / compared), deltaCount };
}

const sum = (obj) => Object.values(obj || {}).reduce((a, b) => a + b, 0);
const round = (n) => Math.round(n * 10000) / 10000;
const pp = (frac) => `${(frac * 100).toFixed(1)}pp`;
