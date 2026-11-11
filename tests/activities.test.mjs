// Datenqualität des Aktivitätenkatalogs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITIES, isFree, isSpontaneous } from '../js/activities.js';

const MOODS = ['adrenaline', 'nature', 'spontaneous', 'special', 'weekend', 'new'];
const DURATIONS = ['hours', 'halfday', 'day', 'weekend', 'multiday'];
const SETTINGS = ['outdoor', 'indoor', 'city'];
const CAVE_TYPES = ['free', 'ticket', 'guided', 'boat', 'expert'];

test('IDs sind eindeutig', () => {
  const ids = ACTIVITIES.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('mindestens 33 Aktivitäten', () => {
  assert.ok(ACTIVITIES.length >= 33, `nur ${ACTIVITIES.length}`);
});

test('alle Pflichtfelder sind gültig', () => {
  for (const a of ACTIVITIES) {
    const at = `(${a.id})`;
    for (const f of ['id', 'name', 'teaser', 'description', 'why', 'durationText', 'seasonText']) assert.ok(a[f], `${f} fehlt ${at}`);
    assert.ok(a.categories.length && a.categories.every((c) => MOODS.includes(c)), `categories ${at}`);
    assert.ok(DURATIONS.includes(a.duration), `duration ${at}`);
    assert.ok(a.setting.length && a.setting.every((s) => SETTINGS.includes(s)), `setting ${at}`);
    assert.ok(a.months.length && a.months.every((m) => m >= 1 && m <= 12), `months ${at}`);
    for (const f of ['adrenaline', 'difficulty', 'spontaneity']) assert.ok(a[f] >= 1 && a[f] <= 5, `${f} ${at}`);
    assert.ok(a.cost.min >= 0 && a.cost.min <= a.cost.max, `cost ${at}`);
    assert.ok(Number.isFinite(a.driveMin) && a.driveMin > 0, `driveMin ${at}`);
    assert.ok(['car', 'train', 'flight'].includes(a.travel), `travel ${at}`);
    assert.ok(a.image?.src?.startsWith('https://') && a.image.credit, `image ${at}`);
    assert.equal(typeof a.bookingRequired, 'boolean', `bookingRequired ${at}`);
    assert.equal(typeof a.guideRequired, 'boolean', `guideRequired ${at}`);
    assert.equal(typeof a.weatherDependent, 'boolean', `weatherDependent ${at}`);
    assert.ok(Array.isArray(a.equipment) && Array.isArray(a.links) && Array.isArray(a.tags), `arrays ${at}`);
    assert.ok(a.location?.name && a.location?.mapsQuery, `location ${at}`);
    for (const l of a.links) assert.ok(l.url.startsWith('https://') && l.label, `link ${at}`);
  }
});

test('nichts wird fälschlich als spontan oder kostenlos dargestellt', () => {
  for (const a of ACTIVITIES) {
    if (a.bookingRequired || a.guideRequired) {
      assert.ok(a.spontaneity <= 3, `${a.id}: Buchung/Guide, aber Spontanität ${a.spontaneity}`);
      assert.equal(isSpontaneous(a), false, a.id);
    }
    if (a.bookingRequired && a.guideRequired) assert.ok(a.cost.min > 0, `${a.id}: geführte Buchung kann nicht kostenlos sein`);
    if (isFree(a)) assert.equal(a.cost.min, 0, a.id);
  }
});

test('alle Aktivitäten aus dem Prompt sind vorhanden', () => {
  const required = [
    'hoehlenabenteuer-alb', 'sonnenaufgang-berg', 'wimsener-hoehle', 'roemersteinturm', 'kletterwald-laichingen',
    'kanu-obere-donau', 'huettentour-alpen', 'gipfelpicknick', 'nachtwanderung', 'nacht-draussen', 'eisbaden',
    'stockbrot-abend', 'zufalls-roadtrip', 'schauhoehlen-alb', 'canyoning', 'klettersteig', 'tandem-gleitschirm',
    'indoor-skydiving', 'fallschirmspringen', 'nachtrodeln', 'ziplining', 'bobbahn-donnstetten', 'outdoor-lasertag',
    'e-kart', 'horror-escape-room', 'casinoabend', 'blind-trip', 'wochenendtrip-flug', 'escape-room', 'zug-ins-blaue',
    'outdoor-kochabend', 'nacht-picknick', 'nacht-berghuette',
  ];
  const ids = new Set(ACTIVITIES.map((a) => a.id));
  for (const id of required) assert.ok(ids.has(id), `fehlt: ${id}`);
});

test('unerwünschte Aktivitäten sind nicht enthalten', () => {
  const banned = /boulder|minigolf|ninja|stuntwerk|uracher wasserfall|geocach|pizza/i;
  for (const a of ACTIVITIES) {
    assert.ok(!banned.test(a.name) && !a.tags.some((t) => banned.test(t)), a.id);
  }
});

test('E-Kart ist als kostenintensiv gekennzeichnet', () => {
  const kart = ACTIVITIES.find((a) => a.id === 'e-kart');
  assert.equal(kart.pricey, true);
  assert.match(kart.cost.note, /kostenintensiv/);
});

test('Höhlen sind nach Zugangsart unterschieden', () => {
  const types = new Set();
  for (const a of ACTIVITIES) {
    if (a.caveType) types.add(a.caveType);
    for (const c of a.caves || []) types.add(c.type);
  }
  for (const t of CAVE_TYPES) assert.ok(types.has(t), `Höhlentyp fehlt: ${t}`);
  for (const a of ACTIVITIES.filter((x) => x.caveType)) {
    assert.ok(CAVE_TYPES.includes(a.caveType), a.id);
    if (a.caveType === 'free') assert.ok(a.months.every((m) => m >= 4 && m <= 9), `${a.id}: freie Höhle im Fledermaus-Winter`);
  }
});

test('riskante Aktivitäten haben einen Sicherheitshinweis', () => {
  const risky = ['canyoning', 'klettersteig', 'tandem-gleitschirm', 'fallschirmspringen', 'nachtwanderung', 'eisbaden',
    'nacht-draussen', 'stockbrot-abend', 'hoehlenabenteuer-alb', 'wildhoehle-gefuehrt', 'sonnenaufgang-berg', 'casinoabend'];
  for (const id of risky) assert.ok(ACTIVITIES.find((a) => a.id === id).safety, `kein Sicherheitshinweis: ${id}`);
});

test('Canyoning, Fallschirm und Tandemflug nur mit Guide', () => {
  for (const id of ['canyoning', 'fallschirmspringen', 'tandem-gleitschirm', 'wildhoehle-gefuehrt']) {
    assert.equal(ACTIVITIES.find((a) => a.id === id).guideRequired, true, id);
  }
});

test('Casinoabend ist ab 18 möglich (Casino Bregenz, Österreich)', () => {
  const c = ACTIVITIES.find((a) => a.id === 'casinoabend');
  assert.equal(c.minAge, 18);
  assert.equal(c.country, 'AT');
  assert.match(c.name, /Bregenz/);
  assert.ok(c.equipment.some((e) => /ausweis|reisepass/i.test(e)));
});
