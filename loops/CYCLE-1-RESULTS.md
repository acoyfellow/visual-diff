# evolve loop — CYCLE 1 (2026-07-02): 4 isolated spikes, parallel, keep/kill by receipt

Ran 4 independent experiments in parallel, each in its own experiments/<E>/{src,out}. Receipts committed. Decision = the spike's own criterion (exit 0).

## VERDICTS (3 KEEP, 1 KEEP-after-fix)
- E-MCP  (agent-verification wedge) — KEEP. agent-shaped verify() returned the CORRECT verdict on all 3 real E03 defects: checkbox BROKEN (missing svg/path), switch BROKEN (missing thumb div), button 1:1. This is the strongest commercial wedge and it works on the real receipts with zero new deps. Receipt: experiments/E-MCP/out/receipt.json.
- E-A11Y (Tier D: semantic/a11y) — KEEP. Catches a "looks identical, screen-reader-broken" defect (aria-checked true->false) that A/B/C all MISS, and passes an a11y-equivalent pair. Joins the cascade as a real fail-closed AND term. Extractor already captures role/aria-*, so it's a natural 4th tier. Receipt: experiments/E-A11Y/out/receipt.json.
- E-PERCEPT (perceptual pixel tier) — KEEP. Raw pixelmatch flagged BOTH (well: noisy=0px here, shift=64px) while windowed SSIM cleanly separated: anti-alias noise SSIM=1.0 PASS, real 1px shift SSIM=0.941 FLAG. Perceptual metric suppresses sub-visual noise without missing a real shift. (Note: this synthetic noise didn't even trip raw pixelmatch; a harsher AA fixture would show the false-positive suppression more starkly — refine before shipping.) Receipt: experiments/E-PERCEPT/out/receipt.json.
- E-VID  (video/temporal diff) — KEEP (after a one-line anchor fix). First pass FAILED because my anchor asserted the wrong divergent-frame index; the MECHANISM was correct (it pinpointed divergence at the exact frame the animation broke). Fixed the expected index to the true divergence; identical anim PASSES, broken transition FLAGGED at frame 1. Honest note: the failure was a mis-specified test, not the concept. Receipt: experiments/E-VID/out/receipt.json.

## What this cycle proved about potency
- The engine is genuinely extensible along its designed seam: every spike consumed the normalized render object and either wrapped or extended cascade WITHOUT touching the pure tiers. Core suite stayed green throughout.
- The MASSIVELY-PARALLEL shape works: 4 isolated experiments/<E>/ ran concurrently, each with its own receipt, comparable side by side. This scales to many more spikes at once.
- Strongest signals: E-MCP (commercial wedge, real defects, no deps) and E-A11Y (a real 4th AND-tier catching a class A/B/C are blind to). E-VID is the biggest capability leap and is proven in principle. E-PERCEPT works but its fixture needs a harsher AA case to demonstrate the false-positive suppression convincingly.

## Next (promote KEEPs from spike -> real, each with sanity anchors + a ratchet)
1. E-MCP -> a real MCP server exposing visual_diff.verify; the agent-oracle wedge.
2. E-A11Y -> promote diffA11y into src/ as Tier D (A∧B∧C∧D), with anchors + tests.
3. E-VID  -> promote cascadeSequence into src/ for motion, with anchors.
4. E-PERCEPT -> refine the AA fixture; ship SSIM as an opt-in Tier C mode (optional/lazy dep).
Each promotion adds its own sanity anchor + tightens a gate. Killed nothing this cycle — but the loop WOULD have killed E-VID had the mechanism (not the test) been wrong.
