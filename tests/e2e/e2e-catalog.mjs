// Browser-Test (Playwright) – Ausführen über: npm run test:e2e
import { chromium, devices } from 'playwright';
import { mockFirebase } from './mock-firebase.mjs';

const BASE = process.env.BASE || 'http://localhost:8765/';
const OUT = process.env.OUT || 'shots';
let failures = 0;
const check = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++; };

const browser = await chromium.launch();
let checkedImages = false;
for (const [name, opts] of [['mobile', devices['iPhone 13']], ['desktop', { viewport: { width: 1366, height: 860 } }]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await mockFirebase(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(BASE);
  await page.fill('#login-email', 'nils@test');
  await page.fill('#login-password', 'correct');
  await page.press('#login-password', 'Enter');
  await page.waitForSelector('.view-home');

  // Alle Abenteuer
  await page.click('.nav a[data-route="all"]');
  await page.waitForSelector('.cards .card');
  const total = await page.locator('.card').count();
  check(total >= 33, `[${name}] Alle Abenteuer zeigt ${total} Karten`);
  check((await page.textContent('#cat-count')).startsWith(`${total} von ${total}`), `[${name}] Zähler stimmt`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/all-${name}.png` });

  // Bild-Links (einmal reicht)
  if (!checkedImages) {
    const srcs = await page.$$eval('.card img', (imgs) => [...new Set(imgs.map((i) => i.src))]);
    const broken = [];
    const throttled = [];
    for (const src of srcs) {
      // Wikimedia drosselt viele schnelle Abfragen (429) – dann kurz warten und erneut versuchen
      let r;
      for (let attempt = 0; attempt < 4; attempt++) {
        r = await page.request.get(src);
        if (r.status() !== 429) break;
        await page.waitForTimeout(3000 * (attempt + 1));
      }
      if (r.status() === 429) throttled.push(src);
      else if (!r.ok()) broken.push(`${r.status()} ${src}`);
      await page.waitForTimeout(150);
    }
    check(broken.length === 0, `Keine kaputten Bild-URLs (${srcs.length - throttled.length} geprüft) ${broken.join(' | ')}`);
    // 429 = Wikimedia drosselt den automatisierten Test-Browser; das sagt nichts über den Link aus
    if (throttled.length) console.log(`HINWEIS  ${throttled.length} Bilder wegen Drosselung (429) nicht geprüft – später erneut testen`);
    checkedImages = true;
  }

  // Suche
  await page.fill('#cat-q', 'höhle');
  const caveCount = await page.locator('.card').count();
  check(caveCount > 2 && caveCount < total, `[${name}] Suche "höhle" -> ${caveCount} Treffer`);
  await page.fill('#cat-q', 'xyzxyz');
  check(await page.isVisible('#cat-reset'), `[${name}] Keine Treffer -> "Filter zurücksetzen"`);
  await page.click('#cat-reset');
  await page.waitForSelector('.card');
  check(await page.locator('.card').count() === total, `[${name}] Filter zurückgesetzt`);

  // Kategorie + Kostenlos
  await page.click('.chip[data-cat="nature"]');
  const natureCount = await page.locator('.card').count();
  check(natureCount > 0 && natureCount < total, `[${name}] Chip Natur -> ${natureCount}`);
  await page.check('#cat-free');
  const freeCards = await page.locator('.card').count();
  const freeBadges = await page.locator('.card .badge-free').count();
  check(freeCards > 0 && freeCards === freeBadges, `[${name}] "Kostenlos": ${freeCards} Karten, alle mit Badge`);

  // Persistenz
  await page.reload();
  await page.waitForSelector('.card');
  check(await page.isChecked('#cat-free') && (await page.getAttribute('.chip[data-cat="nature"]', 'aria-pressed')) === 'true', `[${name}] Filter bleiben nach Neuladen erhalten`);
  await page.uncheck('#cat-free');
  await page.click('.chip[data-cat="all"]');

  // Sortierung nach Preis
  await page.selectOption('#cat-sort', 'price');
  const firstCost = await page.textContent('.card:first-child .card-meta li:nth-child(2)');
  check(firstCost.includes('Kostenlos'), `[${name}] Sortierung Preis: günstigstes zuerst (${firstCost.trim()})`);
  await page.selectOption('#cat-sort', 'name');

  // Detailansicht
  await page.click('.card[data-id="schauhoehlen-alb"]');
  await page.waitForSelector('.detail');
  check(page.url().endsWith('#/activity/schauhoehlen-alb'), `[${name}] Karte öffnet Detailansicht`);
  check(await page.locator('.cave').count() === 7, `[${name}] Höhlenübersicht mit 7 Höhlen`);
  const caveTypes = await page.$$eval('.cave-type', (e) => e.map((x) => x.textContent));
  check(['Frei zugänglich', 'Mit Eintritt', 'Nur mit Führung / feste Zeiten', 'Mit Bootsfahrt', 'Nur mit Ausrüstung & Höhlenführer'].every((t) => caveTypes.includes(t)), `[${name}] Alle 5 Höhlentypen unterschieden`);
  const maps = await page.getAttribute('a[href*="google.com/maps"]', 'href');
  check(maps.includes('query='), `[${name}] Google-Maps-Link vorhanden`);
  check((await page.textContent('.facts')).includes('Entfernung'), `[${name}] Faktenliste`);
  check(await page.isVisible('.safety'), `[${name}] Sicherheitshinweis sichtbar`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/detail-${name}.png`, fullPage: true });
  check(await page.getAttribute('.nav a[data-route="all"]', 'aria-current') === 'page', `[${name}] Nav "Alle" aktiv in Detailansicht`);
  await page.click('#detail-back');
  await page.waitForSelector('.view-all');
  check(true, `[${name}] Zurück -> Alle Abenteuer`);

  // Unbekannte Aktivität
  await page.goto(BASE + '#/activity/gibtsnicht');
  await page.waitForSelector('.empty');
  check((await page.textContent('.empty')).includes('nicht gefunden'), `[${name}] Unbekannte Aktivität -> Hinweis`);

  // Direktlink auf Detail -> Zurück führt zu "Alle"
  await page.goto(BASE + '#/activity/canyoning');
  await page.reload();
  await page.waitForSelector('.detail');
  check((await page.textContent('.safety')).includes('Guides'), `[${name}] Canyoning: Guide-Hinweis`);

  // Finder-Ergebnisse: Beispiel aus dem Prompt
  await page.evaluate(() => localStorage.setItem('onelife:u-nils:quiz', JSON.stringify({
    answers: { mood: ['nature'], duration: 'day', budget: 'lt30', setting: null, distance: '120', adrenaline: '4', when: null, prep: 'none' },
    skipped: ['setting', 'when'], completedAt: new Date().toISOString(),
  })));
  await page.goto(BASE + '#/results');
  await page.waitForSelector('#results-list .card');
  const resultIds = await page.$$eval('#results-list .card', (c) => c.map((x) => x.dataset.id));
  for (const id of ['nachtwanderung', 'gipfelpicknick', 'roemersteinturm', 'sonnenaufgang-berg']) {
    check(resultIds.includes(id), `[${name}] Vorschlag enthält ${id}`);
  }
  check(!resultIds.slice(0, 10).includes('canyoning'), `[${name}] Canyoning nicht unter den Top-Vorschlägen`);
  const softHint = await page.locator('#results-list .card-why-soft').count();
  check(softHint > 0, `[${name}] Weiche Abweichungen (z. B. Adrenalin) werden erklärt`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/results-real-${name}.png` });

  // Strenge Auswahl -> Alternativen mit Begründung
  await page.evaluate(() => localStorage.setItem('onelife:u-nils:quiz', JSON.stringify({
    answers: { mood: ['adrenaline'], duration: 'hours', budget: 'free', setting: null, distance: '30', adrenaline: '4', when: 'now', prep: 'none' },
    skipped: ['setting'], completedAt: new Date().toISOString(),
  })));
  await page.reload();
  await page.waitForSelector('#results-list');
  const perfectCount = await page.locator('#results-list .cards').first().locator('.card').count();
  const hasAlt = await page.isVisible('#alt-head');
  const missReasons = await page.locator('.card-why-miss').count();
  check(hasAlt && missReasons > 0, `[${name}] Strenge Auswahl: Alternativen mit "Passt nicht"-Begründung (perfekt: ${perfectCount})`);
  await page.screenshot({ path: `${OUT}/results-alt-${name}.png`, fullPage: true });

  const overflow = await page.evaluate((vw) => document.documentElement.scrollWidth > window.innerWidth || window.innerWidth !== vw, page.viewportSize().width);
  check(!overflow, `[${name}] Kein horizontales Scrollen`);
  check(errors.length === 0, `[${name}] Keine JS-Fehler ${errors.join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} FEHLGESCHLAGEN` : '\nALLE TESTS BESTANDEN');
process.exit(failures ? 1 : 0);
