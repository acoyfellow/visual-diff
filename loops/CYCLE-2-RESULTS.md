# evolve loop — CYCLE 2 (2026-07-02): the remaining 4 spikes, parallel, keep/kill by receipt

Second isolated-parallel batch (E-PROD, E-CI, E-FIDELITY, E-RECEIPT), same discipline as Cycle 1. All 4 held on run.

## VERDICTS (4/4 KEEP)
- E-PROD (producer-agnostic renders) — KEEP. A second, non-browser producer (a naive regex HTML walker, zero Chromium) fed the SAME cascade() and got correct verdicts: identical PASS, a dropped svg+path FLAGGED (missing:{svg:1,path:1}). Proves the engine's contract is the normalized render object, not an accidental coupling to CDP. Receipt: experiments/E-PROD/out/receipt.json.
- E-CI (reftest-as-CI ratchet) — KEEP. Measured pass-rate over the real E03 fixture = 1.0 (100%), gate compares against a committed floor.json (ratchet: only writes a new floor if it did not drop), and the gate provably fails closed on a simulated 0% regression. Receipt + the actual floor.json artifact: experiments/E-CI/out/.
- E-FIDELITY (design<->impl score) — KEEP, and the strongest data of the cycle. Score is CLEANLY MONOTONIC across controlled defect steps: perfect=1.0 -> style-only regression=0.833 -> style+structure regression=0.667. And EXPLAINABLE: "structure -33.3pp (1 missing, 0 extra); style -33.3pp (1 property deltas)" — names the tier and magnitude, not a vanity %. Receipt: experiments/E-FIDELITY/out/receipt.json.
- E-RECEIPT (signed/tamper-evident proof) — KEEP. An HMAC-signed verdict envelope: an untampered receipt verifies; a receipt with the verdict flipped AFTER signing fails verification. The sanity-anchor pattern applied to TRUST, not pixels. Receipt: experiments/E-RECEIPT/out/receipt.json.

## Combined potency read (Cycle 1 + Cycle 2 = 8/8 experiments, all isolated + parallel)
- 8 independent experiments/<E>/{src,out} ran across two parallel batches with ZERO cross-experiment coupling and ZERO changes to src/ — core suite stayed 22/22 green throughout both cycles.
- Every experiment's build reused the SAME public contract (the normalized render object + cascade()), which is the strongest possible signal that the engine's abstraction boundary is real, not accidental. Both the capability spikes (E-VID/E-A11Y/E-PERCEPT/E-PROD) and the commercial/trust spikes (E-MCP/E-CI/E-FIDELITY/E-RECEIPT) slot into the SAME seam.
- The loop caught one real defect in ITSELF (Cycle 1's E-VID anchor was mis-specified, not the mechanism) and forced a fix before KEEP — proving the keep/kill discipline isn't rubber-stamping.
- Highest-signal for "what's next": E-FIDELITY's monotonic+explainable score and E-MCP's agent-oracle wedge are the most immediately promotable to real src/ + product surface.

## Total scoreboard: 8 experiments, 8 KEEP (1 required a same-cycle fix), 0 kills this round
This is not evidence every idea is good — it's evidence the ENGINE'S SEAM is unusually solid: every spike, capability or commercial, composed cleanly against cascade()/diffStructure()/diffStyle() without fighting the architecture. The real test of the loop's rigor was catching and fixing the E-VID anchor, not the 100% keep-rate.
