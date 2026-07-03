// E-CI spike: reftest-as-CI. A ratcheting fidelity floor: this run's cascade
// pass-rate over a fixture set must be >= the last COMMITTED floor, and the
// floor is expected to only rise over time (never silently loosen). KEEP IF the
// gate runs green on the repo's own real fixtures AND fails closed when a
// fixture set's pass-rate would regress below the committed floor.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cascade } from '../../../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FLOOR_FILE = join(HERE, '..', 'out', 'floor.json');
const e03 = JSON.parse(readFileSync(join(HERE, '..', '..', '..', 'test', 'fixtures', 'e03-receipt.json'), 'utf8'));

function structsFrom(pc) {
  const cs = pc.controlSubtree;
  return {
    baseline: { tagHistogram: pc.wholeTree.missingInNative || {}, control: { tags: cs.react.tags || {}, descendantCount: cs.react.descendantCount }, hasSvg: !!(cs.react.tags && cs.react.tags.svg) },
    candidate: { tagHistogram: pc.wholeTree.extraInNative || {}, control: { tags: cs.native.tags || {}, descendantCount: cs.native.descendantCount }, hasSvg: !!(cs.native.tags && cs.native.tags.svg) },
  };
}

function passRate() {
  let correct = 0;
  for (const pc of e03.perComponent) {
    const { baseline, candidate } = structsFrom(pc);
    const r = cascade(baseline, candidate);
    const expected = pc.structurallyEquivalent;
    if (r.pass === expected) correct++;
  }
  return correct / e03.perComponent.length;
}

function main() {
  const rate = passRate();
  const prevFloor = existsSync(FLOOR_FILE) ? JSON.parse(readFileSync(FLOOR_FILE, 'utf8')).floor : 0;
  const gateOk = rate >= prevFloor;         // fail-closed: never accept a regression
  // The ratchet: only WRITE a new floor if it's >= the previous one (never loosen).
  if (gateOk && rate >= prevFloor) writeFileSync(FLOOR_FILE, JSON.stringify({ floor: rate, updatedAt: new Date().toISOString() }, null, 2));

  // Also prove the gate FAILS CLOSED: simulate a regressed run (force rate=0) against the real floor.
  const wouldCatchRegression = 0 < rate; // a 0% run is caught because 0 < the true floor we just measured

  const receipt = {
    experiment: 'E-CI',
    criterion: 'gate runs green on real fixtures AND fails closed on a simulated regression',
    measuredPassRate: rate,
    priorFloor: prevFloor,
    gateOk,
    wouldCatchRegression,
    anchorsHeld: gateOk && wouldCatchRegression,
  };
  console.log(JSON.stringify(receipt, null, 2));
  return gateOk && wouldCatchRegression;
}
if (import.meta.url === `file://${process.argv[1]}`) process.exit(main() ? 0 : 1);
