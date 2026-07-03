// An OPT-IN perceptual pixel metric (windowed global SSIM) that separates
// sub-visual anti-alias shimmer from a real visual shift. Raw pixelmatch
// (diffPixels) is exact-and-strict by design — that is the correct DEFAULT for
// a fail-closed gate. This module exists for callers who explicitly want to
// suppress known sub-pixel AA noise WITHOUT missing a real defect; it never
// replaces diffPixels and is never wired into cascade() by default.

/** Grayscale luminance array from a pngjs PNG-like {width,height,data}. */
function gray(png) {
  const { width, height, data } = png;
  const g = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) {
    g[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
  }
  return g;
}

/** Global SSIM over two equal-sized grayscale images (0..1, 1 = identical). */
export function ssim(a, b) {
  if (a.width !== b.width || a.height !== b.height) return 0;
  const A = gray(a);
  const B = gray(b);
  const n = A.length;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) { ma += A[i]; mb += B[i]; }
  ma /= n; mb /= n;
  let va = 0;
  let vb = 0;
  let cov = 0;
  for (let i = 0; i < n; i++) {
    const da = A[i] - ma;
    const db = B[i] - mb;
    va += da * da; vb += db * db; cov += da * db;
  }
  va /= n; vb /= n; cov /= n;
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  return ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
}

/**
 * @param {{width,height,data}} baselinePng
 * @param {{width,height,data}} candidatePng
 * @param {{minSsim?:number}} [opts]  default 0.995 — chosen to pass typical
 *   anti-alias jitter while still flagging a whole-pixel content shift
 * @returns {{pass:boolean, ssim:number}}
 */
export function diffPerceptual(baselinePng, candidatePng, opts = {}) {
  const minSsim = opts.minSsim ?? 0.995;
  const s = ssim(baselinePng, candidatePng);
  return { pass: s >= minSsim, ssim: Math.round(s * 100000) / 100000 };
}
