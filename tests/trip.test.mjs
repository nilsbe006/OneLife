import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DESTINATIONS, AIRPORTS, normalizeTrip, rankDestinations, flightLinks, drawBlind, returnDate, findDestination, defaultTrip,
} from '../js/trip.js';

const TODAY = new Date('2026-11-11T10:00:00Z');

test('nur Stuttgart und Friedrichshafen als Abflughafen', () => {
  assert.deepEqual(Object.keys(AIRPORTS), ['STR', 'FDH']);
});

test('Ziele haben vollständige Daten und keine Preise', () => {
  const codes = new Set();
  for (const d of DESTINATIONS) {
    assert.match(d.code, /^[A-Z]{3}$/);
    assert.ok(!codes.has(d.code)); codes.add(d.code);
    assert.ok(d.city && d.country && d.why);
    assert.ok(d.flightH > 0 && d.flightH < 6);
    assert.ok([1, 2, 3].includes(d.costLevel));
    assert.ok(d.best.length && d.interests.length);
    assert.ok(!/\d+\s?€|EUR/.test(JSON.stringify(d)), `${d.code} enthält einen Preis`);
  }
});

test('normalizeTrip begrenzt Werte und prüft Daten', () => {
  const { trip, errors } = normalizeTrip({ nights: 99, budget: 5, airport: 'XXX', interests: ['beach', 'foo'] }, TODAY);
  assert.equal(trip.nights, 14);
  assert.equal(trip.budget, 50);
  assert.equal(trip.airport, 'STR');
  assert.deepEqual(trip.interests, ['beach']);
  assert.deepEqual(errors, []);
  assert.ok(normalizeTrip({ from: '2026-01-01' }, TODAY).errors[0].includes('Vergangenheit'));
  assert.ok(normalizeTrip({ from: '2026-12-10', to: '2026-12-05' }, TODAY).errors[0].includes('nach dem Abflug'));
  assert.ok(normalizeTrip({ flexible: false, city: ' ' }, TODAY).errors[0].includes('Stadt'));
});

test('Rückreise = Abflug + Nächte, wenn nicht angegeben', () => {
  assert.equal(returnDate({ ...defaultTrip(), from: '2026-12-30', nights: 3 }), '2027-01-02');
  assert.equal(returnDate({ ...defaultTrip(), from: '2026-12-30', to: '2027-01-05' }), '2027-01-05');
  assert.equal(returnDate({ ...defaultTrip() }), '');
});

test('Interessen und Reisemonat beeinflussen das Ranking', () => {
  const beachSummer = rankDestinations({ ...defaultTrip(), interests: ['beach'], from: '2027-06-10', budget: 1000 }, TODAY);
  assert.ok(beachSummer[0].dest.interests.includes('beach'));
  assert.ok(beachSummer[0].reasons.includes('gute Reisezeit'));
  const natureWinter = rankDestinations({ ...defaultTrip(), interests: ['nature', 'adventure'], from: '2027-02-10', budget: 1500 }, TODAY);
  assert.equal(natureWinter[0].dest.code, 'KEF');
});

test('kleines Budget bevorzugt günstige Ziele, kurze Trips kurze Flüge', () => {
  const cheap = rankDestinations({ ...defaultTrip(), budget: 200, interests: ['city'] }, TODAY);
  assert.ok(cheap.slice(0, 3).every((r) => r.dest.costLevel === 1));
  const short = rankDestinations({ ...defaultTrip(), nights: 1 }, TODAY);
  assert.ok(short.slice(0, 5).every((r) => r.dest.flightH <= 2.5));
});

test('Such-Links enthalten Flughafen, Ziel und Daten', () => {
  const trip = { ...defaultTrip(), airport: 'FDH', from: '2026-12-05', nights: 3 };
  const links = flightLinks(trip, findDestination('Lissabon'));
  const sky = links.find((l) => l.label === 'Skyscanner').url;
  assert.equal(sky, 'https://www.skyscanner.de/transport/flights/fdh/lis/261205/261208/');
  const kayak = links.find((l) => l.label === 'Kayak').url;
  assert.equal(kayak, 'https://www.kayak.de/flights/FDH-LIS/2026-12-05/2026-12-08');
  const g = decodeURIComponent(links.find((l) => l.label === 'Google Flüge').url);
  assert.ok(g.includes('Flights from FDH to LIS on 2026-12-05 through 2026-12-08'));
  for (const l of links) assert.ok(l.url.startsWith('https://'));
});

test('flexible Suche ohne Ziel verlinkt "Überallhin"', () => {
  const links = flightLinks({ ...defaultTrip(), airport: 'STR' });
  assert.ok(links.some((l) => l.url === 'https://www.skyscanner.de/transport/flights-from/str/'));
});

test('unbekannte Stadt bekommt trotzdem eine Flugsuche', () => {
  const links = flightLinks({ ...defaultTrip() }, null, 'Sevilla');
  assert.equal(links.length, 1);
  assert.ok(decodeURIComponent(links[0].url).includes('to Sevilla'));
});

test('Blind-Ziel kommt aus den Top 5', () => {
  const ranked = rankDestinations({ ...defaultTrip(), interests: ['city'] }, TODAY);
  const top = ranked.slice(0, 5).map((r) => r.dest.code);
  for (const x of [0, 0.3, 0.6, 0.99]) assert.ok(top.includes(drawBlind(ranked, () => x).code));
});

test('findDestination erkennt Stadt und Code', () => {
  assert.equal(findDestination('lissabon').code, 'LIS');
  assert.equal(findDestination('BCN').city, 'Barcelona');
  assert.equal(findDestination('Atlantis'), null);
});
