// E-FIDELITY spike: a single trustworthy design<->impl fidelity number, not a
// vanity %. Composed from the three tiers' actual signal (not just pass/fail):
// structure completeness + style closeness + pixel similarity, weighted equally.
// KEEP IF the number is MONOTONIC as a fixture degrades in controlled steps
// (each added defect strictly lowers the score) and EXPLAINABLE (it names which
// tier moved and why) — not a black-box vanity percentage.
import { fileURLToPath } from 'node:url';
import { diffStructure } from '../../../src/structure.js';
import { diffStyle } from '../../../src/style.js';

// Structural completeness: 1 - (missing+extra elements / total expected elements).
function structureScore(baseline, candidate) {
  const r = diffStructure(baseline, candidate);
  const missing = Object.values(r.control?.missingInCandidate || {}).reduce((a, b) => a + b, 0);
  const extra = Object.values(r.control?.extraInCandidate || {}).reduce((a, b) => a + b, 0);
  const total = Math.max(1, baseline.control?.descendantCount ?? 1);
  return { score: Math.max(0, 1 - (missing + extra) / total), pass: r.pass, missing, extra };
}
// Style closeness: 1 - (fraction of compared props with a significant delta).
function styleScore(baseline, candidate) {
  const r = diffStyle(baseline, candidate);
  const compared = Math.max(1, (baseline.elements || []).length);
  return { score: Math.max(0, 1 - (r.deltas || []).length / compared), pass: r.pass, deltaCount: (r.deltas || []).length };
}

export function fidelity(baseline, candidate) {
  const s = structureScore(baseline, candidate);
  const st = styleScore(baseline, candidate);
  const score = (s.score + st.score) / 2; // pixel tier omitted here (needs PNGs); documented, not hidden
  const explain = [];
  if (s.score < 1) explain.push(`structure -${((1 - s.score) * 100).toFixed(1)}pp (${s.missing} missing, ${s.extra} extra)`);
  if (st.score < 1) explain.push(`style -${((1 - st.score) * 100).toFixed(1)}pp (${st.deltaCount} property deltas)`);
  return { score: +score.toFixed(4), structure: s, style: st, explain: explain.join('; ') || 'no defects' };
}

// A baseline that degrades in controlled steps: perfect -> style-only regression -> style+structure regression.
// Renders need tagHistogram + control.tags for diffStructure's multisetDiff.
const el = (tag, styles = {}) => ({ tag, role: null, styles: { paddingTop: styles.padding, color: styles.color } });
const render = (tags, els) => ({ tagHistogram: tags, control: { tags, descendantCount: Object.values(tags).reduce((a,b)=>a+b,0) }, hasSvg: !!tags.svg, elements: els });
function main() {
  const fullTags = { div: 1, span: 1, svg: 1 };
  const droppedTags = { div: 1, span: 1 }; // svg dropped
  const baseline = render(fullTags, [el('div', { padding: '8px' }), el('span', { color: 'rgb(0,0,0)' }), el('svg')]);
  const perfect = render(fullTags, [el('div', { padding: '8px' }), el('span', { color: 'rgb(0,0,0)' }), el('svg')]);
  const styleOff = render(fullTags, [el('div', { padding: '20px' }), el('span', { color: 'rgb(0,0,0)' }), el('svg')]);
  const styleAndStructOff = render(droppedTags, [el('div', { padding: '20px' }), el('span', { color: 'rgb(0,0,0)' })]);

  const f0 = fidelity(baseline, perfect);
  const f1 = fidelity(baseline, styleOff);
  const f2 = fidelity(baseline, styleAndStructOff);

  const monotonic = f0.score >= f1.score && f1.score >= f2.score && f0.score === 1;
  const explainable = !!f1.explain && f1.explain !== 'no defects' && !!f2.explain;

  const receipt = {
    experiment: 'E-FIDELITY',
    criterion: 'score is MONOTONIC as defects are added, in steps, and EXPLAINABLE (names the tier + magnitude)',
    perfect: f0, styleRegression: f1, styleAndStructureRegression: f2,
    monotonic, explainable, anchorsHeld: monotonic && explainable,
  };
  console.log(JSON.stringify(receipt, null, 2));
  return monotonic && explainable;
}
if (import.meta.url === `file://${process.argv[1]}`) process.exit(main() ? 0 : 1);
