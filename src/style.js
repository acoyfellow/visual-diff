// Tier B — COMPUTED STYLE (cause-locator).
//
// For elements that are present in both trees, align them via an LCS over
// (tag|role) signatures, then diff a set of "significant" computed-style
// properties (box model, colors, borders). Numeric px values are compared with a
// small tolerance so sub-pixel rounding does not create false deltas.
//
// This is the precision layer: it does not decide equivalence alone (it is blind
// to a correctly-styled-but-structurally-wrong tree) but it names WHAT differs
// (e.g. "the checkmark span's width is 0px vs 12px"), which Tier A cannot.

/** Computed-style properties collected per element during extraction. */
export const STYLE_PROPS = [
  'display', 'width', 'height',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'backgroundColor', 'backgroundImage',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderStyle', 'borderTopColor', 'borderRadius', 'boxShadow', 'color',
  'alignItems', 'justifyContent', 'fontSize', 'fontWeight',
];

/** Subset of STYLE_PROPS whose differences are treated as significant. */
export const SIGNIFICANT = new Set([
  'display', 'width', 'height',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'backgroundColor', 'backgroundImage',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderStyle', 'borderTopColor', 'borderRadius', 'boxShadow', 'color',
]);

const sig = (e) => `${e.tag}|${e.role || ''}`;

/**
 * Align two element lists by longest-common-subsequence over (tag|role), so that
 * only structurally-corresponding elements are style-compared.
 * @returns {Array<[Object,Object]>} matched element pairs
 */
export function alignLCS(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = sig(a[i]) === sig(b[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (sig(a[i]) === sig(b[j])) { pairs.push([a[i], b[j]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

/** True when x and y parse to px/number values within `tol`. */
export function numClose(x, y, tol = 0.6) {
  const px = parseFloat(x), py = parseFloat(y);
  if (!Number.isNaN(px) && !Number.isNaN(py) && /px|^\d/.test(x) && /px|^\d/.test(y)) {
    return Math.abs(px - py) <= tol;
  }
  return false;
}

/**
 * Tier B computed-style diff.
 * @param {{elements:Array}} baseline   render with per-element `styles`
 * @param {{elements:Array}} candidate
 * @param {{tol?:number, props?:Set<string>}} [opts]
 * @returns {{pass:boolean, deltas:Array<{tag,role,prop,baseline,candidate}>}}
 */
export function diffStyle(baseline, candidate, opts = {}) {
  const tol = opts.tol ?? 0.6;
  const props = opts.props ?? SIGNIFICANT;
  const pairs = alignLCS(baseline.elements || [], candidate.elements || []);
  const deltas = [];
  for (const [ba, ca] of pairs) {
    for (const p of STYLE_PROPS) {
      if (!props.has(p)) continue;
      const bv = ba.styles?.[p];
      const cv = ca.styles?.[p];
      if (bv !== cv && !numClose(bv, cv, tol)) {
        deltas.push({ tag: ba.tag, role: ba.role, prop: p, baseline: bv, candidate: cv });
      }
    }
  }
  return { pass: deltas.length === 0, deltas };
}
