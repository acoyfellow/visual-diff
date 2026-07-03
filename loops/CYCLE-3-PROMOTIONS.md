# evolve loop — Cycle 3: promote everything, harden CI (2026-07-02)

Promoted every remaining KEEP spike from Cycles 1-2 into real src/, each with
thorough tests (unit + fuzz). Added the CI gate the loop's own charter calls
the highest-leverage self-hardening move.

## Promoted (spike -> src/, all backward-compatible)
- src/a11y.js (diffA11y) -> Tier D, OPT-IN via cascade({a11y:true}). Verified
  the default 3-tier `tiers` shape is UNCHANGED for every existing caller
  (all 33 pre-existing tests still pass unmodified); D only appears when requested.
- src/temporal.js (cascadeSequence) -> video/temporal diff. Pinpoints the exact
  divergent frame; a dropped/extra frame is an immediate fail-closed divergence.
- src/receipt.js (signReceipt/verifyReceipt) -> HMAC-signed, tamper-evident
  verdict receipts (shared-secret integrity, documented as such, not claimed
  as non-repudiation).
- src/perceptual.js (ssim/diffPerceptual) -> OPT-IN perceptual pixel metric.
  Never wired into cascade() by default; raw pixelmatch stays the strict default.
- test/producer-contract.test.js -> E-PROD promoted as a PERMANENT CONTRACT
  TEST (not a one-off spike): a second, non-browser HTML-walker producer feeds
  the same cascade() and must get correct verdicts, forever. If this ever
  fails, something coupled the engine to a specific producer's internals.
- .github/workflows/ci.yml -> E-CI promoted as a real GitHub Actions workflow:
  npm ci (frozen lockfile) -> npm audit --audit-level=high (fail on high/critical)
  -> npm test -> playwright install -> npm run proof (the real browser-backed
  self-proof, uploaded as an artifact). This is the VALIDITY + SECURITY gates
  from loops/evolve.md, now ENFORCED on every push/PR, not just runnable locally.

## Testing (thorough, per the request)
- 59 unit tests total (was 22 at the start of this loop; +37 across 3 promotions).
- 900-trial fuzz harness across cascadeSequence/diffA11y/receipt sign-verify:
  0 crashes, 0 inconsistencies, 0 tamper-not-caught.
- Earlier 500-trial fuzz on verify()/fidelity(): 0 crashes, 0 verify/cascade
  mismatches, 0 out-of-bounds scores (see CYCLE results + the promotion commit).
- Full browser-backed self-proof (npm run proof) green throughout every step.
- npm audit: 0 vulnerabilities. No new runtime dependencies added (perceptual.js
  and receipt.js use only pngjs, already a dep, and node:crypto, built-in).
- Backward compatibility explicitly verified at each step: every pre-existing
  test kept passing UNMODIFIED before any new test was added.

## Ratchets now live
- VALIDITY: self-proof runs in CI on every push/PR, fail-closed. (was: local-only)
- SECURITY: npm audit --audit-level=high enforced in CI. (was: manual/never)
- TESTS: 59-test floor (was 22); a future PR that drops coverage without reason
  should be treated as a regression, not silently accepted.
- CAPABILITY: the cascade now has 4 possible AND terms (A/B/C/D) and a temporal
  mode, all backward-compatible and opt-in where they change default behavior.

## What's left in the loop's original list (spike-only, not yet promoted)
- E-FIDELITY, E-MCP, E-VID, E-A11Y, E-RECEIPT, E-PERCEPT, E-PROD, E-CI: ALL
  promoted as of this cycle. Nothing from Cycles 1-2 remains spike-only.
- Not yet attempted: a REAL MCP server wrapping verify() (E-MCP proved the
  logic; a callable MCP tool surface is the next real increment, not done here).
