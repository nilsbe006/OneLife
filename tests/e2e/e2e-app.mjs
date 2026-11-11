// Browser-Test (Playwright) – Ausführen über: npm run test:e2e
import { chromium, devices } from 'playwright';
import { mockFirebase } from './mock-firebase.mjs';

const BASE = process.env.BASE || 'http://localhost:8765/';
const OUT = process.env.OUT || 'shots';
let failures = 0;
const check = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++; };

const browser = await chromium.launch();
for (const [name, opts] of [['mobile', devices['iPhone 13']], ['desktop', { viewport: { width: 1366, height: 860 } }]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await mockFirebase(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const bad = [];
  page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });

  await page.goto(BASE);
  await page.waitForSelector('#screen-login:not([hidden])');

  // Kein Mitglied -> abgewiesen
  await page.fill('#login-email', 'stranger@test');
  await page.fill('#login-password', 'correct');
  await page.click('#login-submit');
  await page.waitForFunction(() => document.querySelector('#login-error').textContent.includes('nicht freigeschaltet'));
  check(await page.locator('#screen-app').isHidden(), `[${name}] Account ohne members-Eintrag wird abgewiesen`);
  check((await page.textContent('#login-error')).includes('UID: u-x'), `[${name}] Meldung zeigt UID`);

  await page.fill('#login-email', 'locked@test');
  await page.fill('#login-password', 'correct');
  await page.click('#login-submit');
  await page.waitForFunction(() => document.querySelector('#login-error').textContent.includes('Firestore-Regeln'));
  check(await page.locator('#screen-app').isHidden(), `[${name}] Fehlende Regeln -> eigene Meldung`);

  // Richtiges Passwort
  await page.fill('#login-email', 'nils@test');
  await page.fill('#login-password', 'correct');
  await page.press('#login-password', 'Enter');
  await page.waitForSelector('#screen-app:not([hidden])');
  check(true, `[${name}] Korrektes Passwort -> App freigeschaltet`);
  check((await page.textContent('.hero-title')).toUpperCase().includes('NO LIMITS'), `[${name}] Hero-Überschrift`);
  check((await page.textContent('.hero-lead')).includes('legendär'), `[${name}] Untertitel "legendär"`);
  check((await page.textContent('.duo-text')).includes('Nils & Johannes'), `[${name}] Basecamp zeigt Nils & Johannes`);
  check((await page.textContent('#user-chip')).includes('N'), `[${name}] User-Chip`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/home-${name}.png` });
  await page.screenshot({ path: `${OUT}/home-full-${name}.png`, fullPage: true });

  // CTA
  await page.click('#cta-finder');
  await page.waitForFunction(() => location.hash === '#/finder/1');
  await page.waitForSelector('.quiz');
  check(true, `[${name}] CTA führt zum Finder (Frage 1)`);

  // Navigation durch alle Views
  for (const route of ['all', 'favorites', 'completed', 'finder', 'home']) {
    await page.click(`.nav a[data-route="${route}"]`);
    await page.waitForSelector(`.view-${route}`);
    const active = await page.getAttribute(`.nav a[data-route="${route}"]`, 'aria-current');
    check(active === 'page', `[${name}] Nav -> ${route} (aktiv markiert)`);
  }
  // Browser-Zurück
  await page.goBack();
  await page.waitForSelector('.view-finder');
  check(true, `[${name}] Browser-Zurück funktioniert`);

  // Unbekannte Route -> Start
  await page.goto(BASE + '#/gibtsnicht');
  await page.waitForSelector('.view-home');
  check(true, `[${name}] Unbekannte Route -> Startseite`);

  // Session bleibt nach Neuladen
  await page.reload();
  await page.waitForSelector('#screen-app:not([hidden]) .view-home');
  check(true, `[${name}] Session bleibt nach Neuladen erhalten`);

  const overflow = await page.evaluate((vw) => document.documentElement.scrollWidth > window.innerWidth || window.innerWidth !== vw, page.viewportSize().width);
  check(!overflow, `[${name}] Kein horizontales Scrollen`);

  // Logout
  if (await page.isVisible('#logout-btn')) await page.click('#logout-btn');
  else { await page.click('#user-chip'); await page.waitForSelector('#settings-logout'); await page.click('#settings-logout'); }
  await page.waitForSelector('#screen-login:not([hidden])');
  check(await page.locator('#screen-app').isHidden(), `[${name}] Logout -> zurück zum Login`);

  check(errors.length === 0, `[${name}] Keine JS-Fehler ${errors.join(' | ')}`);
  check(bad.length === 0, `[${name}] Keine defekten Ressourcen ${bad.join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} FEHLGESCHLAGEN` : '\nALLE TESTS BESTANDEN');
process.exit(failures ? 1 : 0);
