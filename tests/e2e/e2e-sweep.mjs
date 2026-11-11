// Browser-Test (Playwright) – Ausführen über: npm run test:e2e
// Rundgang über alle Seiten auf mehreren Geräten: Overflow, JS-Fehler, kleine Tippflächen, kaputte Ressourcen
import { chromium, devices } from 'playwright';
import { mockFirebase } from './mock-firebase.mjs';

const BASE = process.env.BASE || 'http://localhost:8765/';
const OUT = process.env.OUT || 'shots';
let failures = 0;
const check = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++; };

const DEVICES = [
  ['iPhone SE', devices['iPhone SE']],
  ['Pixel 5', devices['Pixel 5']],
  ['iPad Mini', devices['iPad Mini']],
  ['Desktop', { viewport: { width: 1440, height: 900 } }],
];

const browser = await chromium.launch();
const ids = await (async () => {
  const p = await browser.newPage();
  await p.goto(BASE);
  const list = await p.evaluate(async () => (await import('./js/activities.js')).ACTIVITIES.map((a) => a.id));
  await p.close();
  return list;
})();
const routes = ['', 'finder/1', 'finder/3', 'finder/5', 'finder/8', 'results', 'all', 'favorites', 'completed', 'inbox', 'settings', 'trip', ...ids.map((i) => `activity/${i}`)];

for (const [name, opts] of DEVICES) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await mockFirebase(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const bad = new Set();
  page.on('response', (r) => { if (r.status() >= 400) bad.add(`${r.status()} ${r.url()}`); });
  await page.goto(BASE);
  await page.fill('#login-email', 'nils@test');
  await page.fill('#login-password', 'correct');
  await page.press('#login-password', 'Enter');
  await page.waitForSelector('.view-home');
  // Quiz-Stand, damit /results etwas zeigt
  await page.evaluate(() => localStorage.setItem('onelife:u-nils:quiz', JSON.stringify({ answers: { mood: ['nature'] }, skipped: [], completedAt: new Date().toISOString() })));

  const overflowRoutes = [];
  const smallTargets = new Map();
  for (const r of routes) {
    await page.goto(`${BASE}#/${r}`);
    await page.waitForSelector('#main .view');
    await page.waitForTimeout(r.startsWith('finder') ? 450 : 120);
    const res = await page.evaluate((vw) => {
      const over = document.documentElement.scrollWidth > window.innerWidth || window.innerWidth !== vw;
      const small = [];
      for (const elx of document.querySelectorAll('#main button, #main a.btn, #main .chip, #main .seg, #main .star, #main .pill span, .nav a, .topbar a, .topbar button')) {
        const b = elx.getBoundingClientRect();
        if (!b.width || !b.height || getComputedStyle(elx).visibility === 'hidden') continue;
        if (b.height < 32 || b.width < 32) small.push(`${elx.tagName.toLowerCase()}.${elx.className.split(' ')[0]} "${elx.textContent.trim().slice(0, 20)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      return { over, small };
    }, page.viewportSize().width);
    if (res.over) overflowRoutes.push(r || 'home');
    for (const s of res.small) smallTargets.set(s, r || 'home');
  }
  check(overflowRoutes.length === 0, `[${name}] Kein horizontales Scrollen auf ${routes.length} Seiten ${overflowRoutes.join(', ')}`);
  const smallList = [...smallTargets.entries()].map(([s, r]) => `${s} @${r}`);
  check(smallList.length === 0, `[${name}] Tippflächen >= 32px ${smallList.slice(0, 8).join(' | ')}`);
  check(errors.length === 0, `[${name}] Keine JS-Fehler ${errors.slice(0, 3).join(' | ')}`);
  check(bad.size === 0, `[${name}] Keine fehlerhaften Ressourcen ${[...bad].slice(0, 3).join(' | ')}`);
  await page.goto(BASE + '#/');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/sweep-${name.replace(/\s/g, '')}.png` });
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} FEHLGESCHLAGEN` : '\nALLE TESTS BESTANDEN');
process.exit(failures ? 1 : 0);
