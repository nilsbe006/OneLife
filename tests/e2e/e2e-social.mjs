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
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE);
  await page.fill('#login-email', email);
  await page.fill('#login-password', 'correct');
  await page.press('#login-password', 'Enter');
  await page.waitForSelector('.view-home');
  return page;
}

for (const [name, opts] of [['desktop', { viewport: { width: 1366, height: 900 } }], ['mobile', devices['iPhone 13']]]) {
  const ctx = await browser.newContext(opts);
  const errors = [];
  const nils = await loginPage(ctx, 'nils@test', errors);
  await nils.evaluate(() => localStorage.removeItem('mockdb'));
  const joh = await loginPage(ctx, 'johannes@test', errors);

  await nils.goto(BASE + '#/activity/canyoning');
  await joh.goto(BASE + '#/activity/canyoning');
  await nils.waitForSelector('#fav-btn');
  await joh.waitForSelector('#fav-btn');

  // Favorit
  await nils.click('#fav-btn');
  await nils.waitForSelector('#fav-btn[aria-pressed="true"]');
  check(true, `[${name}] Nils: Herz gesetzt`);

  // Sterne
  await nils.click('.star[data-star="4"]');
  await nils.waitForSelector('.star[data-star="4"][aria-checked="true"]');
  check(await nils.locator('.star.on').count() === 4, `[${name}] Nils: 4 Sterne`);

  // Status
  await nils.click('.seg[data-status="planned"]');
  await nils.waitForSelector('.seg[data-status="planned"][aria-checked="true"]');
  check(true, `[${name}] Nils: Status "Geplant"`);

  // Johannes sieht das live (ohne Neuladen)
  await joh.waitForFunction(() => document.querySelector('#friend-rating')?.textContent.includes('★★★★☆'), null, { timeout: 5000 });
  check((await joh.textContent('#friend-rating')).includes('Nils'), `[${name}] Johannes sieht Nils' 4 Sterne live`);
  check((await joh.textContent('#friend-rating')).includes('♥'), `[${name}] Johannes sieht Nils' Herz`);
  await joh.waitForSelector('.seg[data-status="planned"][aria-checked="true"]');
  check((await joh.textContent('#status-meta')).includes('Nils'), `[${name}] Johannes sieht "Zuletzt geändert von Nils"`);

  // Match
  await joh.click('#fav-btn');
  await joh.click('.star[data-star="5"]');
  await nils.waitForSelector('.match-banner', { timeout: 5000 });
  check(true, `[${name}] Match-Banner erscheint bei Nils live`);
  check((await nils.textContent('.avg')).includes('4,5'), `[${name}] Durchschnitt 4,5`);
  check((await nils.textContent('#friend-rating')).includes('★★★★★'), `[${name}] Nils sieht Johannes' 5 Sterne`);

  // Kommentare
  await joh.fill('#comment-input', 'Das müssen wir unbedingt machen.');
  await joh.click('#comment-send');
  await nils.waitForFunction(() => document.querySelector('#comment-list').textContent.includes('unbedingt machen'), null, { timeout: 5000 });
  check(true, `[${name}] Kommentar von Johannes erscheint live bei Nils`);
  check(await nils.locator('.comment:not(.mine) .comment-del').count() === 0, `[${name}] Nils kann fremden Kommentar nicht löschen`);
  check(await nils.isDisabled('#comment-send'), `[${name}] Senden ohne Text deaktiviert`);
  await nils.fill('#comment-input', 'Im Sommer, mit Übernachtung!');
  await nils.press('#comment-input', 'Control+Enter');
  await nils.waitForSelector('.comment.mine');
  check((await nils.inputValue('#comment-input')) === '', `[${name}] Eingabefeld nach Senden geleert`);
  await joh.waitForFunction(() => document.querySelector('#comment-list').textContent.includes('Übernachtung'));
  check((await joh.textContent('#comment-list')).indexOf('unbedingt') < (await joh.textContent('#comment-list')).indexOf('Übernachtung'), `[${name}] Kommentare chronologisch`);
  await nils.screenshot({ path: `${OUT}/social-${name}.png`, fullPage: true });
  await nils.click('.comment.mine .comment-del');
  await joh.waitForFunction(() => !document.querySelector('#comment-list').textContent.includes('Übernachtung'), null, { timeout: 5000 });
  check(true, `[${name}] Eigener Kommentar gelöscht – auch bei Johannes weg`);

  // Bewertung entfernen
  await nils.click('.star[data-star="4"]');
  await nils.waitForFunction(() => document.querySelectorAll('.star.on').length === 0);
  check(true, `[${name}] Gleicher Stern nochmal -> Bewertung entfernt`);
  await nils.click('.star[data-star="3"]');

  // Favoriten-Seite
  await joh.goto(BASE + '#/activity/eisbaden');
  await joh.waitForSelector('#fav-btn');
  await joh.click('#fav-btn');
  await nils.goto(BASE + '#/favorites');
  await nils.waitForSelector('#fav-matches');
  check(await nils.locator('#fav-matches .card[data-id="canyoning"]').count() === 1, `[${name}] Favoriten: Canyoning unter Matches`);
  check(await nils.locator('#fav-theirs .card[data-id="eisbaden"]').count() === 1, `[${name}] Favoriten: Eisbaden unter "Favoriten von Johannes"`);
  check((await nils.textContent('#fav-matches .card[data-id="canyoning"]')).includes('Match'), `[${name}] Karte zeigt 🔥 Match`);
  await nils.screenshot({ path: `${OUT}/favorites-${name}.png`, fullPage: true });

  // Live-Update der Favoritenliste
  await joh.click('#fav-btn');
  await nils.waitForFunction(() => !document.querySelector('#fav-theirs .card[data-id="eisbaden"]'), null, { timeout: 5000 });
  check(true, `[${name}] Favoritenliste aktualisiert sich live`);

  // Erledigt
  for (const id of ['nachtwanderung', 'escape-room']) {
    await nils.goto(BASE + '#/activity/' + id);
    await nils.waitForSelector('.seg[data-status="done"]');
    await nils.click('.seg[data-status="done"]');
    await nils.waitForSelector('.seg[data-status="done"][aria-checked="true"]');
  }
  await nils.click('.nav a[data-route="completed"]');
  await nils.waitForSelector('#stats');
  const total = await nils.evaluate(() => document.querySelectorAll('.stat-num')[1].textContent);
  check((await nils.textContent('#stat-done')) === '2', `[${name}] Erledigt: 2`);
  check((await nils.textContent('#stat-pct')) === `${Math.round(200 / Number(total))}%`, `[${name}] Fortschritt in Prozent (${await nils.textContent('#stat-pct')})`);
  check(await nils.locator('#list-planned .card[data-id="canyoning"]').count() === 1, `[${name}] Canyoning unter "Geplant"`);
  check(await nils.locator('#list-done .card').count() === 2, `[${name}] 2 Karten unter "Erledigt"`);
  await nils.screenshot({ path: `${OUT}/completed-${name}.png`, fullPage: true });

  // Erneut öffnen und zurücksetzen
  await nils.click('#list-done .card[data-id="escape-room"]');
  await nils.waitForSelector('.seg[data-status="open"]');
  await nils.click('.seg[data-status="open"]');
  await nils.waitForSelector('.seg[data-status="open"][aria-checked="true"]');
  await nils.click('.nav a[data-route="completed"]');
  await nils.waitForSelector('#stats');
  check((await nils.textContent('#stat-done')) === '1', `[${name}] Erneut geöffnet und zurückgesetzt -> 1 erledigt`);

  // Persistenz nach Neuladen
  await nils.reload();
  await nils.waitForSelector('#stats');
  check((await nils.textContent('#stat-done')) === '1', `[${name}] Daten bleiben nach Neuladen erhalten`);

  // Karten in "Alle" zeigen Status
  await nils.goto(BASE + '#/all');
  await nils.waitForSelector('.card[data-id="canyoning"]');
  check((await nils.textContent('.card[data-id="canyoning"] .card-social')).includes('Geplant'), `[${name}] Karte zeigt "Geplant"`);
  check((await nils.textContent('.card[data-id="nachtwanderung"] .card-social')).includes('Erledigt'), `[${name}] Karte zeigt "Erledigt"`);

  const overflow = await nils.evaluate((vw) => document.documentElement.scrollWidth > window.innerWidth || window.innerWidth !== vw, nils.viewportSize().width);
  check(!overflow, `[${name}] Kein horizontales Scrollen`);

  // Logout ohne Fehler
  if (await nils.isVisible('#logout-btn')) await nils.click('#logout-btn');
  else { await nils.click('#user-chip'); await nils.waitForSelector('#settings-logout'); await nils.click('#settings-logout'); }
  await nils.waitForSelector('#screen-login:not([hidden])');
  check(true, `[${name}] Logout`);
  check(errors.length === 0, `[${name}] Keine JS-Fehler ${errors.join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} FEHLGESCHLAGEN` : '\nALLE TESTS BESTANDEN');
process.exit(failures ? 1 : 0);
