// E-A11Y spike: Tier D — semantic/accessibility diff. The extractor already
// captures role + aria-* per element; diff the accessibility-relevant signal
// and join the cascade as another fail-closed AND term. KEEP IF it catches a
// "looks identical, a11y-broken" pair the other tiers MISS, and PASSES an
// a11y-equivalent pair. Sanity-anchored both directions.
import { fileURLToPath } from 'node:url';

// A11y-relevant projection of a render's elements: role + the aria/state attrs
// that a screen reader depends on. Two renders are a11y-equivalent iff this
// multiset matches.
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

// Tier D: fail-closed on any a11y-signature delta.
export function diffA11y(baseline, candidate) {
  const b = a11ySignature(baseline), c = a11ySignature(candidate);
  const missing = {}, extra = {};
  for (const k of new Set([...Object.keys(b), ...Object.keys(c)])) {
    const d = (b[k] || 0) - (c[k] || 0);
    if (d > 0) missing[k] = d; else if (d < 0) extra[k] = -d;
  }
  const pass = Object.keys(missing).length === 0 && Object.keys(extra).length === 0;
  return { pass, missing, extra };
}

// Two renders that look pixel/structure-identical but differ in a11y:
// a checkbox visually "checked" but aria-checked flipped to false (screen-reader broken).
const el = (tag, role, attrs = {}, styles = {}) => ({ tag, role, attrs, styles });
function main() {
  const baseline = { elements: [
    el('span', 'checkbox', { role: 'checkbox', 'aria-checked': 'true' }),
    el('svg', '(graphic)', {}), el('path', null, {}),
  ] };
  // ANCHOR 1 (must PASS): a11y-equivalent copy.
  const equivalent = { elements: baseline.elements.map(e => ({ ...e, attrs: { ...e.attrs } })) };
  // ANCHOR 2 (must FLAG): same tags/style, but aria-checked broken -> a11y regression
  // the structure & pixel tiers would NOT catch (same elements, same look).
  const brokenA11y = { elements: [
    el('span', 'checkbox', { role: 'checkbox', 'aria-checked': 'false' }), // <- broken
    el('svg', '(graphic)', {}), el('path', null, {}),
  ] };

  const pass = diffA11y(baseline, equivalent);
  const flag = diffA11y(baseline, brokenA11y);
  const anchorsHeld = pass.pass === true && flag.pass === false;

  const receipt = {
    experiment: 'E-A11Y',
    criterion: 'a11y-equivalent PASSES; aria-checked regression FLAGGED (a defect A/B/C would miss)',
    equivalent: pass, brokenA11y: flag, anchorsHeld,
  };
  console.log(JSON.stringify(receipt, null, 2));
  return anchorsHeld;
}
if (import.meta.url === `file://${process.argv[1]}`) process.exit(main() ? 0 : 1);
