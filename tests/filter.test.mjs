import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITIES } from '../js/activities.js';
import { rank, evaluate, relevantMonths } from '../js/filter.js';

const byId = (id) => ACTIVITIES.find((a) => a.id === id);
const ids = (list) => list.map((r) => r.activity.id);
const JULY = new Date(2026, 6, 15);
const NOVEMBER = new Date(2026, 10, 11);

test('Beispiel aus dem Prompt: Natur, ganzer Tag, < 30 €, 120 min, viel Adrenalin, spontan', () => {
  const answers = { mood: ['nature'], duration: 'day', budget: 'lt30', distance: '120', adrenaline: '4', prep: 'none' };
  const { perfect } = rank(ACTIVITIES, answers, JULY);
  const got = ids(perfect);
  for (const id of ['sonnenaufgang-berg', 'nachtwanderung', 'gipfelpicknick', 'hoehlenabenteuer-alb', 'roemersteinturm', 'lautertal-wanderung']) {
    assert.ok(got.includes(id), `${id} fehlt in ${got.join(', ')}`);
  }
  for (const id of ['canyoning', 'kanu-obere-donau', 'fallschirmspringen', 'kletterwald-laichingen']) {
    assert.ok(!got.includes(id), `${id} dürfte nicht perfekt passen`);
  }
});

test('"Einfach losfahren" schließt Buchung und Guide aus', () => {
  const { perfect } = rank(ACTIVITIES, { prep: 'none' }, JULY);
  assert.ok(perfect.length > 0);
  for (const r of perfect) {
    assert.equal(r.activity.bookingRequired, false, r.activity.id);
    assert.equal(r.activity.guideRequired, false, r.activity.id);
  }
});

test('Budget "möglichst kostenlos" lässt nur (fast) kostenlose Aktivitäten durch', () => {
  const { perfect } = rank(ACTIVITIES, { budget: 'free' }, JULY);
  for (const r of perfect) assert.ok(r.activity.cost.min <= 5, r.activity.id);
  const kletterwald = evaluate(byId('kletterwald-laichingen'), { budget: 'free' }, JULY);
  assert.equal(kletterwald.perfect, false);
  assert.match(kletterwald.hard[0].reason, /statt möglichst kostenlos/);
});

test('Preisfilter 30–100 € erlaubt günstigere, aber keine teureren Aktivitäten', () => {
  assert.equal(evaluate(byId('nachtwanderung'), { budget: '30-100' }, JULY).perfect, true);
  assert.equal(evaluate(byId('canyoning'), { budget: '30-100' }, JULY).perfect, true);
  assert.equal(evaluate(byId('fallschirmspringen'), { budget: '30-100' }, JULY).perfect, false);
});

test('Entfernungsfilter', () => {
  const r30 = rank(ACTIVITIES, { distance: '30' }, JULY).perfect;
  for (const r of r30) assert.ok(r.activity.driveMin <= 30 && r.activity.travel !== 'flight', r.activity.id);
  const kw = evaluate(byId('kletterwald-laichingen'), { distance: '30' }, JULY);
  assert.match(kw.hard[0].reason, /ca\. 35 min statt max\. 30 min/);
  assert.equal(evaluate(byId('blind-trip'), { distance: 'eu' }, JULY).perfect, false);
  assert.equal(evaluate(byId('blind-trip'), { distance: 'fly' }, JULY).perfect, true);
});

test('Dauer: längere Aktivitäten fallen raus, kürzere passen', () => {
  assert.equal(evaluate(byId('huettentour-alpen'), { duration: 'day' }, JULY).perfect, false);
  assert.equal(evaluate(byId('nachtwanderung'), { duration: 'day' }, JULY).perfect, true);
});

test('Saison wird berücksichtigt', () => {
  const canyon = evaluate(byId('canyoning'), { when: 'now' }, NOVEMBER);
  assert.equal(canyon.perfect, false);
  assert.match(canyon.hard[0].reason, /keine Saison/);
  assert.equal(evaluate(byId('eisbaden'), { when: 'now' }, NOVEMBER).perfect, true);
  assert.equal(evaluate(byId('eisbaden'), { when: 'now' }, JULY).perfect, false);
  assert.equal(evaluate(byId('canyoning'), { when: 'anytime' }, NOVEMBER).perfect, true);
});

test('Heute/morgen schließt Aktivitäten mit langem Vorlauf aus', () => {
  const r = evaluate(byId('fallschirmspringen'), { when: 'now' }, JULY);
  assert.equal(r.perfect, false);
  assert.ok(r.hard.some((h) => /Vorlauf/.test(h.reason)));
});

test('weiche Kriterien beeinflussen nur die Reihenfolge', () => {
  const calm = evaluate(byId('gipfelpicknick'), { adrenaline: '4' }, JULY);
  assert.equal(calm.perfect, true);
  assert.equal(calm.soft[0].key, 'adrenaline');
  const { perfect } = rank(ACTIVITIES, { adrenaline: '4' }, JULY);
  assert.ok(perfect[0].activity.adrenaline >= 4, 'wildeste Aktivitäten zuerst');
});

test('Mehrfachauswahl bei Lust: jede gewählte Kategorie zählt', () => {
  const e = evaluate(byId('canyoning'), { mood: ['special', 'adrenaline'] }, JULY);
  assert.equal(e.checks.find((c) => c.key === 'mood').status, 'ok');
  const e2 = evaluate(byId('casinoabend'), { mood: ['nature'] }, JULY);
  assert.equal(e2.checks.find((c) => c.key === 'mood').status, 'soft');
});

test('ohne perfekte Treffer gibt es Alternativen mit Begründung', () => {
  const sample = [byId('canyoning'), byId('fallschirmspringen')];
  const { perfect, alternatives } = rank(sample, { budget: 'lt30', when: 'now' }, NOVEMBER);
  assert.equal(perfect.length, 0);
  assert.ok(alternatives.length > 0);
  for (const alt of alternatives) assert.ok(alt.hard.length >= 1 && alt.hard.every((h) => h.reason));
});

test('ohne Antworten passen alle Aktivitäten', () => {
  assert.equal(rank(ACTIVITIES, {}, JULY).perfect.length, ACTIVITIES.length);
});

test('relevantMonths', () => {
  assert.deepEqual(relevantMonths('now', new Date(2026, 10, 30)), [11, 12]);
  assert.deepEqual(relevantMonths('weekend', new Date(2026, 0, 30)), [1, 2]); // Fr 30.1. -> Sa 31.1./So 1.2.
  assert.equal(relevantMonths('anytime', JULY), null);
  assert.equal(relevantMonths('weather', JULY), null);
  assert.deepEqual(relevantMonths('weeks', new Date(2026, 10, 25)), [11, 12, 1]);
});

test('"Unter 30 €" ist exklusiv', () => {
  const kw = evaluate(byId('kletterwald-laichingen'), { budget: 'lt30' }, JULY);
  assert.equal(kw.perfect, false);
  assert.match(kw.hard[0].reason, /statt unter 30 €/);
});
