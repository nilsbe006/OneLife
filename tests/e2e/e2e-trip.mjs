// Browser-Test (Playwright) – Ausführen über: npm run test:e2e
import { chromium, devices } from 'playwright';
import { mockFirebase } from './mock-firebase.mjs';

const BASE = process.env.BASE || 'http://localhost:8765/';
const OUT = process.env.OUT || 'shots';
let failures = 0;
const check = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++; };
const browser = await chromium.launch();

async function loginPage(ctx, email, errors) {
  const page = await ctx.newPage();
  await mockFirebase(page);
  page.on('pageerror', (e) => errors.push(`${email}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${email}: ${m.text()}`); });
  await page.goto(BASE);
  await page.fill('#login-email', email);
  await page.fill('#login-password', 'correct');
  await page.press('#login-password', 'Enter');
  await page.waitForSelector('.view-home');
  return page;
}
const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

for (const [name, opts] of [['mobile', devices['iPhone 13']], ['desktop', { viewport: { width: 1366, height: 900 } }]]) {
  const ctx = await browser.newContext(opts);
  const errors = [];
  const nils = await loginPage(ctx, 'nils@test', errors);
  await nils.evaluate(() => { localStorage.removeItem('mockdb'); localStorage.removeItem('onelife:u-nils:trip'); });
  const joh = await loginPage(ctx, 'johannes@test', errors);

  // Einstieg über Blind-Trip-Detail
  await nils.goto(BASE + '#/activity/blind-trip');
  await nils.click('.trip-cta');
  await nils.waitForSelector('#trip-form');
  check(nils.url().endsWith('#/trip'), `[${name}] "Trip planen" öffnet den Planer`);
  check(await nils.locator('input[name="airport"]').count() === 2, `[${name}] Abflughafen: Stuttgart und Friedrichshafen`);

  // Eingaben
  await nils.click('label.pill:has(input[value="FDH"])');
  await nils.fill('input[name="from"]', inDays(30));
  await nils.fill('input[name="nights"]', '3');
  await nils.$eval('input[name="budget"]', (e) => { e.value = '600'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await nils.click('label.pill:has(input[value="beach"])');
  const summary = await nils.textContent('#trip-summary');
  check(summary.includes('ab Friedrichshafen') && summary.includes('3 Nächte') && summary.includes('600 €') && summary.includes('Strand'), `[${name}] Zusammenfassung: ${summary}`);
  check((await nils.textContent('#budget-out')) === '600 €', `[${name}] Budget-Regler zeigt Wert`);
  check(await nils.locator('#dests .dest').count() === 6, `[${name}] 6 passende Ziele`);
  const destText = await nils.textContent('#dests');
  check(!/\d+\s?€/.test(destText), `[${name}] Keine erfundenen Preise in den Zielen`);
  const hrefs = await nils.$$eval('#dests a', (a) => a.map((x) => x.href));
  check(hrefs.length > 0 && hrefs.every((h) => h.startsWith('https://')), `[${name}] Alle Such-Links https`);
  check(hrefs.some((h) => h.includes('/fdh/')), `[${name}] Links nutzen den gewählten Flughafen FDH`);
  await nils.screenshot({ path: `${OUT}/trip-${name}.png`, fullPage: true });

  // Validierung
  await nils.fill('input[name="to"]', inDays(10));
  await nils.waitForSelector('#trip-error:not([hidden])');
  check((await nils.textContent('#trip-error')).includes('nach dem Abflug'), `[${name}] Rückreise vor Abflug -> Fehlermeldung`);
  await nils.fill('input[name="to"]', '');

  // Blind-Modus
  await nils.click('#blind-draw');
  await nils.waitForSelector('.blind-card');
  const topCities = await nils.$$eval('#dests .dest-head strong', (s) => s.slice(0, 5).map((x) => x.textContent));
  check(!(await nils.textContent('#blind')).match(new RegExp(topCities.join('|'))), `[${name}] Gezogenes Ziel bleibt verdeckt`);

  // Vorschlag an Johannes verrät das Ziel nicht
  await nils.click('#trip-suggest');
  await joh.goto(BASE + '#/inbox');
  await joh.waitForSelector('#sugs-in .sug-pending');
  const msg = await joh.textContent('#sugs-in .sug-pending .sug-msg');
  check(msg.includes('Überraschung') && !topCities.some((c) => msg.includes(c)), `[${name}] Johannes bekommt Trip-Idee ohne Ziel: ${msg.slice(0, 70)}…`);

  await nils.click('#blind-reveal');
  await nils.waitForSelector('.blind-reveal');
  const city = (await nils.textContent('.blind-reveal strong')).trim();
  check(topCities.includes(city), `[${name}] Aufgedeckt: ${city} (aus den Top 5)`);
  await nils.reload();
  await nils.waitForSelector('.blind-reveal');
  check((await nils.textContent('.blind-reveal strong')).trim() === city, `[${name}] Gezogenes Ziel bleibt nach Neuladen erhalten`);
  check(await nils.isChecked('input[value="FDH"]'), `[${name}] Formular bleibt nach Neuladen erhalten`);

  // Konkrete Stadt
  await nils.click('label.pill:has(input[value="city"])');
  await nils.fill('input[name="city"]', 'Lissabon');
  await nils.waitForSelector('.dest[data-code="LIS"]');
  check(await nils.locator('.dest').count() === 1, `[${name}] Konkrete Stadt: nur Lissabon`);
  await nils.fill('input[name="city"]', 'Sevilla');
  await nils.waitForFunction(() => document.querySelector('#trip-out').textContent.includes('Sevilla'));
  const gl = await nils.getAttribute('#trip-out .dest-links a', 'href');
  check(decodeURIComponent(gl).includes('to Sevilla'), `[${name}] Unbekannte Stadt -> Google-Flüge-Suche`);
  await nils.fill('input[name="city"]', '');
  check(await nils.isVisible('#trip-error'), `[${name}] Leere Stadt -> Hinweis`);

  const overflow = await nils.evaluate((vw) => document.documentElement.scrollWidth > window.innerWidth || window.innerWidth !== vw, nils.viewportSize().width);
  check(!overflow, `[${name}] Kein horizontales Scrollen`);
  check(errors.length === 0, `[${name}] Keine JS-Fehler ${errors.join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} FEHLGESCHLAGEN` : '\nALLE TESTS BESTANDEN');
process.exit(failures ? 1 : 0);
