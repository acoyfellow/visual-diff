# visual-diff

A **framework-agnostic 3-tier visual-diff cascade** for deciding whether two
rendered UIs are the *same* — pixel-for-pixel, and for the right reasons.

Compare any two rendered DOM trees / screenshots (React vs Svelte, old build vs
new build, design vs implementation — it does not care) and get a **fail-closed
"1:1" verdict** backed by three independent tiers:

| Tier | Name | What it checks | What it catches |
|------|------|----------------|-----------------|
| **A** | DOM structure | element-multiset of the control subtree + whole tree | **missing / extra elements** (e.g. a checkbox with no checkmark) |
| **B** | Computed style | aligned per-element `getComputedStyle` deltas | wrong padding / size / color / border — *tells you WHAT differs* |
| **C** | Pixel | `pixelmatch` over the content bounding box | the literal 1:1 look |

`PASS = A AND B AND C`. No single tier is honest alone.

## Why a cascade (the methodology)

This library exists because the *usual* checks lie:

- **Class-string equality** passed while a checkbox rendered **with no
  checkmark** — the class was right, the element was gone.
- **A human screenshot-glance** false-positived "looks fixed."

Each tier covers the others' blind spots, so only the fail-closed **AND** of all
three is trustworthy:

- **A (structure)** is fail-closed on missing/extra elements, but blind to style
  (an invisible-but-present node passes A).
- **B (style)** names the exact property that differs, but is blind to a
  correctly-styled-but-structurally-wrong tree.
- **C (pixels)** is the final literal proof, but blind to *why* (missing element
  vs recolor vs 1px shift all look the same).

Two more principles make it reliable:

1. **`display:contents` flattening.** Wrapper elements that contribute no box and
   no layout (common in React output) are flattened out before comparison, so
   benign content-wrappers don't create false structural diffs — while genuinely
   missing *boxed* elements are still caught.
2. **The sanity-anchor pattern.** A fidelity gate you can't trust unless it still
   (a) **PASSES** a pair you *know* is identical and (b) **FLAGS** a pair you
   *know* is broken. `sanityCheck()` runs the cascade over labelled anchors and
   fails closed if either expectation is violated — proving the harness is
   neither rubber-stamping nor over-strict.

This mirrors the [Web Platform Tests reftest](https://web-platform-tests.org/writing-tests/reftests.html)
blueprint (`rel=match`/`mismatch` + fuzzy two-axis pixel match) that browser
vendors themselves use for visual equivalence.

## Install

```sh
npm install @acoyfellow/visual-diff
# for Tier C screenshots + the browser extractor, install a pinned Chromium:
npx playwright install chromium
```

`pixelmatch`, `pngjs`, and the lightweight `ws` client are the only runtime
dependencies. The browser
extractor drives a **pinned Playwright Chromium** over raw CDP (no `playwright`
runtime dependency, and never the OS "Chrome" app) so screenshots are
deterministic. Point it at a specific binary with `VISUAL_DIFF_CHROMIUM` if you
prefer.

## Usage

### The pure tiers (no browser needed)

The tiers operate on a normalized *render* object — you can produce it however
you like (the built-in extractor, your own walk, or fixtures):

```js
import { diffStructure, diffStyle, diffPixels, cascade } from '@acoyfellow/visual-diff';

const A = diffStructure(baseline, candidate);   // { pass, control, whole, missingSvg }
const B = diffStyle(baseline, candidate);       // { pass, deltas: [{tag, prop, baseline, candidate}] }
const C = diffPixels(baselinePng, candidatePng);// { pass, pct, diffPx, diff: PNG }

const verdict = cascade(baseline, candidate, { baselinePng, candidatePng });
// { pass, A, B, C, tiers: { A: true, B: true, C: false } }
```

A **render** looks like:

```js
{
  tagHistogram: { div: 1, span: 2, svg: 1, path: 1 }, // whole-tree tag counts
  roles: { checkbox: 1 },
  hasSvg: true,
  control: {                 // the interactive control subtree
    tag: 'span', role: 'checkbox', descendantCount: 3,
    tags: { span: 1, svg: 1, path: 1 },
  },
  elements: [                // flat list, in document order, for Tier B
    { tag: 'span', role: 'checkbox', styles: { width: '16px', /* ... */ } },
    // ...
  ],
}
```

### End-to-end with the browser extractor

```js
import { openBrowser, loadAndExtract, cascade, renderReport } from '@acoyfellow/visual-diff';
import { writeFileSync } from 'node:fs';

const b = await openBrowser({ viewport: { width: 640, height: 320 } });
try {
  const base = await loadAndExtract(b, baselineHtml,  { tmpDir: '.tmp', name: 'base' });
  const cand = await loadAndExtract(b, candidateHtml, { tmpDir: '.tmp', name: 'cand' });

  const result = cascade(base.struct, cand.struct, {
    baselinePng: base.png, candidatePng: cand.png,
  });
  console.log(result.pass ? '1:1 PASS' : 'BROKEN', result.tiers);

  writeFileSync('REPORT.html', renderReport([
    { name: 'my component', result, baselinePng: base.png, candidatePng: cand.png },
  ]));
} finally {
  b.close();
}
```

`loadAndExtract` accepts either a full HTML document or a bare fragment (it
mounts fragments in a white page); pass `cssHref` to link a shared stylesheet so
both sides render under identical CSS.

### Sanity anchors

```js
import { sanityCheck } from '@acoyfellow/visual-diff';

const { ok, violations } = sanityCheck([
  { name: 'identical', expect: 'pass',   baseline, candidate: baselineCopy, baselinePng, candidatePng },
  { name: 'broken',    expect: 'broken', baseline, candidate: brokenCand,   baselinePng, candidatePng: brokenPng },
]);
if (!ok) throw new Error('gate is untrustworthy: ' + violations.join('; '));
```

## Self-proof

`npm run proof` renders two sample UIs — one **identical** to the baseline
(expected PASS) and one deliberately **broken** (a dropped element + shifted
padding + recolor, expected BROKEN) — runs the full cascade through a pinned
Chromium, and writes `examples/out/REPORT.html` with the side-by-side + pixel
diff. It asserts the identical pair PASSES and the broken pair is FLAGGED (the
sanity-anchor pattern applied to the library itself).

## Tests

```sh
npm test
```

Unit tests (Node's built-in test runner, no framework) cover each tier and the
cascade. Tier A is checked against the real receipts from the experiments that
this cascade was extracted from (`test/fixtures/e0{1,2,3}-receipt.json`): the
checkbox's missing checkmark `<svg>` is caught, the known-good button passes,
and the switch's missing thumb is caught — the exact defects that motivated the
design.

## API

- `diffStructure(baseline, candidate)` → Tier A verdict
- `diffStyle(baseline, candidate, { tol, props })` → Tier B verdict
- `diffPixels(baselinePng, candidatePng, { threshold, includeAA, flagPct })` → Tier C verdict
- `cascade(baseline, candidate, { baselinePng, candidatePng, style, pixels })` → combined verdict
- `sanityCheck(anchors, opts)` → fail-closed anchor validation
- `openBrowser({ viewport, chromium })` → CDP browser handle
- `loadAndExtract(browser, html, { tmpDir, name, viewport, cssHref, mountSelector })` → `{ struct, png }`
- `renderReport(cards, { title, subtitle })` → HTML string
- helpers: `multisetDiff`, `alignLCS`, `numClose`, `contentBBox`, `resolveChromium`, `page`, `walkExpression`

## License

MIT
