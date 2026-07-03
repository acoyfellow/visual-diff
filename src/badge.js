// A shields.io "endpoint badge" JSON formatter over fidelity(). Pure
// formatting, no new judgment: the badge's message and color are a direct,
// deterministic function of the score fidelity() already computed and proved
// monotonic + explainable. See https://shields.io/endpoint for the schema.
//
// Usage: write the returned object to a JSON file your CI publishes (e.g. to
// a gh-pages branch or a gist), then reference it from a shields.io endpoint
// badge URL: https://img.shields.io/endpoint?url=<path-to-that-json>

/** @type {Array<[minScore:number, color:string]>} thresholds, checked high to low */
const COLOR_THRESHOLDS = [
  [1, 'brightgreen'],
  [0.95, 'green'],
  [0.85, 'yellowgreen'],
  [0.7, 'yellow'],
  [0.5, 'orange'],
  [0, 'red'],
];

function colorFor(score) {
  for (const [min, color] of COLOR_THRESHOLDS) {
    if (score >= min) return color;
  }
  return 'red';
}

/**
 * @param {{score:number}} fidelityResult  the object returned by fidelity()
 * @param {{label?:string}} [opts]
 * @returns {{schemaVersion:1, label:string, message:string, color:string}}
 *   a shields.io endpoint-badge payload
 */
export function badgeFromFidelity(fidelityResult, opts = {}) {
  const pct = Math.round(fidelityResult.score * 1000) / 10; // one decimal place
  return {
    schemaVersion: 1,
    label: opts.label ?? 'fidelity',
    message: `${pct}%`,
    color: colorFor(fidelityResult.score),
  };
}

/**
 * @param {{pass:boolean}} verifyResult  the object returned by verify()
 * @param {{label?:string}} [opts]
 * @returns {{schemaVersion:1, label:string, message:string, color:string}}
 */
export function badgeFromVerify(verifyResult, opts = {}) {
  return {
    schemaVersion: 1,
    label: opts.label ?? 'visual-diff',
    message: verifyResult.pass ? '1:1' : 'broken',
    color: verifyResult.pass ? 'brightgreen' : 'red',
  };
}
