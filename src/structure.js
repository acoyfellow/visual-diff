// Tier A — STRUCTURE (fail-closed element-multiset diff).
//
// Compares two rendered DOM trees by the *multiset of element tags*, both in the
// interactive "control subtree" (where controls like a checkmark <svg> or a
// switch thumb live) and across the whole tree. This is the primary, fail-closed
// gate: it catches MISSING and EXTRA elements that a class-string or eyeball
// comparison silently pass (e.g. a checkbox rendered without its checkmark).
//
// Input is a normalized render object produced by extract.js (or any equivalent
// walk). It is framework-agnostic: any two rendered trees can be compared.

/**
 * @typedef {Object} RenderStruct
 * @property {Object<string,number>} tagHistogram  element tag -> count (whole tree)
 * @property {Object<string,number>} [roles]       aria/implicit role -> count
 * @property {boolean} [hasSvg]                     whole tree contains an <svg>
 * @property {{tag:string, role:(string|null), descendantCount:number, tags:Object<string,number>}} control
 *           the interactive control subtree histogram
 */

/**
 * Multiset difference a - b.
 * @returns {{missing:Object<string,number>, extra:Object<string,number>}}
 *   missing = present in `a` but absent/short in `b`; extra = the reverse.
 */
export function multisetDiff(a = {}, b = {}) {
  const missing = {};
  const extra = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = (a[k] || 0) - (b[k] || 0);
    if (d > 0) missing[k] = d;
    else if (d < 0) extra[k] = -d;
  }
  return { missing, extra };
}

const isEmpty = (o) => Object.keys(o).length === 0;

/**
 * Tier A structural diff of a baseline render vs a candidate render.
 *
 * Structural equivalence requires BOTH the interactive control subtree AND the
 * whole tree to carry identical element multisets. The whole-tree check catches
 * root-element mismatches the control-only view misses; the control-subtree
 * check pinpoints classic missing-control defects (checkmark / thumb / track).
 *
 * @param {RenderStruct} baseline   the reference render (e.g. the golden)
 * @param {RenderStruct} candidate  the render under test
 * @returns {{pass:boolean, controlEqual:boolean, wholeEqual:boolean,
 *   missingSvg:boolean, control:Object, whole:Object}}
 */
export function diffStructure(baseline, candidate) {
  const cb = baseline.control || { tags: {}, descendantCount: 0 };
  const cc = candidate.control || { tags: {}, descendantCount: 0 };

  const control = multisetDiff(cb.tags, cc.tags);
  const whole = multisetDiff(baseline.tagHistogram, candidate.tagHistogram);

  const controlEqual = isEmpty(control.missing) && isEmpty(control.extra);
  const wholeEqual = isEmpty(whole.missing) && isEmpty(whole.extra);

  return {
    pass: controlEqual && wholeEqual,
    controlEqual,
    wholeEqual,
    // Named signal for the classic "control graphic dropped" defect.
    missingSvg: !!baseline.hasSvg && !candidate.hasSvg,
    control: {
      baseline: cb.tags,
      candidate: cc.tags,
      missingInCandidate: control.missing,
      extraInCandidate: control.extra,
    },
    whole: {
      missingInCandidate: whole.missing,
      extraInCandidate: whole.extra,
    },
  };
}
