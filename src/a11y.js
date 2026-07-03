// Tier D — SEMANTIC / ACCESSIBILITY (opt-in fourth AND term).
//
// The extractor already captures role + aria/state attributes per element
// (extract.js SEMANTIC_ATTRS). A/B/C can all agree on a pair that is
// pixel-for-pixel and structurally identical yet SCREEN-READER-BROKEN (e.g. a
// checkbox that visually looks checked but whose aria-checked flipped to
// false) — that class of defect is invisible to structure/style/pixels.
//
// Opt-in (via cascade's opts.a11y = true) so the existing 3-tier contract and
// its tests are unaffected by default: tiers stays {A,B,C} unless a caller
// explicitly asks for D. When asked, D joins the fail-closed AND like any
// other tier — no soft signal, no exception.

const A11Y_ATTRS = ['role', 'aria-checked', 'aria-hidden', 'aria-label', 'aria-disabled', 'data-state'];

function a11ySignature(render) {
  const sig = {};
  for (const el of render.elements || []) {
    const parts = [el.role || el.tag];
    for (const a of A11Y_ATTRS) {
      const v = (el.attrs && el.attrs[a]) ?? el[a];
      if (v !== undefined && v !== null && v !== '') parts.push(`${a}=${v}`);
    }
    const key = parts.join('|');
    sig[key] = (sig[key] || 0) + 1;
  }
  return sig;
}

/**
 * Tier D verdict: fail-closed on any delta in the a11y-relevant element
 * signature (role + aria/state attrs), independent of tag/style/pixel identity.
 * @param {Object} baseline   normalized render (must carry `elements[].attrs`)
 * @param {Object} candidate  normalized render
 * @returns {{pass:boolean, missing:Object<string,number>, extra:Object<string,number>}}
 */
export function diffA11y(baseline, candidate) {
  const b = a11ySignature(baseline);
  const c = a11ySignature(candidate);
  const missing = {};
  const extra = {};
  for (const k of new Set([...Object.keys(b), ...Object.keys(c)])) {
    const d = (b[k] || 0) - (c[k] || 0);
    if (d > 0) missing[k] = d;
    else if (d < 0) extra[k] = -d;
  }
  return { pass: Object.keys(missing).length === 0 && Object.keys(extra).length === 0, missing, extra };
}
