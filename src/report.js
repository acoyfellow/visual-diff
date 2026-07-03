// Human-viewable HTML report of cascade results (baseline vs candidate, per
// pair, with the three tier verdicts and side-by-side + diff screenshots).

import { PNG } from 'pngjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const b64 = (png) => 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');
const fmtObj = (o) => (!o || !Object.keys(o).length) ? '' : Object.entries(o).map(([k, v]) => `${k}\u00d7${v}`).join(', ');

/**
 * @param {Array<{name, result, baselinePng?, candidatePng?}>} cards
 *   each `result` is the object returned by cascade()
 * @param {{title?:string, subtitle?:string}} [opts]
 * @returns {string} an HTML document
 */
export function renderReport(cards, opts = {}) {
  const title = opts.title || '3-tier visual-diff — report';
  const subtitle = opts.subtitle ||
    'Each pair is compared through all three tiers: A = DOM structure, B = computed style, C = pixel diff. A pair is 1:1 PASS only when all three agree.';

  const cardHtml = cards.map(({ name, result: r, baselinePng, candidatePng }) => {
    const pass = r.pass;
    const C = r.C;
    const cPct = C ? `${C.pct}%` : 'n/a';
    const cPass = C ? C.pass : true;
    const bMiss = fmtObj(r.A.control.missingInCandidate);
    const bExtra = fmtObj(r.A.control.extraInCandidate);
    const bDeltas = (r.B.deltas || []).slice(0, 4)
      .map((d) => `${d.tag}.${d.prop} ${d.baseline}\u2192${d.candidate}`).join('; ');
    return `
  <section style="border:1px solid #ddd;border-radius:12px;padding:20px;margin:0 0 28px;background:#fff">
    <h2 style="margin:0 0 4px">${esc(name)}
      <span style="font-size:14px;padding:3px 10px;border-radius:999px;color:#fff;background:${pass ? '#16a34a' : '#dc2626'}">${pass ? '1:1 PASS' : 'BROKEN'}</span>
    </h2>
    <p style="margin:6px 0 16px;color:#444;font:13px ui-monospace,monospace">
      Tier A (DOM structure): <b style="color:${r.A.pass ? '#16a34a' : '#dc2626'}">${r.A.pass ? 'match' : 'MISMATCH'}</b>${r.A.pass ? '' : ` \u2014 missing: ${esc(bMiss || '{}')} extra: ${esc(bExtra || '{}')}`} &nbsp;\u00b7&nbsp;
      Tier B (computed style): <b style="color:${r.B.pass ? '#16a34a' : '#dc2626'}">${r.B.pass ? 'match' : 'MISMATCH'}</b>${r.B.pass ? '' : ` \u2014 ${esc(bDeltas)}`} &nbsp;\u00b7&nbsp;
      Tier C (pixel diff): <b style="color:${cPass ? '#16a34a' : '#dc2626'}">${cPct}</b> ${C ? (cPass ? '(\u22641% \u2713)' : '(fail)') : ''}
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
      <figure style="margin:0"><figcaption style="font:12px sans-serif;color:#666;margin-bottom:6px">Baseline</figcaption>${baselinePng ? `<img src="${b64(baselinePng)}" style="width:100%;border:1px solid #eee;background:#fff">` : '<div style="color:#999">n/a</div>'}</figure>
      <figure style="margin:0"><figcaption style="font:12px sans-serif;color:#666;margin-bottom:6px">Candidate</figcaption>${candidatePng ? `<img src="${b64(candidatePng)}" style="width:100%;border:1px solid #eee;background:#fff">` : '<div style="color:#999">n/a</div>'}</figure>
      <figure style="margin:0"><figcaption style="font:12px sans-serif;color:#666;margin-bottom:6px">Pixel diff (red = different)</figcaption>${C && C.diff ? `<img src="${b64(C.diff)}" style="width:100%;border:1px solid #eee;background:#fff">` : '<div style="color:#999">n/a</div>'}</figure>
    </div>
  </section>`;
  }).join('\n');

  return `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>
<body style="max-width:1100px;margin:40px auto;font-family:sans-serif;padding:0 20px;background:#fafafa">
<h1>${esc(title)}</h1>
<p style="color:#555">${esc(subtitle)} Screenshots are real browser renders (pinned Chromium). Generated ${new Date().toISOString()}.</p>
${cardHtml}
</body>`;
}
