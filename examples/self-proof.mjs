// SELF-PROOF: run the 3-tier cascade on two sample renders through a pinned
// Playwright Chromium and emit a human-viewable REPORT.html.
//
//   - "identical" : the candidate is byte-for-byte the baseline  -> expect PASS
//   - "broken"    : the candidate drops an element, shifts padding
//                   and recolors                                  -> expect BROKEN
//
// This is the sanity-anchor pattern applied to the library itself: the proof
// exits non-zero unless the identical pair PASSES and the broken pair is FLAGGED.
// Framework-agnostic — the samples are plain HTML, no framework involved.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openBrowser, loadAndExtract } from '../src/extract.js';
import { cascade } from '../src/cascade.js';
import { renderReport } from '../src/report.js';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const TMP = fileURLToPath(new URL('./out/.tmp/', import.meta.url));
mkdirSync(OUT, { recursive: true });

// A small "toggle control" card. The interactive control (role=checkbox) holds
// a checkmark <svg> — exactly the kind of element structural diffs must protect.
const BASELINE = `
<div style="font-family:sans-serif;display:inline-flex;align-items:center;gap:8px;padding:12px 16px;border:1px solid #d0d7de;border-radius:10px;background:#fff">
  <span role="checkbox" aria-checked="true" style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:5px;background:#2563eb;padding:2px">
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6 L5 9 L10 3" fill="none" stroke="#fff" stroke-width="2"/></svg>
  </span>
  <span style="font-size:14px;color:#1f2328">Accept terms</span>
</div>`;

// Identical candidate -> must PASS.
const IDENTICAL = BASELINE;

// Broken candidate -> the checkmark <svg> is DROPPED (structure A), the box
// padding is removed and the label recolored (style B), which also changes the
// pixels (C). All three tiers should flag it.
const BROKEN = `
<div style="font-family:sans-serif;display:inline-flex;align-items:center;gap:8px;padding:12px 16px;border:1px solid #d0d7de;border-radius:10px;background:#fff">
  <span role="checkbox" aria-checked="true" style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:5px;background:#2563eb;padding:0px">
  </span>
  <span style="font-size:14px;color:#c026d3">Accept terms</span>
</div>`;

const VIEW = { width: 320, height: 120 };

async function main() {
  const b = await openBrowser({ viewport: VIEW });
  const cards = [];
  const anchors = [];
  try {
    const base = await loadAndExtract(b, BASELINE, { tmpDir: TMP, name: 'baseline', viewport: VIEW });

    for (const [name, html, expect] of [
      ['identical (expect PASS)', IDENTICAL, 'pass'],
      ['broken: dropped checkmark + padding + recolor (expect BROKEN)', BROKEN, 'broken'],
    ]) {
      const cand = await loadAndExtract(b, html, { tmpDir: TMP, name: name.split(' ')[0], viewport: VIEW });
      const result = cascade(base.struct, cand.struct, {
        baselinePng: base.png, candidatePng: cand.png,
      });
      cards.push({ name, result, baselinePng: base.png, candidatePng: cand.png });
      anchors.push({ name, expect, verdict: result.pass ? 'pass' : 'broken' });
      console.log(`${name} -> ${result.pass ? '1:1 PASS' : 'BROKEN'}  tiers=${JSON.stringify(result.tiers)}`);
    }
  } finally {
    b.close();
  }

  const html = renderReport(cards, {
    title: 'visual-diff — self-proof',
    subtitle: 'Two plain-HTML renders compared through all three tiers. The identical pair must PASS; the deliberately broken pair (dropped checkmark <svg> + removed padding + recolor) must be FLAGGED.',
  });
  const reportPath = `${OUT}/REPORT.html`;
  writeFileSync(reportPath, html);
  console.log(`\nReport: ${reportPath}`);

  // Fail-closed: the proof itself is only valid if the anchors hold.
  const violations = anchors.filter((a) => a.verdict !== a.expect);
  if (violations.length) {
    console.error('SELF-PROOF FAILED — anchors did not hold:');
    for (const v of violations) console.error(`  ${v.name}: expected ${v.expect}, got ${v.verdict}`);
    process.exit(1);
  }
  console.log('SELF-PROOF OK — identical PASSED and broken was FLAGGED.');
}

main().catch((e) => { console.error(e.stack || e); process.exit(1); });
