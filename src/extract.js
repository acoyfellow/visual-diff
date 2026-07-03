// Render extraction: turn a rendered HTML page into the normalized structure the
// three tiers consume — element multisets, per-element computed styles, and a
// screenshot. Framework-agnostic: it walks whatever DOM the browser produced.
//
// PRINCIPLED NORMALIZATION: elements whose computed `display:contents` contribute
// no box and no layout are FLATTENED before comparison. This prevents benign
// content-wrapper spans (common in React output) from creating false structural
// diffs, while genuinely missing boxed elements are still caught.

import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { openBrowser, sleep } from './browser.js';
import { STYLE_PROPS } from './style.js';

/**
 * The in-page DOM walk, serialized to a string for Runtime.evaluate.
 * Returns { tree, elements, elementCount, tagHistogram, roles, hasSvg, control }.
 */
export function walkExpression(mountSelector = '#mount') {
  return `(() => {
  const SEMANTIC_ATTRS = ['role','type','aria-checked','aria-hidden','data-state','data-checked','data-unchecked','data-indeterminate','name','value','disabled','aria-label','open','data-selected'];
  const STYLE_PROPS = ${JSON.stringify(STYLE_PROPS)};
  const INTERACTIVE = '[role="checkbox"],[role="switch"],[role="radio"],button,input,textarea,select,a[href]';
  function roleOf(el){
    const r = el.getAttribute && el.getAttribute('role'); if (r) return r;
    const t = el.tagName.toLowerCase();
    if (t==='input'){const ty=(el.getAttribute('type')||'text').toLowerCase();return ty==='checkbox'?'checkbox':ty==='radio'?'radio':'textbox';}
    const IMP={button:'button',a:'link',label:'(label)',svg:'(graphic)',img:'img',select:'listbox',textarea:'textbox'};
    return IMP[t]||null;
  }
  function attrsOf(el){const o={};for(const a of SEMANTIC_ATTRS){if(el.hasAttribute&&el.hasAttribute(a))o[a]=el.getAttribute(a);}return o;}
  function isContents(el){return getComputedStyle(el).display==='contents';}
  function flatChildren(el){
    const out=[];
    for(const c of Array.from(el.children)){
      if(c.nodeType===1 && isContents(c)) out.push(...flatChildren(c));
      else out.push(c);
    }
    return out;
  }
  function stylesOf(el){const cs=getComputedStyle(el);const o={};for(const p of STYLE_PROPS)o[p]=cs[p];return o;}
  const flatList=[];
  function tree(el, depth){
    const kids=flatChildren(el).map(c=>tree(c, depth+1));
    const node={tag:el.tagName.toLowerCase(),role:roleOf(el),attrs:attrsOf(el),childCount:kids.length,children:kids};
    flatList.push({tag:node.tag,role:node.role,depth,className:(el.getAttribute&&el.getAttribute('class'))||'',ariaHidden:el.getAttribute&&el.getAttribute('aria-hidden')==='true',styles:stylesOf(el)});
    return node;
  }
  const mount=document.querySelector(${JSON.stringify(mountSelector)}) || document.body;
  let root=mount&&mount.firstElementChild;
  while(root && isContents(root)){ const fc=flatChildren(root); root = fc[0]||null; if(fc.length!==1) break; }
  if(!root) return {error:'no-root', mountHtml: mount?mount.innerHTML.slice(0,300):null};
  const t=tree(root,0);
  const tagHistogram={}; const roles={};
  for(const e of flatList){ tagHistogram[e.tag]=(tagHistogram[e.tag]||0)+1; if(e.role) roles[e.role]=(roles[e.role]||0)+1; }
  let control = root.matches(INTERACTIVE) ? root : (root.querySelector(INTERACTIVE)||root);
  const controlDesc = []; (function cwalk(el){ for(const c of flatChildren(el)){ controlDesc.push(c); cwalk(c);} })(control);
  const controlTags={}; for(const el of controlDesc){const t2=el.tagName.toLowerCase();controlTags[t2]=(controlTags[t2]||0)+1;}
  return {
    tree:t,
    elements:flatList,
    elementCount:flatList.length,
    tagHistogram, roles,
    hasSvg: !!root.querySelector('svg'),
    control:{tag:control.tagName.toLowerCase(),role:roleOf(control),descendantCount:controlDesc.length,tags:controlTags},
  };
})()`;
}

/**
 * Wrap an HTML fragment (or full document) into a normalized page. If `html`
 * already looks like a document it is returned as-is; otherwise the fragment is
 * mounted in a white-background page, optionally linking a shared stylesheet.
 */
export function page(html, { cssHref, mountSelector = 'mount' } = {}) {
  if (/<html[\s>]/i.test(html)) return html;
  const link = cssHref ? `<link rel="stylesheet" href="${cssHref}">` : '';
  return `<!doctype html><html><head><meta charset="utf-8">${link}
<style>html,body{margin:0;padding:0;background:#fff;}#${mountSelector}{position:absolute;top:24px;left:24px;}</style>
</head><body><div id="${mountSelector}">${html}</div></body></html>`;
}

/**
 * Load an HTML string into the browser and extract structure + screenshot.
 * @param {{send:Function}} browser  from openBrowser()
 * @param {string} html             full document or fragment
 * @param {{tmpDir:string, name:string, viewport?:{width,height},
 *   cssHref?:string, mountSelector?:string}} opts
 * @returns {Promise<{struct:Object, png:PNG}>}
 */
export async function loadAndExtract(browser, html, opts) {
  const { tmpDir, name, viewport = { width: 640, height: 320 }, cssHref, mountSelector = 'mount' } = opts;
  mkdirSync(tmpDir, { recursive: true });
  const doc = page(html, { cssHref, mountSelector });
  const file = `${tmpDir}/${name}.html`;
  writeFileSync(file, doc);

  await browser.send('Page.navigate', { url: pathToFileURL(file).href });
  for (let i = 0; i < 60; i++) {
    const r = await browser.send('Runtime.evaluate', {
      expression: `document.readyState==='complete' && !!document.querySelector('#${mountSelector}') && !!document.querySelector('#${mountSelector}').firstElementChild`,
      returnByValue: true,
    }).catch(() => ({ result: { value: false } }));
    if (r.result.value) break;
    await sleep(40);
  }
  await sleep(80);

  const res = await browser.send('Runtime.evaluate', {
    expression: walkExpression(`#${mountSelector}`),
    returnByValue: true,
  });
  const shot = await browser.send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: viewport.width, height: viewport.height, scale: 1 },
  });
  return { struct: res.result.value, png: PNG.sync.read(Buffer.from(shot.data, 'base64')) };
}

export { openBrowser };
