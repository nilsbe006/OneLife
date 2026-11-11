// Browser-Test (Playwright) – Ausführen über: npm run test:e2e
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8765/';
const OUT = process.env.OUT || '.';
let failures = 0;
const check = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++; };

const browser = await chromium.launch();
for (const [name, opts] of [['mobile', devices['iPhone 13']], ['desktop', { viewport: { width: 1366, height: 860 } }]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const badResponses = [];
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('identitytoolkit')) badResponses.push(`${r.status()} ${r.url()}`); });

  await page.goto(BASE);
  await page.waitForSelector('#screen-login:not([hidden])', { timeout: 15000 });
  check(true, `[${name}] Login-Screen erscheint`);
  check(await page.locator('#screen-app').isHidden(), `[${name}] App ist ohne Login verborgen`);

  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/login-${name}.png` });

  // leeres Formular
  await page.click('#login-submit');
  check((await page.textContent('#login-error')).includes('E-Mail und Passwort'), `[${name}] Leeres Formular -> Fehlermeldung`);

  // Passwort anzeigen
  await page.fill('#login-password', 'abc');
  await page.click('#toggle-pw');
  check(await page.getAttribute('#login-password', 'type') === 'text', `[${name}] Passwort-Toggle zeigt Passwort`);
  await page.click('#toggle-pw');

  // Reset ohne E-Mail
  await page.fill('#login-email', '');
  await page.click('#login-reset');
  check((await page.textContent('#login-error')).includes('E-Mail-Adresse'), `[${name}] Reset ohne E-Mail -> Hinweis`);

  // falsches Passwort, Bestätigung per Enter
  await page.fill('#login-email', 'nobody@example.invalid');
  await page.fill('#login-password', 'definitely-wrong');
  await page.press('#login-password', 'Enter');
  await page.waitForFunction(() => document.querySelector('#login-error').textContent.includes('stimmt nicht'), null, { timeout: 15000 });
  check(true, `[${name}] Falsches Passwort per Enter -> "E-Mail oder Passwort stimmt nicht."`);
  check(await page.locator('#screen-app').isHidden(), `[${name}] App bleibt nach falschem Login verborgen`);
  await page.screenshot({ path: `${OUT}/login-error-${name}.png` });

  // horizontaler Overflow
  const overflow = await page.evaluate((vw) => document.documentElement.scrollWidth > window.innerWidth || window.innerWidth !== vw, page.viewportSize().width);
  check(!overflow, `[${name}] Kein horizontales Scrollen`);

  const realErrors = errors.filter((e) => !e.includes('400') && !e.includes('identitytoolkit'));
  check(realErrors.length === 0, `[${name}] Keine JS-Fehler ${realErrors.join(' | ')}`);
  check(badResponses.length === 0, `[${name}] Keine defekten Ressourcen ${badResponses.join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} FEHLGESCHLAGEN` : '\nALLE TESTS BESTANDEN');
process.exit(failures ? 1 : 0);
