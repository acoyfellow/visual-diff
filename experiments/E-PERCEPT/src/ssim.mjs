// E-PERCEPT spike: a perceptual pixel tier. Raw pixelmatch flags sub-visual
// anti-alias shimmer as a defect (false positive). A perceptual metric (a small
// windowed SSIM) should PASS an anti-alias-noise pair while still FLAGGING a
// real 1px shift. KEEP IF the sanity anchors hold BOTH directions on synthetic
// PNGs (no browser, deterministic). Optional/lazy dep in the real design.
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const W = 64, H = 64;
function png(fn) {
  const p = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const [r, g, b] = fn(x, y);
    p.data[i] = r; p.data[i + 1] = g; p.data[i + 2] = b; p.data[i + 3] = 255;
  }
  return p;
}
// A filled box from (bx..bx+20, 16..48).
const box = (bx) => png((x, y) => (x >= bx && x < bx + 20 && y >= 16 && y < 48) ? [40, 40, 40] : [255, 255, 255]);
// Same box + faint anti-alias-style noise on the edge (sub-visual).
const boxNoisy = (bx) => png((x, y) => {
  const inside = x >= bx && x < bx + 20 && y >= 16 && y < 48;
  const edge = (x === bx || x === bx + 19 || y === 16 || y === 47);
  const jitter = edge ? ((x * 7 + y * 13) % 3) - 1 : 0; // ±1 on the edge only
  const v = inside ? 40 + jitter : 255 + (edge ? jitter : 0);
  return [Math.max(0, Math.min(255, v)), Math.max(0, Math.min(255, v)), Math.max(0, Math.min(255, v))];
});

// Grayscale windowed SSIM (global mean/var/cov — enough to separate noise from shift).
function gray(p) { const g = new Float64Array(W * H); for (let i = 0; i < W * H; i++) g[i] = (p.data[i*4] + p.data[i*4+1] + p.data[i*4+2]) / 3; return g; }
function ssim(a, b) {
  const A = gray(a), B = gray(b), n = A.length;
  let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += A[i]; mb += B[i]; } ma /= n; mb /= n;
  let va = 0, vb = 0, cov = 0;
  for (let i = 0; i < n; i++) { const da = A[i] - ma, db = B[i] - mb; va += da*da; vb += db*db; cov += da*db; }
  va /= n; vb /= n; cov /= n;
  const C1 = (0.01*255)**2, C2 = (0.03*255)**2;
  return ((2*ma*mb + C1) * (2*cov + C2)) / ((ma*ma + mb*mb + C1) * (va + vb + C2));
}
// Perceptual verdict: SSIM above threshold = perceptually identical.
export function diffPerceptual(a, b, { minSsim = 0.995 } = {}) {
  const s = ssim(a, b);
  return { pass: s >= minSsim, ssim: +s.toFixed(5) };
}
// Raw pixelmatch count for comparison.
function rawDiff(a, b) {
  const out = new PNG({ width: W, height: H });
  const px = pixelmatch(a.data, b.data, out.data, W, H, { threshold: 0.1, includeAA: false });
  return px;
}

function main() {
  const base = box(20);
  const noisy = boxNoisy(20);   // ANCHOR 1: sub-visual AA noise -> should PASS perceptually
  const shifted = box(21);      // ANCHOR 2: real 1px shift -> should FLAG

  const rawNoisy = rawDiff(base, noisy);
  const rawShift = rawDiff(base, shifted);
  const percNoisy = diffPerceptual(base, noisy);
  const percShift = diffPerceptual(base, shifted);

  // The wedge: raw flags BOTH; perceptual should PASS noise, FLAG the shift.
  const rawFlagsBoth = rawNoisy > 0 && rawShift > 0;
  const perceptualSeparates = percNoisy.pass === true && percShift.pass === false;

  const receipt = {
    experiment: 'E-PERCEPT',
    criterion: 'perceptual PASSES anti-alias noise AND FLAGS a real 1px shift (raw pixelmatch flags both)',
    raw: { noisyDiffPx: rawNoisy, shiftDiffPx: rawShift, flagsBoth: rawFlagsBoth },
    perceptual: { noisy: percNoisy, shift: percShift },
    perceptualSeparates,
  };
  console.log(JSON.stringify(receipt, null, 2));
  return perceptualSeparates;
}
if (import.meta.url === `file://${process.argv[1]}`) process.exit(main() ? 0 : 1);
