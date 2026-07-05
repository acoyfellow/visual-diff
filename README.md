# visual-diff

A framework-agnostic 3-tier cascade for deciding whether two rendered UIs are
the same, pixel-for-pixel and for reasons you can inspect.

Compare two rendered DOM trees or screenshots (React against Svelte, an old
build against a new one, design against implementation) and get a fail-closed
"1:1" verdict from three independent tiers:

| Tier | Name | Checks | Example it catches |
|------|------|--------|--------------------|
| A | DOM structure | element-multiset of the control subtree and whole tree | a missing or extra element, such as a checkbox with no checkmark |
| B | Computed style | aligned per-element `getComputedStyle` deltas | wrong padding, size, color, or border, and names the property |
| C | Pixel | `pixelmatch` over the content bounding box | the literal look |

A pair passes when all three pass: `PASS = A AND B AND C`.

## Why a cascade

Each tier covers a blind spot the others have. Two checks that seemed enough
on their own each let a real defect through:

- Class-string equality passed while a checkbox rendered with no checkmark. The
  class was right; the element was gone.
- A human screenshot glance reported "looks fixed" when it was not.

The three tiers fail on different things:

- A (structure) catches missing and extra elements but is blind to style, so an
  invisible-but-present node passes it.
- B (style) names the property that differs but is blind to a correctly-styled
  tree with the wrong structure.
- C (pixels) is the literal proof but cannot say why: a missing element, a
  recolor, and a 1px shift all look the same to it.

Two mechanisms keep the cascade from producing false diffs:

1. `display:contents` flattening. Wrapper elements that contribute no box and no
   layout (common in React output) are flattened before comparison, so a benign
   content-wrapper does not register as a structural diff. A missing boxed
   element still does.
2. The sanity-anchor pattern. A gate is only trustworthy if it still passes a
   pair known to be identical and flags a pair known to be broken.
   `sanityCheck()` runs the cascade over labelled anchors and fails closed when
   either expectation is violated, so the harness can neither rubber-stamp nor
   over-flag.

This follows the [Web Platform Tests reftest](https://web-platform-tests.org/writing-tests/reftests.html)
blueprint (`rel=match`/`mismatch` plus a fuzzy two-axis pixel match) that
browser vendors use for visual equivalence.

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

## CLI

`bin/visual-diff.mjs` (installed as `visual-diff` when this package is
installed globally or run via `npx`) wraps `verify()` and the browser
extractor, so any pipeline that can shell out can use it, not only Node or
agent callers.

```sh
npx @acoyfellow/visual-diff baseline.html candidate.html
# 1:1  baseline.html vs candidate.html
# tiers: {"A":true,"B":true,"C":true}

npx @acoyfellow/visual-diff baseline.html candidate.html --markdown report.md
# writes a GitHub-flavored markdown table + collapsible failure detail,
# ready to post as a PR comment
```

Options: `--report <path>` (HTML), `--markdown <path>` (GFM), `--json` (raw
`verify()` result), `--a11y` (add Tier D), `--perceptual` (SSIM Tier C),
`--viewport WxH`. Exit code is `0` on `1:1`, `1` on `BROKEN`, `2` on a
usage/runtime error — CI-usable from any language.

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

- `diffStructure(baseline, candidate)` returns a Tier A verdict.
- `diffStyle(baseline, candidate, { tol, props })` returns a Tier B verdict.
- `diffPixels(baselinePng, candidatePng, { threshold, includeAA, flagPct })` returns a Tier C verdict.
- `cascade(baseline, candidate, { baselinePng, candidatePng, style, pixels })` returns the combined verdict.
- `sanityCheck(anchors, opts)` runs fail-closed anchor validation.
- `verify(before, after, opts)` returns `{ verdict: '1:1'|'BROKEN', pass, tiers, why }`. It narrates `cascade()` in an agent/CI shape with the same verdict; `why` names the failing tier when `pass` is false.
- `fidelity(baseline, candidate, { style })` returns `{ score, tiers: { structure, style }, explain }`. The score is a continuous, monotonic structure-plus-style closeness value from 0 to 1, meant to sit alongside `cascade()`'s pass/fail rather than replace it. It excludes the pixel tier and needs no PNGs.
- `openBrowser({ viewport, chromium })` returns a CDP browser handle.
- `loadAndExtract(browser, html, { tmpDir, name, viewport, cssHref, mountSelector })` returns `{ struct, png }`.
- `renderReport(cards, { title, subtitle })` returns an HTML string.
- `renderMarkdown(cards, { title })` returns GitHub-flavored markdown: a summary table plus collapsible per-failure detail, shaped for a PR comment, with no embedded images.
- `badgeFromFidelity(fidelityResult, { label })` and `badgeFromVerify(verifyResult, { label })` return shields.io endpoint-badge JSON (`{schemaVersion, label, message, color}`).
- helpers: `multisetDiff`, `alignLCS`, `numClose`, `contentBBox`, `resolveChromium`, `page`, `walkExpression`

## License

MIT
