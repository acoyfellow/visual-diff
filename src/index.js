// visual-diff — a framework-agnostic 3-tier visual-diff cascade.
//
// Compare any two rendered DOM trees / screenshots and get a fail-closed "1:1"
// verdict from three independent tiers:
//   A = DOM structure (element-multiset, catches missing/extra elements)
//   B = computed style (aligned deltas, tells you WHAT differs)
//   C = pixel diff     (pixelmatch over the content bbox, the literal 1:1 proof)
//
// See README.md for the methodology and usage.

// Tier A
export { diffStructure, multisetDiff } from './structure.js';
// Tier B
export { diffStyle, alignLCS, numClose, STYLE_PROPS, SIGNIFICANT } from './style.js';
// Tier C
export { diffPixels, contentBBox, PIXEL_FLAG_PCT } from './pixels.js';
// Cascade + sanity anchors
export { cascade, sanityCheck } from './cascade.js';
// Browser extraction (optional; needs a pinned Playwright Chromium)
export { openBrowser, loadAndExtract, page, walkExpression } from './extract.js';
export { resolveChromium } from './browser.js';
// Reporting
export { renderReport } from './report.js';
