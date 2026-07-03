// Signed, tamper-evident verdict receipts — a shareable "this passed 1:1"
// artifact a THIRD PARTY can verify without re-running the cascade.
//
// Uses HMAC-SHA256 over a canonical (sorted-key) JSON serialization of the
// verdict payload, so the same logical object always signs identically. The
// signing secret never leaves the signer (verifyReceipt requires it, exactly
// like verifying with the shared key it was signed with) — this is a
// shared-secret integrity scheme (tamper-evidence), not a public-key signature
// scheme; document that boundary to callers who need non-repudiation.

import { createHmac, timingSafeEqual } from 'node:crypto';

function canon(obj) {
  if (Array.isArray(obj)) return `[${obj.map(canon).join(',')}]`;
  if (obj && typeof obj === 'object') {
    return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canon(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(obj);
}

/**
 * @param {{pass:boolean, tiers:Object}} verdict  a cascade()/verify() result
 * @param {string} secret  the signer's HMAC key (never embedded in the receipt)
 * @param {{at?:string}} [opts] optional fixed timestamp (defaults to now)
 * @returns {{payload:Object, sig:string}}
 */
export function signReceipt(verdict, secret, opts = {}) {
  const payload = {
    verdict: verdict.pass ? '1:1' : 'BROKEN',
    tiers: verdict.tiers,
    at: opts.at ?? new Date().toISOString(),
  };
  const sig = createHmac('sha256', secret).update(canon(payload)).digest('hex');
  return { payload, sig };
}

/**
 * @param {{payload:Object, sig:string}} receipt
 * @param {string} secret  the same key used to sign
 * @returns {boolean} true iff the receipt's signature matches its payload
 */
export function verifyReceipt(receipt, secret) {
  const expected = createHmac('sha256', secret).update(canon(receipt.payload)).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(receipt.sig ?? '', 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
