// E-MCP spike: the agent-verification wedge.
// Wraps the cascade as verify(before, after) -> a fail-closed 1:1 verdict an
// agent can call to PROVE a UI change. KEEP IF an agent-shaped call returns the
// CORRECT 1:1/BROKEN verdict on the REAL E03 defect receipt (the exact defects
// that motivated the library: missing checkmark svg, missing switch thumb, a
// known-good button). Pure tiers over reconstructed structs = the agent-oracle
// shape (no browser needed to prove the wedge).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cascade } from '../../../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const e03 = JSON.parse(readFileSync(join(HERE, '..', '..', '..', 'test', 'fixtures', 'e03-receipt.json'), 'utf8'));

// Faithful reconstruction (matches test/structure.test.js structsFrom).
function structsFrom(pc) {
  const cs = pc.controlSubtree;
  return {
    baseline: {
      tagHistogram: pc.wholeTree.missingInNative || {},
      control: { tags: cs.react.tags || {}, descendantCount: cs.react.descendantCount },
      hasSvg: !!(cs.react.tags && cs.react.tags.svg) || !!(pc.wholeTree.missingInNative || {}).svg,
    },
    candidate: {
      tagHistogram: pc.wholeTree.extraInNative || {},
      control: { tags: cs.native.tags || {}, descendantCount: cs.native.descendantCount },
      hasSvg: !!(cs.native.tags && cs.native.tags.svg),
    },
  };
}

// The agent-facing tool: two normalized renders -> a structured, actionable verdict.
export function verify(before, after, opts = {}) {
  const r = cascade(before, after, opts);
  const why = [];
  if (r.A && !r.A.pass) why.push(`structure: ${JSON.stringify(r.A.control?.missingInCandidate || r.A.whole || {})}`);
  if (r.B && !r.B.pass) why.push(`style: ${(r.B.deltas || []).slice(0, 3).map(d => `${d.tag}.${d.prop}`).join(', ')}`);
  if (r.C && !r.C.pass) why.push(`pixels: ${r.C.pct}% differ`);
  return { verdict: r.pass ? '1:1' : 'BROKEN', pass: r.pass, tiers: r.tiers, why: why.join(' | ') || null };
}

function main() {
  const results = [];
  for (const pc of e03.perComponent) {
    const { baseline, candidate } = structsFrom(pc);
    const v = verify(baseline, candidate);              // pure A∧B (no PNGs) — the structural oracle
    const expected = pc.structurallyEquivalent ? '1:1' : 'BROKEN';
    results.push({ component: pc.name, expected, got: v.verdict, held: v.verdict === expected, why: v.why });
  }
  const allHeld = results.length > 0 && results.every(r => r.held);
  const receipt = { experiment: 'E-MCP', criterion: 'agent-shaped verify() returns correct verdict on real E03 defects', results, allHeld };
  console.log(JSON.stringify(receipt, null, 2));
  return allHeld;
}
if (import.meta.url === `file://${process.argv[1]}`) process.exit(main() ? 0 : 1);
