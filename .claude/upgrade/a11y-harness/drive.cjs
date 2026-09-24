// Live a11y pass driver: node drive.cjs <label>   (label = before | after)
const path = require('path');
const fs = require('fs');
const PW = path.join(process.env.LOCALAPPDATA, 'npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core');
const { chromium } = require(PW);
const { spawn } = require('child_process');

const ROOT = 'C:/Users/ofirs/Downloads/CLAUDE BOTS/PC-Software/TapAct/desktop-agent';
const OUTDIR = 'C:/Users/ofirs/Downloads/CLAUDE BOTS/PC-Software/TapAct/.claude/upgrade';
const LABEL = process.argv[2] || 'before';
const SHOTS = path.join(OUTDIR, 'screenshots', `a11y-${LABEL}`);
fs.mkdirSync(SHOTS, { recursive: true });
const AXE = fs.readFileSync('C:/Users/ofirs/Downloads/home-hub/node_modules/axe-core/axe.min.js', 'utf8');
const TABS = ['templates', 'detectors', 'custom-rules', 'settings', 'shortcuts', 'tags', 'leads', 'clipboard-history', 'history', 'about'];

const PAGE_HELPERS = `(() => {
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const gradStops = (img) => (img.match(/rgba?\\([^)]+\\)/g) || []).map(parse);
  // Effective background(s) behind el: composite ancestor backgrounds; gradients -> one candidate per stop.
  function bgCandidates(el) {
    let layers = []; let node = el;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      const img = cs.backgroundImage;
      if (img && img !== 'none' && img.includes('gradient')) { layers.push({ grad: gradStops(img), color: parse(cs.backgroundColor) }); if (gradStops(img).every(s => s.a === 1)) break; }
      else { const c = parse(cs.backgroundColor); if (c && c.a > 0) { layers.push({ color: c }); if (c.a === 1) break; } }
      node = node.parentElement;
    }
    let bases = [{ r: 255, g: 255, b: 255, a: 1 }];
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      if (L.grad) { const next = []; for (const b of bases) for (const s of L.grad) next.push(over(s, L.color && L.color.a ? over(L.color, b) : b)); bases = next; }
      else bases = bases.map(b => over(L.color, b));
    }
    return bases;
  }
  function opacityChain(el) { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; }
  function contrastOf(el) {
    const cs = getComputedStyle(el);
    let fg = parse(cs.color); if (!fg) return null;
    const fillTransparent = cs.webkitTextFillColor && parse(cs.webkitTextFillColor) && parse(cs.webkitTextFillColor).a === 0;
    const bgs = bgCandidates(el);
    const op = opacityChain(el);
    const ratios = bgs.map(bg => ratio(over({ ...fg, a: fg.a * op }, bg), bg));
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10);
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    return { min: Math.min(...ratios), size, weight, large, need: large ? 3 : 4.5, fg: cs.color, bg: bgs.map(b => 'rgb(' + [b.r, b.g, b.b].map(Math.round).join(',') + ')'), gradientText: fillTransparent, opacity: op };
  }
  function desc(el) {
    if (!el) return null;
    const t = (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || el.title || '').trim().replace(/\\s+/g, ' ').slice(0, 48);
    return { tag: el.tagName.toLowerCase(), id: el.id || '', cls: (el.className && el.className.baseVal === undefined ? el.className : '').toString().slice(0, 40), type: el.type || '', role: el.getAttribute('role') || '', text: t };
  }
  function focusIndicator(el) {
    const probe = (e) => { const cs = getComputedStyle(e); return { outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor : '', shadow: cs.boxShadow !== 'none' ? cs.boxShadow : '', border: cs.borderColor }; };
    let target = el;
    if (el.matches('.switch input')) target = el.nextElementSibling;
    const p = probe(target);
    const r = target.getBoundingClientRect();
    return { ...p, visibleBox: r.width > 1 && r.height > 1, onSlider: target !== el, hasIndicator: Boolean(p.outline || p.shadow) };
  }
  function contrastSweep(scopeSel) {
    const out = []; const seen = new Set();
    const scopes = [...document.querySelectorAll(scopeSel)];
    for (const scope of scopes) {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      let n; while ((n = walker.nextNode())) {
        if (!n.textContent.trim()) continue;
        const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
        const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
        if (el.closest('.hidden') || el.closest('[disabled]') || el.disabled) continue;
        if (getComputedStyle(el).visibility === 'hidden') continue;
        const c = contrastOf(el); if (!c || c.gradientText) continue;
        if (c.min < c.need) out.push({ el: desc(el), sel: el.className ? '.' + String(el.className).split(' ')[0] : el.tagName.toLowerCase(), text: n.textContent.trim().slice(0, 30), ...c, min: Math.round(c.min * 100) / 100 });
      }
    }
    return out;
  }
  window.__a11y = { desc, focusIndicator, contrastOf, contrastSweep, ratio, parse, bgCandidates };
})();`;

async function setup(page) { await page.evaluate(PAGE_HELPERS); }

async function activeInfo(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { body: true };
    return { ...window.__a11y.desc(el), fi: window.__a11y.focusIndicator(el), inContent: Boolean(el.closest('.content')), inNav: Boolean(el.closest('.sidebar')), panel: el.closest('.tab-panel') ? el.closest('.tab-panel').id : '' };
  });
}

async function gotoTabByKeyboard(page, tab) {
  await page.focus(`.nav-btn[data-tab="${tab}"]`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  return page.evaluate((t) => ({
    panelActive: document.getElementById('tab-' + t).classList.contains('active'),
    ariaCurrent: document.querySelector(`.nav-btn[data-tab="${t}"]`).getAttribute('aria-current'),
    focusStillOnNav: document.activeElement === document.querySelector(`.nav-btn[data-tab="${t}"]`)
  }), tab);
}

async function tabWalk(page, tab, max = 90) {
  const seq = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const a = await activeInfo(page);
    if (a.body) { seq.push({ body: true }); break; }
    if (!a.inContent && seq.length > 0) { seq.push({ left: true, ...a }); break; }
    if (a.inContent) seq.push(a);
  }
  return seq;
}

async function axTreeProblems(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const interactive = new Set(['button', 'checkbox', 'switch', 'textbox', 'combobox', 'spinbutton', 'link', 'radio', 'tab', 'menuitem', 'slider', 'searchbox', 'ListBox']);
  const out = [];
  const all = [];
  for (const n of nodes) {
    if (n.ignored) continue;
    const role = n.role && n.role.value;
    if (!interactive.has(role)) continue;
    const name = (n.name && n.name.value) || '';
    const props = Object.fromEntries((n.properties || []).map(p => [p.name, p.value && p.value.value]));
    const rec = { role, name: name.slice(0, 80), nameFrom: n.name && n.name.sources ? (n.name.sources.find(s => s.value) || {}).type : '', pressed: props.pressed, checked: props.checked, disabled: props.disabled, expanded: props.expanded, focusable: props.focusable };
    all.push(rec);
    if (!name.trim()) out.push(rec);
  }
  await cdp.detach();
  return { unnamed: out, all };
}

async function runAxe(page) {
  return page.evaluate(async (src) => {
    if (!window.axe) { (0, eval)(src); }
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations', 'incomplete'] });
    const pick = (v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 12).map(n => ({ target: n.target.join(' '), summary: (n.failureSummary || '').split('\n').slice(0, 3).join(' | ').slice(0, 220) })), count: v.nodes.length });
    return { violations: r.violations.map(pick), incomplete: r.incomplete.filter(v => v.id === 'color-contrast').map(pick) };
  }, AXE);
}

async function runConfig(lang, theme) {
  const env = { ...process.env, TAPACT_ROOT: ROOT, HARNESS_USERDATA: path.join(__dirname, `ud-${LABEL}-${lang}-${theme}`), H_LANG: lang, H_THEME: theme };
  delete env.ELECTRON_RUN_AS_NODE;
  const port = 9300 + Math.floor(Math.random() * 500);
  const child = spawn(path.join(ROOT, 'node_modules/electron/dist/electron.exe'), [`--remote-debugging-port=${port}`, path.join(__dirname, 'harness-main.js')], { env, stdio: 'ignore' });
  let browser;
  for (let i = 0; i < 60 && !browser; i++) { await new Promise(r => setTimeout(r, 250)); try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); } catch { /* not up yet */ } }
  let page;
  for (let i = 0; i < 60 && !page; i++) { page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('settings.html')); if (!page) await new Promise(r => setTimeout(r, 250)); }
  const app = { close: async () => { try { await browser.close(); } catch {} child.kill(); await new Promise(r => setTimeout(r, 500)); } };
  await page.waitForSelector('#list .card');
  await page.waitForSelector('#customRulesList .tag-card', { state: 'attached' });
  await page.waitForTimeout(400);
  await setup(page);
  const res = { lang, theme, dir: await page.evaluate(() => document.documentElement.dir), tabs: {} };

  // Header + sidebar tab order from document start.
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  const head = [];
  await page.focus('body').catch(() => {});
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); head.push(await activeInfo(page)); }
  res.headerAndNavOrder = head;
  // Footer language control reachable?
  res.footerLang = await page.evaluate(() => { const f = document.getElementById('footerLang'); return { tag: f.tagName, tabIndex: f.tabIndex, role: f.getAttribute('role') }; });

  for (const tab of TABS) {
    const t = {};
    t.activation = await gotoTabByKeyboard(page, tab);
    t.order = await tabWalk(page, tab);
    t.noIndicator = t.order.filter(o => o.fi && !o.fi.hasIndicator).map(o => ({ tag: o.tag, id: o.id, cls: o.cls, text: o.text, fi: o.fi }));
    t.axe = await runAxe(page);
    t.contrastFails = await page.evaluate((id) => window.__a11y.contrastSweep(`#tab-${id}, .sidebar, .top-header, .version-footer`), tab);
    t.ax = await axTreeProblems(page);
    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); document.querySelector('.content').scrollTo({ top: 0 }); });
    await page.screenshot({ path: path.join(SHOTS, `${tab}__1040x780__${theme}__${lang}.png`) });
    res.tabs[tab] = t;
  }

  if (theme === 'dark') res.interactions = await interactions(page);
  // Focus-ring close-ups (keyboard focus on representative controls)
  await gotoTabByKeyboard(page, 'custom-rules');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  await page.screenshot({ path: path.join(SHOTS, `focus-custom-rules__${theme}__${lang}.png`) });
  await gotoTabByKeyboard(page, 'detectors');
  for (let i = 0; i < 2; i++) await page.keyboard.press('Tab');
  await page.screenshot({ path: path.join(SHOTS, `focus-detectors__${theme}__${lang}.png`) });
  await app.close();
  return res;
}

async function tabUntil(page, pred, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const ok = await page.evaluate(pred);
    if (ok) return true;
  }
  return false;
}

async function interactions(page) {
  const out = {};
  // 1. Reorder custom rules with keyboard only.
  await gotoTabByKeyboard(page, 'custom-rules');
  const order = () => page.evaluate(() => [...document.querySelectorAll('#customRulesList .tag-card')].map(c => c.querySelector('.tag-card-head input[type=text]').value));
  const before = await order();
  const reached = await tabUntil(page, () => document.activeElement && document.activeElement.classList.contains('reorder-btn') && !document.activeElement.disabled);
  const focusedBtn = await activeInfo(page);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  const afterEnter = await order();
  const focusAfterEnter = await activeInfo(page);
  // Try again with Space from wherever focus is now (if lost, this shows it).
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  const afterSpace = await order();
  const focusAfterSpace = await activeInfo(page);
  out.reorder = { reached, focusedBtn, before, afterEnter, focusAfterEnter, afterSpace, focusAfterSpace, disabledReachable: await page.evaluate(() => [...document.querySelectorAll('.reorder-btn')].filter(b => b.disabled).length) };

  // 2. Favorite star with keyboard.
  await gotoTabByKeyboard(page, 'templates');
  const favState = () => page.evaluate(() => [...document.querySelectorAll('#list .card')].map(c => ({ label: c.querySelector('.label-input').value, fav: c.querySelector('.fav-star-btn').textContent })));
  const favBefore = await favState();
  await tabUntil(page, () => document.activeElement && document.activeElement.classList.contains('fav-star-btn') && document.activeElement.textContent === '☆');
  const starFocused = await activeInfo(page);
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  out.favorite = { favBefore, starFocused, favAfter: await favState(), focusAfter: await activeInfo(page) };
  // Cap: press star on the remaining unfavorited (4th) -> should show cap message
  await page.evaluate(() => { const b = [...document.querySelectorAll('.fav-star-btn')].find(x => x.textContent === '☆'); b && b.focus(); });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  out.favorite.capMsg = await page.evaluate(() => { const m = document.getElementById('favCapMsg'); return { visible: !m.classList.contains('hidden'), role: m.getAttribute('role'), live: m.getAttribute('aria-live') }; });

  // 3. Detector switch via Space + label association.
  await gotoTabByKeyboard(page, 'detectors');
  await tabUntil(page, () => document.activeElement && document.activeElement.id === 'detectPhoneCheck');
  const sw = await activeInfo(page);
  const was = await page.evaluate(() => document.getElementById('detectPhoneCheck').checked);
  await page.keyboard.press('Space');
  const now = await page.evaluate(() => document.getElementById('detectPhoneCheck').checked);
  const labelTarget = await page.evaluate(() => { const l = document.getElementById('detectPhoneCheck').closest('label'); return { labelControl: l.control ? l.control.id : null }; });
  // mouse click on the row's text: what toggles?
  const beforeClick = await page.evaluate(() => document.getElementById('detectPhoneCheck').checked);
  await page.click('#tab-detectors .detector-item .det-label >> nth=0');
  await page.waitForTimeout(80);
  const afterClick = await page.evaluate(() => ({ checked: document.getElementById('detectPhoneCheck').checked, active: document.activeElement.id }));
  out.detectorSwitch = { focused: sw, spaceToggles: was !== now, labelTarget, rowClick: { beforeClick, afterClick } };

  // 4. Shortcut capture via keyboard only.
  await gotoTabByKeyboard(page, 'shortcuts');
  await tabUntil(page, () => document.activeElement && document.activeElement.id === 'shortcutManualInput');
  const scFocused = await activeInfo(page);
  await page.keyboard.press('Enter');
  const capturingAfterEnter = await page.evaluate(() => document.getElementById('shortcutManualInput').classList.contains('capturing'));
  await page.keyboard.press('Control+Alt+K');
  const recorded = await page.evaluate(() => ({ value: document.getElementById('shortcutManualInput').value, capturing: document.getElementById('shortcutManualInput').classList.contains('capturing') }));
  out.shortcutCapture = { scFocused, capturingAfterEnter, recorded };

  // 5. Segmented buttons: exposed state?
  await gotoTabByKeyboard(page, 'settings');
  out.segState = await page.evaluate(() => [...document.querySelectorAll('.seg-btn')].map(b => ({ text: b.textContent.trim(), active: b.classList.contains('active'), pressed: b.getAttribute('aria-pressed') })));

  // 6. Delete a tag rule by keyboard - where does focus go?
  await gotoTabByKeyboard(page, 'tags');
  await tabUntil(page, () => document.activeElement && document.activeElement.classList.contains('danger') && !!document.activeElement.closest('.tag-card'));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  out.deleteFocus = await activeInfo(page);
  return out;
}

(async () => {
  const results = [];
  const CONFIGS = (process.argv[3] || 'he-dark,he-light,en-dark').split(',').map(x => x.split('-'));
  for (const [lang, theme] of CONFIGS) {
    try { results.push(await runConfig(lang, theme)); }
    catch (e) { results.push({ lang, theme, error: String(e && e.stack || e) }); }
  }
  fs.writeFileSync(path.join(OUTDIR, `a11y-${LABEL}-${process.argv[3] || "all"}.json`), JSON.stringify(results, null, 2));
  console.log('WROTE', path.join(OUTDIR, `a11y-${LABEL}.json`));
})();
