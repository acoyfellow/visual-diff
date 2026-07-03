# /loop — evolve visual-diff: experiment-driven, spike-then-decide

Purpose: run bounded experiments that make visual-diff harder (speed/security/validity/tests/proofs) AND explore where it can grow (new tiers, video, producers) and what commercial wedges are worth a spike. Every experiment is a real spike with a kill/keep criterion; keep only what a receipt earns. Backward from the north star, parallel where independent, honest (receipts not vibes), self-hardening in the repo's own idiom.

## North star
visual-diff is the trusted, fail-closed verdict engine over a normalized render — extensible to new tiers, motion, and many render producers — and the oracle an agent (or CI) calls to PROVE a UI change is 1:1. It hardens itself: each gate ratchets, each new capability ships with its own sanity anchor.

## Invariants (the repo's own idiom — never violate)
- **Fail-closed AND.** A new tier joins the cascade as another AND term, never a soft signal. PASS still means every tier agrees.
- **Sanity-anchor everything.** No capability is trusted unless it PASSES a known-identical pair AND FLAGS a known-broken one. New tier/producer/mode ships with anchors or it doesn't ship.
- **Receipts, not vibes.** Verdicts, perf numbers, coverage — all from a real run, committed as fixtures/artifacts. Never fabricate a metric; label the unreachable.
- **Framework-agnostic + lightweight.** Runtime deps stay minimal (pixelmatch/pngjs/ws); heavy things (a perceptual lib, a11y engine) are optional/lazy, never forced into the core.
- **Pure tiers stay pure.** Tiers operate on the normalized render object; browser/producer code is a separate seam. Don't couple a tier to CDP.

## Self-hardening gates (each a committed ratchet — can only tighten)
- SPEED: pure-cascade-over-fixtures under a committed ms ceiling; ceiling only decreases. Browser path timed as an artifact, not gated (network-variable).
- SECURITY: `npm ci` frozen-lockfile + `npm audit` fail-on-high; document the "extractor renders arbitrary HTML in a real browser = untrusted-in ⇒ untrusted-browser" boundary explicitly; audit the Chromium spawn flags.
- VALIDITY: `npm run proof` (sanity anchors) runs in CI on every push, fail-closed; anchor set grows one per defect class (missing element, style delta, pixel shift, +future a11y/temporal).
- TESTS: coverage floor that only rises; mutation check on tier logic (a gate that can't catch its own mutants isn't a gate — the sanity-anchor idea applied to the test suite); browser/producer tests behind a capability guard so CI runs them, local skips.
- PROOFS: `npm run proof` emits versioned REPORT.html + a machine-readable receipt JSON as a CI artifact, across >=2 viewports.

## Experiments (spike, then decide by the criterion — parallel where independent)
Ranked by leverage. Each: build the smallest real spike, run it, keep ONLY if the criterion passes; otherwise record why and kill.

### CAPABILITY spikes (what it can become)
- E-VID (video/temporal diff — biggest technical leap): extend cascade to a SEQUENCE of renders; flag the first frame where tiers diverge. KEEP IF a real anim-regression fixture (a hover that breaks mid-transition) is caught AND a matching pair passes; pure, deterministic, under the speed ceiling.
- E-A11Y (Tier D, semantic/a11y): diff the accessibility tree (extractor already has role/aria-*). KEEP IF it catches a "looks identical, a11y-broken" fixture the other tiers miss, joins as a real AND term, ships with anchors.
- E-PERCEPT (perceptual pixel tier): augment Tier C with SSIM/perceptual metric behind an opt-in flag. KEEP IF it suppresses a known anti-alias false-positive WITHOUT missing a real 1px-shift defect (sanity anchors both directions); optional dep, lazy.
- E-PROD (producer-agnostic renders): add a 2nd render producer (live URL, or a Storybook/Figma export → the normalized render). KEEP IF the SAME cascade gives a correct verdict on a producer other than the built-in extractor.

### COMMERCIAL spikes (what wedge is worth exploring — build the smallest proof-of-wedge, DO NOT ship a business)
- E-MCP (agent-verification wedge — strongest): a tiny MCP server exposing visual_diff.verify(before, after) → fail-closed verdict + report. KEEP IF an agent harness can call it and get a correct 1:1/BROKEN verdict on the real receipts; this is the "oracle an agent calls to prove its UI change" wedge. (Ties directly to the recurring session pain: class right, element gone.)
- E-CI (reftest-as-CI): a GitHub Action that runs the cascade on a PR, posts REPORT.html + verdict, and enforces a ratcheting fidelity floor. KEEP IF it runs green on this repo's own PRs and fails a deliberately-broken one.
- E-FIDELITY (design↔impl number): from a design-source producer + cascade, emit a single trustworthy fidelity number + the exact differing elements. KEEP IF the number moves correctly as a fixture degrades (monotonic, explainable), not a vanity %.
- E-RECEIPT (shareable proof receipt): the sanityCheck + REPORT as a signed/shareable artifact ("this deploy passed 1:1"). KEEP IF the receipt is verifiable/tamper-evident and carries the tier breakdown.

## Loop rhythm
1. Pick the highest-leverage un-run experiment (or a gate not yet enforced). 2. Build the smallest real spike in the repo's idiom. 3. Run it; produce a receipt (fixture/artifact/screenshot). 4. Dane review (read-only): fail-closed? sanity-anchored? pure tiers pure? receipt real? lightweight? 5. KEEP (commit, add its ratchet/anchor) or KILL (record why, revert). 6. Advance the ratchet that the spike unlocked. Parallelize independent spikes.

## Dane (ZERO to advance)
The spike upholds every invariant (fail-closed AND, sanity-anchored, receipts-not-vibes, lightweight, pure tiers pure); the kept capability has its own anchor + test; the gate it touches ratchets tighter, never looser; commercial spikes are proof-of-wedge only (no half-built business, no fabricated market claim).

## DONE (a cycle)
The chosen experiments are decided by receipts (kept-with-anchor or killed-with-reason); at least one self-hardening gate now enforced in CI; the cascade still fail-closed and green; the README/feature-matrix reflect current truth (new tier/mode documented, killed ideas not oversold). Report: what evolved, what the wedge spikes showed, which gate hardened, what's next.

## Safety / honesty
No fabricated verdicts, perf, coverage, or market claims — real run or labeled-unreachable. Runtime deps stay minimal; heavy capability deps are optional/lazy. The extractor's untrusted-HTML boundary is documented before any "point it at a live URL" feature. Public safety: no secrets/private hosts in source, tests, or artifacts. Commercial spikes explore the wedge; they do not commit a pivot — that's Jordan's call on the receipts.
