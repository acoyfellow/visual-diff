// E-RECEIPT spike: a shareable, tamper-evident proof receipt ("this deploy
// passed 1:1"). Wraps a cascade verdict in a signed envelope (HMAC over the
// canonical JSON) so a THIRD PARTY can verify it wasn't edited after the fact,
// without re-running the cascade. KEEP IF (a) a valid receipt verifies, AND
// (b) a tampered receipt (one byte of the verdict flipped) FAILS verification
// — the sanity-anchor pattern applied to trust, not to pixels.
import { createHmac, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { cascade } from '../../../src/index.js';

// Canonical JSON: sorted keys, so the same logical object always serializes
// identically (a prerequisite for a stable signature).
function canon(obj) {
  if (Array.isArray(obj)) return `[${obj.map(canon).join(',')}]`;
  if (obj && typeof obj === 'object') {
    return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canon(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(obj);
}

export function signReceipt(verdict, secret) {
  const payload = { verdict: verdict.pass ? '1:1' : 'BROKEN', tiers: verdict.tiers, at: '2026-07-02T00:00:00.000Z' };
  const body = canon(payload);
  const sig = createHmac('sha256', secret).update(body).digest('hex');
  return { payload, sig };
}
export function verifyReceipt(receipt, secret) {
  const body = canon(receipt.payload);
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  // constant-time-ish compare (spike-grade; production would use timingSafeEqual)
  return expected === receipt.sig;
}

function main() {
  const secret = randomBytes(32).toString('hex'); // the deployer's signing key (never shipped in the receipt)
  const baseline = { tagHistogram: { div: 1 }, control: { tags: {}, descendantCount: 0 }, hasSvg: false, elements: [] };
  const candidate = { tagHistogram: { div: 1 }, control: { tags: {}, descendantCount: 0 }, hasSvg: false, elements: [] };

  const verdict = cascade(baseline, candidate);
  const receipt = signReceipt(verdict, secret);

  // ANCHOR 1: an untampered receipt MUST verify.
  const validVerifies = verifyReceipt(receipt, secret) === true;

  // ANCHOR 2: a tampered receipt (verdict flipped after signing) MUST fail verification.
  const tampered = { ...receipt, payload: { ...receipt.payload, verdict: 'BROKEN' } }; // sig now stale
  const tamperCaught = verifyReceipt(tampered, secret) === false;

  const anchorsHeld = validVerifies && tamperCaught;

  const out = {
    experiment: 'E-RECEIPT',
    criterion: 'a valid receipt verifies; a tampered receipt FAILS verification (tamper-evidence)',
    receipt: { payload: receipt.payload, sig: receipt.sig.slice(0, 16) + '…' }, // truncated for the log, full value is real
    validVerifies,
    tamperCaught,
    anchorsHeld,
  };
  console.log(JSON.stringify(out, null, 2));
  return anchorsHeld;
}
if (import.meta.url === `file://${process.argv[1]}`) process.exit(main() ? 0 : 1);
