// E-PROD spike: producer-agnostic renders. The cascade consumes a normalized
// render object; the built-in browser extractor is just ONE producer. KEEP IF a
// SECOND, non-browser producer (a static-HTML/DOM-string walker, no Chromium)
// feeds the SAME cascade and gets a correct verdict — proving the engine is
// truly producer-agnostic, not accidentally coupled to CDP.
import { fileURLToPath } from 'node:url';
import { cascade } from '../../../src/index.js';

// A minimal producer: parse a simple HTML string into the normalized render
// shape WITHOUT a browser (regex-based mini walker — deliberately naive, to
// prove the CONTRACT is satisfiable by any producer, not to replace extract.js).
function produce(html) {
  const tagRe = /<(\w+)([^>]*)\/?>/g;
  const elements = [];
  const tagHistogram = {};
  let m;
  while ((m = tagRe.exec(html))) {
    const tag = m[1].toLowerCase();
    if (tag === 'html' || tag === 'body' || tag === 'head') continue;
    const attrs = {};
    const roleM = /role="([^"]+)"/.exec(m[2]);
    if (roleM) attrs.role = roleM[1];
    const ariaM = /aria-checked="([^"]+)"/.exec(m[2]);
    if (ariaM) attrs['aria-checked'] = ariaM[1];
    elements.push({ tag, role: attrs.role || null, attrs });
    tagHistogram[tag] = (tagHistogram[tag] || 0) + 1;
  }
  const control = elements.find(e => e.role === 'checkbox') || elements[0] || { tag: 'div' };
  return {
    tagHistogram,
    control: { tag: control.tag, role: control.role, descendantCount: elements.length - 1, tags: tagHistogram },
    hasSvg: !!tagHistogram.svg,
    elements,
  };
}

function main() {
  const goodHtml = `<span role="checkbox" aria-checked="true"><svg><path/></svg></span>`;
  const brokenHtml = `<span role="checkbox" aria-checked="true"></span>`; // svg+path dropped

  const baseline = produce(goodHtml);
  const identicalCand = produce(goodHtml);
  const brokenCand = produce(brokenHtml);

  const passRun = cascade(baseline, identicalCand);          // ANCHOR 1: must PASS
  const brokenRun = cascade(baseline, brokenCand);            // ANCHOR 2: must FLAG (missing svg/path)

  const anchorsHeld = passRun.pass === true && brokenRun.pass === false;

  const receipt = {
    experiment: 'E-PROD',
    criterion: 'a SECOND non-browser producer feeds the SAME cascade and gets correct verdicts',
    identical: { pass: passRun.pass, tiers: passRun.tiers },
    broken: { pass: brokenRun.pass, tiers: brokenRun.tiers, missing: brokenRun.A.control?.missingInCandidate },
    anchorsHeld,
  };
  console.log(JSON.stringify(receipt, null, 2));
  return anchorsHeld;
}
if (import.meta.url === `file://${process.argv[1]}`) process.exit(main() ? 0 : 1);
