#!/usr/bin/env node
// visual-diff CLI: a human/pipeline-callable wrapper over verify() +
// loadAndExtract(). This exists because verify() is agent/library-shaped
// (import and call), and until now the only way to run the cascade end-to-end
// was to write a Node script (see examples/self-proof.mjs). Any CI system in
// any language can now shell out to this.
//
// Usage:
//   visual-diff <baseline.html> <candidate.html> [options]
//
// Options:
//   --report <path>       write an HTML report (renderReport)
//   --markdown <path>     write a GitHub-flavored markdown report (renderMarkdown)
//   --json                print the full verify() result as JSON instead of text
//   --a11y                include Tier D (semantic/aria) in the verdict
//   --perceptual          use the SSIM perceptual metric for Tier C
//   --viewport WxH        viewport size, default 640x320
//
// Exit code: 0 on 1:1 PASS, 1 on BROKEN, 2 on a usage/runtime error.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { openBrowser, loadAndExtract } from '../src/extract.js';
import { cascade } from '../src/cascade.js';
import { verify } from '../src/verify.js';
import { renderReport, renderMarkdown } from '../src/report.js';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--report') args.report = argv[++i];
    else if (a === '--markdown') args.markdown = argv[++i];
    else if (a === '--json') args.json = true;
    else if (a === '--a11y') args.a11y = true;
    else if (a === '--perceptual') args.perceptual = true;
    else if (a === '--viewport') args.viewport = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else args._.push(a);
  }
  return args;
}

function usage() {
  return `visual-diff <baseline.html> <candidate.html> [options]

Options:
  --report <path>     write an HTML report
  --markdown <path>   write a GitHub-flavored markdown report (PR-comment shaped)
  --json              print the full verify() result as JSON
  --a11y              include Tier D (semantic/aria) in the verdict
  --perceptual        use the SSIM perceptual metric for Tier C (suppresses AA noise)
  --viewport WxH      viewport size, default 640x320

Exit code: 0 on 1:1 PASS, 1 on BROKEN, 2 on a usage/runtime error.`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length < 2) {
    console.log(usage());
    process.exit(args.help ? 0 : 2);
  }

  const [baselinePath, candidatePath] = args._;
  let baselineHtml, candidateHtml;
  try {
    baselineHtml = readFileSync(resolve(baselinePath), 'utf8');
    candidateHtml = readFileSync(resolve(candidatePath), 'utf8');
  } catch (e) {
    console.error(`visual-diff: could not read input files: ${e.message}`);
    process.exit(2);
  }

  const [w, h] = (args.viewport || '640x320').split('x').map(Number);
  if (!w || !h) {
    console.error(`visual-diff: invalid --viewport "${args.viewport}", expected WxH (e.g. 640x320)`);
    process.exit(2);
  }

  const browser = await openBrowser({ viewport: { width: w, height: h } });
  let cascaded, result;
  try {
    const tmpDir = resolve('.visual-diff-tmp');
    const base = await loadAndExtract(browser, baselineHtml, { tmpDir, name: 'baseline', viewport: { width: w, height: h } });
    const cand = await loadAndExtract(browser, candidateHtml, { tmpDir, name: 'candidate', viewport: { width: w, height: h } });

    const opts = { baselinePng: base.png, candidatePng: cand.png, a11y: args.a11y, perceptual: args.perceptual };
    // cascade() carries the FULL per-tier detail (exact missing elements, named
    // style deltas) that the reports render; verify() is the CLI's narration
    // shape (verdict/why) shown on stdout. Both run over the identical inputs,
    // so they can never disagree — verify() is provably just a view of cascade().
    cascaded = cascade(base.struct, cand.struct, opts);
    result = verify(base.struct, cand.struct, opts);

    if (args.report || args.markdown) {
      const card = { name: `${baselinePath} vs ${candidatePath}`, result: cascaded, baselinePng: base.png, candidatePng: cand.png };
      if (args.report) {
        mkdirSync(resolve(args.report, '..'), { recursive: true });
        writeFileSync(resolve(args.report), renderReport([card]));
      }
      if (args.markdown) {
        mkdirSync(resolve(args.markdown, '..'), { recursive: true });
        writeFileSync(resolve(args.markdown), renderMarkdown([card]));
      }
    }
  } finally {
    browser.close();
  }

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`${result.verdict}  ${baselinePath} vs ${candidatePath}`);
    console.log(`tiers: ${JSON.stringify(result.tiers)}`);
    if (result.why) console.log(`why: ${result.why}`);
  }

  process.exit(result.pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e.stack || e);
  process.exit(2);
});
