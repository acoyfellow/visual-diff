// Headless browser driver over raw CDP against a PINNED Playwright Chromium.
//
// We never launch the OS "Chrome" app — only the deterministic, versioned
// "Chrome for Testing" binary that `npx playwright install chromium` downloads
// into the Playwright browsers cache. This keeps screenshots reproducible.
//
// Resolution order for the binary:
//   1. env VISUAL_DIFF_CHROMIUM (explicit override)
//   2. newest chromium-* in the Playwright browsers cache
//      (PLAYWRIGHT_BROWSERS_PATH, or the per-OS default cache dir)
//
// No `playwright` runtime dependency is required — just its downloaded binary —
// so this package stays lightweight while remaining "pinned Playwright chromium".

import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function defaultCacheDir() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return process.env.PLAYWRIGHT_BROWSERS_PATH;
  const home = homedir();
  if (process.platform === 'darwin') return join(home, 'Library', 'Caches', 'ms-playwright');
  if (process.platform === 'win32') return join(home, 'AppData', 'Local', 'ms-playwright');
  return join(home, '.cache', 'ms-playwright');
}

function binaryFor(dir) {
  // Full-chromium build dirs (chromium-<rev>), not headless_shell.
  if (process.platform === 'darwin') {
    return [
      join(dir, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
      join(dir, 'chrome-mac', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
    ];
  }
  if (process.platform === 'win32') return [join(dir, 'chrome-win', 'chrome.exe')];
  return [join(dir, 'chrome-linux', 'chrome')];
}

/** Resolve the pinned Chromium binary path or throw a helpful error. */
export async function resolveChromium() {
  if (process.env.VISUAL_DIFF_CHROMIUM) {
    if (!existsSync(process.env.VISUAL_DIFF_CHROMIUM)) {
      throw new Error(`VISUAL_DIFF_CHROMIUM does not exist: ${process.env.VISUAL_DIFF_CHROMIUM}`);
    }
    return process.env.VISUAL_DIFF_CHROMIUM;
  }
  const cache = defaultCacheDir();
  let entries = [];
  try { entries = await readdir(cache); } catch { /* no cache */ }
  const revs = entries
    .filter((e) => /^chromium-\d+$/.test(e))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const rev of revs) {
    for (const bin of binaryFor(join(cache, rev))) {
      if (existsSync(bin)) return bin;
    }
  }
  throw new Error(
    'No pinned Playwright Chromium found. Run `npx playwright install chromium` ' +
    'or set VISUAL_DIFF_CHROMIUM to a Chrome-for-Testing binary.',
  );
}

/**
 * Launch headless Chromium and open a CDP session.
 * @param {{viewport?:{width:number,height:number}, chromium?:string}} [opts]
 * @returns {Promise<{send:Function, close:Function}>}
 */
export async function openBrowser(opts = {}) {
  const { width = 640, height = 320 } = opts.viewport || {};
  const bin = opts.chromium || (await resolveChromium());
  const profile = `${process.env.TMPDIR || '/tmp'}/visual-diff-${process.pid}-${Date.now()}`;

  const child = spawn(bin, [
    '--headless=new', '--no-first-run', '--disable-extensions',
    '--disable-background-networking', '--force-device-scale-factor=1',
    `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank',
  ], { stdio: 'ignore' });

  let port;
  for (let i = 0; i < 300; i++) {
    try {
      port = (await readFile(`${profile}/DevToolsActivePort`, 'utf8')).split(/\s/)[0];
      break;
    } catch { await sleep(50); }
  }
  if (!port) throw new Error('Chromium did not expose a DevTools port');

  const targets = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
  const target = targets.find((x) => x.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((ok, no) => {
    const n = ++id;
    pending.set(n, (m) => (m.error ? no(new Error(m.error.message)) : ok(m.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false,
  });

  const close = () => {
    try { ws.close(); } catch { /* noop */ }
    try { child.kill(); } catch { /* noop */ }
  };
  return { send, close };
}

export { sleep };
