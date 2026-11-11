// Browser-Test (Playwright) – Ausführen über: npm run test:e2e
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
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
const future = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

for (const [name, opts] of [['desktop', { viewport: { width: 1366, height: 900 }, acceptDownloads: true }], ['mobile', { ...devices['iPhone 13'], acceptDownloads: true }]]) {
  const ctx = await browser.newContext(opts);
  const errors = [];
  const nils = await loginPage(ctx, 'nils@test', errors);
  await nils.evaluate(() => localStorage.removeItem('mockdb'));
  await nils.reload();
  await nils.waitForSelector('.view-home');
  const joh = await loginPage(ctx, 'johannes@test', errors);

  check(await joh.isHidden('#bell-badge'), `[${name}] Glocke ohne Badge am Anfang`);
  check((await joh.textContent('#feed')).includes('Noch nichts los'), `[${name}] Leerer Feed mit Hinweis`);

  // Nils bewertet und schlägt vor
  await nils.goto(BASE + '#/activity/canyoning');
  await nils.waitForSelector('#sug-open');
  await nils.click('.star[data-star="4"]');
  await nils.click('#sug-open');
  await nils.fill('#sug-msg', 'Wie wär’s im Juni?');
  await nils.fill('#sug-date', future);
  await nils.click('#sug-send');
  await nils.waitForSelector('.sug-line.sug-pending');
  check((await nils.textContent('.sug-lines')).includes('Du hast Johannes'), `[${name}] Nils sieht eigenen offenen Vorschlag`);
  await nils.screenshot({ path: `${OUT}/p6-suggest-${name}.png`, fullPage: true });

  // Johannes: Badge, Startseite, Feed
  await joh.waitForSelector('#bell-badge:not([hidden])', { timeout: 5000 });
  check((await joh.textContent('#bell-badge')) === '1', `[${name}] Johannes: Glocke zeigt 1 (live)`);
  await joh.waitForFunction(() => document.querySelector('#hs-pending')?.textContent === '1');
  check(true, `[${name}] Startseite: 1 offener Vorschlag`);
  const feed = await joh.textContent('#feed');
  check(feed.includes('Nils hat dir Canyoning in der Starzlachklamm vorgeschlagen'), `[${name}] Feed: "Nils hat dir … vorgeschlagen"`);
  check(feed.includes('Nils hat Canyoning in der Starzlachklamm mit 4 Sternen bewertet'), `[${name}] Feed: Bewertung von Nils`);
  await joh.screenshot({ path: `${OUT}/p6-home-${name}.png`, fullPage: true });

  // Johannes: Inbox
  await joh.click('#bell');
  await joh.waitForSelector('#sugs-in .sug-pending');
  const item = await joh.textContent('#sugs-in .sug-pending');
  check(item.includes('Wie wär’s im Juni?') && item.includes('Wunschtermin'), `[${name}] Inbox zeigt Nachricht und Wunschtermin`);
  await joh.fill('.sug-note', 'Klar, bin dabei!');

  // Während Johannes tippt, kommt ein zweiter Vorschlag rein -> Eingabe bleibt erhalten
  await nils.goto(BASE + '#/activity/eisbaden');
  await nils.waitForSelector('#sug-open');
  await nils.click('#sug-open');
  await nils.click('#sug-send');
  await nils.waitForSelector('.sug-line.sug-pending');
  await joh.waitForFunction(() => document.querySelector('#bell-badge').textContent === '2', null, { timeout: 5000 });
  check((await joh.inputValue('.sug-note')) === 'Klar, bin dabei!', `[${name}] Neue Daten löschen die getippte Antwort nicht`);

  await joh.click('#sugs-in .sug-pending [data-respond="yes"]');
  await joh.waitForFunction(() => document.querySelector('#bell-badge').textContent === '1');
  check(true, `[${name}] Nach Antwort: Badge sinkt auf 1`);
  await joh.waitForSelector('#sugs-in .sug-yes');
  check((await joh.textContent('#sugs-in .sug-yes')).includes('Klar, bin dabei!'), `[${name}] Antwort mit Notiz gespeichert`);
  const ehItem = joh.locator('#sugs-in .sug-pending');
  await ehItem.locator('[data-respond="no"]').click();
  await joh.waitForSelector('#bell-badge[hidden]', { state: 'attached' });
  check(true, `[${name}] Alle beantwortet -> Badge weg`);
  await joh.screenshot({ path: `${OUT}/p6-inbox-${name}.png`, fullPage: true });

  // "Bin dabei" -> Status geplant, "Lieber nicht" -> Status bleibt offen
  await joh.goto(BASE + '#/activity/canyoning');
  await joh.waitForSelector('.seg[data-status="planned"][aria-checked="true"]');
  check(true, `[${name}] "Bin dabei" setzt Status auf Geplant`);
  await joh.goto(BASE + '#/activity/eisbaden');
  await joh.waitForSelector('.seg');
  check(await joh.getAttribute('.seg[data-status="open"]', 'aria-checked') === 'true', `[${name}] "Lieber nicht" ändert den Status nicht`);

  // Nils sieht die Antworten live
  await nils.waitForSelector('.sug-line.sug-no', { timeout: 5000 });
  check(true, `[${name}] Nils sieht "Lieber nicht" live auf der Detailseite`);
  await nils.goto(BASE + '#/inbox');
  await nils.waitForSelector('#sugs-out');
  check((await nils.textContent('#sugs-out')).includes('Bin dabei') && (await nils.textContent('#sugs-out')).includes('Klar, bin dabei!'), `[${name}] Nils' Inbox zeigt Antwort + Notiz`);
  await nils.goto(BASE + '#/');
  await nils.waitForSelector('#feed');
  const nfeed = await nils.textContent('#feed');
  check(nfeed.includes('Johannes hat beim Vorschlag Canyoning in der Starzlachklamm geantwortet: Bin dabei'), `[${name}] Feed bei Nils: Antwort von Johannes`);
  check(nfeed.includes('Du hast Canyoning in der Starzlachklamm mit 4 Sternen bewertet'), `[${name}] Feed: "Du hast …" (Grammatik)`);

  // Vorschlag zurückziehen
  await nils.goto(BASE + '#/inbox');
  await nils.waitForSelector('#sugs-out');
  const before = await nils.locator('#sugs-out .sug').count();
  await nils.locator('#sugs-out .sug-no [data-withdraw]').click();
  await nils.waitForFunction((n) => document.querySelectorAll('#sugs-out .sug').length === n - 1, before);
  await joh.goto(BASE + '#/inbox');
  await joh.waitForSelector('#sugs-in');
  check(await joh.locator('#sugs-in .sug').count() === before - 1, `[${name}] Gelöschter Vorschlag verschwindet auch bei Johannes`);

  // Export
  await nils.goto(BASE + '#/settings');
  await nils.waitForSelector('#export-btn');
  const [dl] = await Promise.all([nils.waitForEvent('download'), nils.click('#export-btn')]);
  const file = `${OUT}/backup-${name}.json`;
  await dl.saveAs(file);
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  check(backup.app === 'onelife-adventure-planner' && backup.version === 1, `[${name}] Export: Format & Version`);
  check(dl.suggestedFilename().startsWith('onelife-backup-nils-'), `[${name}] Export: Dateiname ${dl.suggestedFilename()}`);
  check(backup.data.ratings.some((r) => r.uid === 'u-nils' && r.activityId === 'canyoning' && r.rating === 4), `[${name}] Export enthält Nils' Bewertung`);
  check(backup.data.suggestions.length >= 1 && backup.data.activityState.length >= 1, `[${name}] Export enthält Vorschläge und Status`);
  check(typeof backup.data.ratings[0].updatedAt === 'string', `[${name}] Zeitstempel als ISO-Text exportiert`);

  // Datenverlust simulieren und importieren
  await nils.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('mockdb'));
    for (const k of Object.keys(d.ratings)) if (k.startsWith('u-nils_')) delete d.ratings[k];
    localStorage.setItem('mockdb', JSON.stringify(d));
  });
  await nils.reload();
  await nils.waitForSelector('#import-file');
  await nils.setInputFiles('#import-file', file);
  await nils.waitForSelector('#import-result:not([hidden])');
  const res = await nils.textContent('#import-result');
  check(res.includes('Wiederhergestellt: 1 Bewertungen'), `[${name}] Import stellt verlorene Bewertung wieder her (${res.slice(0, 60)}…)`);
  await nils.goto(BASE + '#/activity/canyoning');
  await nils.waitForSelector('.star');
  check(await nils.locator('.star.on').count() === 4, `[${name}] Bewertung nach Import wieder da`);

  // Zweiter Import ändert nichts (keine Duplikate)
  await nils.goto(BASE + '#/settings');
  await nils.setInputFiles('#import-file', file);
  await nils.waitForSelector('#import-result:not([hidden])');
  check((await nils.textContent('#import-result')).includes('Wiederhergestellt: 0 Bewertungen'), `[${name}] Erneuter Import erzeugt keine Duplikate`);

  // Ungültige Dateien
  fs.writeFileSync(`${OUT}/bad.json`, '{kaputt');
  await nils.setInputFiles('#import-file', `${OUT}/bad.json`);
  await nils.waitForSelector('#import-error:not([hidden])');
  check((await nils.textContent('#import-error')).includes('kein gültiges JSON'), `[${name}] Kaputte Datei -> Fehlermeldung`);
  fs.writeFileSync(`${OUT}/other.json`, JSON.stringify({ app: 'other', version: 1, data: {} }));
  await nils.setInputFiles('#import-file', `${OUT}/other.json`);
  await nils.waitForFunction(() => document.querySelector('#import-error').textContent.includes('kein ONE-LIFE-Backup'));
  check(true, `[${name}] Fremde Datei -> Fehlermeldung`);
  await nils.screenshot({ path: `${OUT}/p6-settings-${name}.png`, fullPage: true });

  const overflow = await nils.evaluate((vw) => document.documentElement.scrollWidth > window.innerWidth || window.innerWidth !== vw, nils.viewportSize().width);
  check(!overflow, `[${name}] Kein horizontales Scrollen`);

  // Logout aus den Einstellungen
  await nils.click('#settings-logout');
  await nils.waitForSelector('#screen-login:not([hidden])');
  check(true, `[${name}] Logout über Einstellungen`);
  check(errors.length === 0, `[${name}] Keine JS-Fehler ${errors.join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} FEHLGESCHLAGEN` : '\nALLE TESTS BESTANDEN');
process.exit(failures ? 1 : 0);
