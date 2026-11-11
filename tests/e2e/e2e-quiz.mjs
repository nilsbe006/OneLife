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

  const opt = (v) => page.locator(`.opt[data-value="${v}"]`);
  const atStep = async (n, suffix = '') => page.waitForFunction((h) => location.hash === h, `#/finder/${n}${suffix}`);
  const meta = () => page.textContent('.quiz-meta span');

  await page.goto(BASE);
  await page.fill('#login-email', 'nils@test');
  await page.fill('#login-password', 'correct');
  await page.press('#login-password', 'Enter');
  await page.waitForSelector('.view-home');

  // Start über CTA -> direkt Frage 1
  await page.click('#cta-finder');
  await atStep(1);
  check((await meta()) === 'Frage 1 von 8', `[${name}] CTA startet Frage 1, Fortschritt "Frage 1 von 8"`);
  check(await page.isDisabled('#quiz-next'), `[${name}] "Weiter" deaktiviert ohne Auswahl`);
  check(await page.isVisible('.quiz-all'), `[${name}] "Alle Abenteuer anzeigen" sichtbar`);
  check(await page.locator('.opt.has-img').count() === 6, `[${name}] Frage 1 hat 6 Bildkarten`);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/quiz1-${name}.png` });

  // Mehrfachauswahl
  await opt('nature').click();
  await opt('adrenaline').click();
  check(await page.locator('.opt.selected').count() === 2, `[${name}] Mehrfachauswahl: 2 ausgewählt`);
  await opt('adrenaline').click();
  check(await page.locator('.opt.selected').count() === 1, `[${name}] Mehrfachauswahl: abwählen`);
  await opt('adrenaline').click();
  await page.screenshot({ path: `${OUT}/quiz1-selected-${name}.png` });
  await page.click('#quiz-next');
  await atStep(2);
  const w = await page.$eval('.quiz-progress-bar', (e) => e.style.width);
  check(w === '25%', `[${name}] Fortschrittsbalken 25% bei Frage 2 (${w})`);

  // Einzelauswahl springt NICHT automatisch weiter – "Weiter" ist immer nötig
  await opt('hours').click();
  await page.waitForTimeout(700);
  check(page.url().endsWith('#/finder/2'), `[${name}] Auswahl allein springt nicht weiter`);
  check(await page.isEnabled('#quiz-next'), `[${name}] "Weiter" nach Auswahl aktiv`);
  await opt('halfday').click();
  await opt('hours').click();
  check(await page.locator('.opt.selected').count() === 1, `[${name}] Umentscheiden vor "Weiter" möglich`);
  // Doppelklick auf "Weiter" darf nur eine Frage weitergehen
  await page.dblclick('#quiz-next');
  await atStep(3);
  await page.waitForTimeout(500);
  check(page.url().endsWith('#/finder/3'), `[${name}] Doppelklick auf "Weiter" überspringt keine Frage`);

  // Zurück-Button behält Auswahl
  await page.click('#quiz-back');
  await atStep(2);
  check(await opt('hours').getAttribute('aria-pressed') === 'true', `[${name}] Zurück: Auswahl "Ein paar Stunden" bleibt erhalten`);
  await page.click('#quiz-next');
  await atStep(3);

  await opt('lt30').click();
  await page.click('#quiz-next');
  await atStep(4);
  // Empfehlung aus Frage 1 (Natur -> Draußen)
  check((await opt('outdoor').textContent()).includes('Passt gut'), `[${name}] Empfehlung "Passt gut" bei Draußen`);
  // exklusiv
  await opt('outdoor').click();
  await opt('city').click();
  await opt('any').click();
  check(await page.locator('.opt.selected').count() === 1, `[${name}] "Egal" hebt andere Ortsauswahl auf`);
  await opt('outdoor').click();
  check(await opt('any').getAttribute('aria-pressed') === 'false', `[${name}] Andere Auswahl hebt "Egal" auf`);
  await page.click('#quiz-next');
  await atStep(5);

  // Dynamik Entfernung (Dauer = ein paar Stunden)
  check(await opt('60').isEnabled(), `[${name}] Entfernung 60 min erlaubt`);
  check(await opt('120').isDisabled(), `[${name}] Entfernung 120 min gesperrt bei "ein paar Stunden"`);
  check(await opt('fly').isDisabled(), `[${name}] Flug gesperrt`);
  check((await opt('120').textContent()).includes('zu weit'), `[${name}] Grund wird angezeigt`);
  await page.screenshot({ path: `${OUT}/quiz5-${name}.png`, fullPage: true });
  await opt('60').click();
  await page.click('#quiz-next');
  await atStep(6);
  check((await opt('4').textContent()).includes('Passt gut'), `[${name}] Adrenalin-Empfehlung durch Frage 1`);
  await opt('4').click();
  await page.click('#quiz-next');
  await atStep(7);
  await opt('now').click();
  await page.click('#quiz-next');
  await atStep(8);
  check(await opt('big').isDisabled(), `[${name}] "Große Vorbereitung" gesperrt bei heute/morgen`);
  check((await page.textContent('#quiz-next')).includes('Vorschläge zeigen'), `[${name}] Letzte Frage: Button "Vorschläge zeigen"`);
  await opt('none').click();
  await page.click('#quiz-next');
  await page.waitForSelector('.profile');
  check(page.url().endsWith('#/results'), `[${name}] Nach Frage 8 -> Profil/Ergebnisse`);

  const profile = await page.textContent('#profile');
  for (const t of ['Natur und Outdoor, Adrenalin und Action', 'Ein paar Stunden', 'Unter 30 €', 'Draußen in der Natur', 'Bis 60 Minuten', 'Richtiges Abenteuer', 'Heute / morgen', 'Einfach losfahren']) {
    check(profile.includes(t), `[${name}] Profil enthält "${t}"`);
  }
  check(await page.getAttribute('.nav a[data-route="finder"]', 'aria-current') === 'page', `[${name}] Nav: Finder aktiv auf Ergebnisseite`);
  await page.screenshot({ path: `${OUT}/results-${name}.png`, fullPage: true });

  // Filter nachträglich ändern: Dauer -> ganzer Tag
  await page.click('.profile-item[data-q="duration"]');
  await atStep(2, '/edit');
  await opt('day').click();
  await page.click('#quiz-next');
  await page.waitForSelector('.profile');
  check((await page.textContent('#profile')).includes('Ein ganzer Tag'), `[${name}] Ändern aus Profil -> zurück zum Profil`);

  // Entfernung auf 180 setzen, dann Dauer auf Stunden -> Entfernung wird entfernt
  await page.click('.profile-item[data-q="distance"]');
  await atStep(5, '/edit');
  await opt('180').click();
  await page.click('#quiz-next');
  await page.waitForSelector('.profile');
  await page.click('.profile-item[data-q="duration"]');
  await atStep(2, '/edit');
  await opt('hours').click();
  await page.click('#quiz-next');
  await page.waitForSelector('.profile');
  const toastText = await page.textContent('#toast');
  check(toastText.includes('Entfernung'), `[${name}] Toast erklärt angepasste Entfernung`);
  const distVal = await page.textContent('.profile-item[data-q="distance"] .profile-val');
  check(distVal === 'Egal', `[${name}] Ungültige Entfernung entfernt (${distVal})`);

  // Persistenz nach Neuladen
  await page.reload();
  await page.waitForSelector('.profile');
  check((await page.textContent('#profile')).includes('Ein paar Stunden'), `[${name}] Quiz-Antworten bleiben nach Neuladen erhalten`);

  // Einstieg nach Abschluss
  await page.click('.nav a[data-route="finder"]');
  await page.waitForSelector('.finder-intro');
  check(await page.isVisible('#intro-results'), `[${name}] Finder-Einstieg bietet "Zu meinen Vorschlägen"`);

  // Neu starten + Überspringen
  await page.click('#intro-restart');
  await atStep(1);
  check(await page.locator('.opt.selected').count() === 0, `[${name}] Neu starten leert Auswahl`);
  await page.click('#quiz-skip');
  await atStep(2);
  check(true, `[${name}] Überspringen -> nächste Frage`);

  // Browser-Zurück
  await page.goBack();
  await atStep(1);
  check(true, `[${name}] Browser-Zurück im Quiz`);

  // Zurück auf Frage 1 -> Startseite
  await page.click('#quiz-back');
  await page.waitForSelector('.view-home');
  check(true, `[${name}] Zurück auf Frage 1 -> Startseite`);

  // Alle Abenteuer immer erreichbar
  await page.goto(BASE + '#/finder/4');
  await page.waitForSelector('.quiz');
  await page.click('.quiz-all');
  await page.waitForSelector('.view-all');
  check(true, `[${name}] "Alle Abenteuer anzeigen" aus dem Quiz`);

  // Kein Herauszoomen auf allen 8 Fragen (Slide-Animation darf nicht überstehen)
  for (let i = 1; i <= 8; i++) {
    await page.goto(BASE + '#/finder/' + i);
    await page.waitForSelector('.quiz');
    await page.waitForTimeout(500);
    const vwOk = await page.evaluate((vw) => window.innerWidth === vw, page.viewportSize().width);
    if (!vwOk) check(false, `[${name}] Frage ${i}: Seite ist herausgezoomt`);
  }
  check(true, `[${name}] Keine Fragenseite zoomt heraus`);

  // Weiter-Button nicht von Tab-Bar verdeckt
  await page.goto(BASE + '#/finder/2');
  await page.waitForSelector('.quiz');
  const covered = await page.evaluate(() => {
    const b = document.querySelector('#quiz-next').getBoundingClientRect();
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !hit || !hit.closest('#quiz-next');
  });
  check(!covered, `[${name}] "Weiter"-Button ist klickbar sichtbar`);

  const overflow = await page.evaluate((vw) => document.documentElement.scrollWidth > window.innerWidth || window.innerWidth !== vw, page.viewportSize().width);
  check(!overflow, `[${name}] Kein horizontales Scrollen`);
  check(errors.length === 0, `[${name}] Keine JS-Fehler ${errors.join(' | ')}`);
  check(bad.length === 0, `[${name}] Keine defekten Ressourcen ${bad.join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} FEHLGESCHLAGEN` : '\nALLE TESTS BESTANDEN');
process.exit(failures ? 1 : 0);
