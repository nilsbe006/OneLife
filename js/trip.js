// Blind-Trip-Planer – Daten & Logik (ohne DOM, mit Node testbar: tests/trip.test.mjs)
//
// WICHTIG: Hier gibt es bewusst KEINE Flugpreise und keine Aussagen darüber, ob es
// gerade einen Direktflug gibt. Verbindungen ab STR/FDH ändern sich ständig.
// Wir schlagen Ziele vor und verlinken auf Flugsuchen, in denen die echten,
// aktuellen Preise stehen.

export const AIRPORTS = {
  STR: { code: 'STR', name: 'Stuttgart', driveMin: 60 },
  FDH: { code: 'FDH', name: 'Friedrichshafen', driveMin: 75 },
};

export const INTERESTS = { beach: 'Strand', city: 'Stadt', nature: 'Natur', adventure: 'Abenteuer' };

// flightH = grobe Flugzeit ab Süddeutschland in Stunden (Schätzwert, ohne Umstieg)
// costLevel = Preisniveau vor Ort (1 günstig – 3 teuer), keine Flugpreise
// best = Monate, in denen das Ziel besonders gut passt
export const DESTINATIONS = [
  { code: 'BCN', city: 'Barcelona', country: 'Spanien', flightH: 2, costLevel: 2, interests: ['city', 'beach'], best: [4, 5, 6, 9, 10], why: 'Gaudí, Tapas und Strand in einer Stadt.' },
  { code: 'LIS', city: 'Lissabon', country: 'Portugal', flightH: 3, costLevel: 2, interests: ['city', 'beach', 'adventure'], best: [3, 4, 5, 6, 9, 10], why: 'Hügel, Aussichtspunkte und Surfstrände in Reichweite.' },
  { code: 'OPO', city: 'Porto', country: 'Portugal', flightH: 2.75, costLevel: 1, interests: ['city', 'nature'], best: [4, 5, 6, 9, 10], why: 'Charmant, günstig und mit dem Douro-Tal vor der Tür.' },
  { code: 'FCO', city: 'Rom', country: 'Italien', flightH: 1.75, costLevel: 2, interests: ['city'], best: [3, 4, 5, 10, 11], why: 'Geschichte an jeder Ecke – und die beste Pasta.' },
  { code: 'NAP', city: 'Neapel', country: 'Italien', flightH: 2, costLevel: 1, interests: ['city', 'adventure', 'beach'], best: [4, 5, 6, 9, 10], why: 'Pizza, Vesuv-Wanderung und Amalfiküste.' },
  { code: 'PMI', city: 'Palma de Mallorca', country: 'Spanien', flightH: 2, costLevel: 2, interests: ['beach', 'nature', 'adventure'], best: [4, 5, 6, 9, 10], why: 'Mehr als Ballermann: Buchten, Berge, Klippenspringen.' },
  { code: 'AGP', city: 'Málaga', country: 'Spanien', flightH: 2.75, costLevel: 2, interests: ['beach', 'city', 'adventure'], best: [1, 2, 3, 4, 5, 10, 11, 12], why: 'Sonne auch im Winter – und der Caminito del Rey.' },
  { code: 'ATH', city: 'Athen', country: 'Griechenland', flightH: 2.75, costLevel: 2, interests: ['city', 'beach'], best: [4, 5, 6, 9, 10], why: 'Akropolis am Morgen, Meer am Nachmittag.' },
  { code: 'SPU', city: 'Split', country: 'Kroatien', flightH: 1.5, costLevel: 2, interests: ['beach', 'nature', 'adventure'], best: [5, 6, 9], why: 'Altstadt im Palast, Inseln und Canyoning an der Cetina.' },
  { code: 'BUD', city: 'Budapest', country: 'Ungarn', flightH: 1.5, costLevel: 1, interests: ['city'], best: [3, 4, 5, 9, 10, 12], why: 'Thermalbäder, Ruinenbars und günstige Abende.' },
  { code: 'KRK', city: 'Krakau', country: 'Polen', flightH: 1.75, costLevel: 1, interests: ['city', 'nature'], best: [4, 5, 6, 9, 12], why: 'Wunderschöne Altstadt, Salzbergwerk und Tatra-Nähe.' },
  { code: 'CPH', city: 'Kopenhagen', country: 'Dänemark', flightH: 1.5, costLevel: 3, interests: ['city'], best: [5, 6, 7, 8], why: 'Design, Fahrräder und Hafenbaden im Sommer.' },
  { code: 'AMS', city: 'Amsterdam', country: 'Niederlande', flightH: 1.25, costLevel: 3, interests: ['city'], best: [4, 5, 6, 9], why: 'Grachten, Museen und Nachtleben.' },
  { code: 'EDI', city: 'Edinburgh', country: 'Schottland', flightH: 2, costLevel: 3, interests: ['city', 'nature', 'adventure'], best: [5, 6, 7, 8, 9], why: 'Burg, Arthur’s Seat und die Highlands als Tagestrip.' },
  { code: 'DUB', city: 'Dublin', country: 'Irland', flightH: 2, costLevel: 3, interests: ['city', 'nature'], best: [5, 6, 7, 8, 9], why: 'Pubs, Live-Musik und Klippen an der Küste.' },
  { code: 'KEF', city: 'Reykjavík', country: 'Island', flightH: 4, costLevel: 3, interests: ['nature', 'adventure'], best: [1, 2, 3, 6, 7, 8, 9, 10, 11, 12], why: 'Wasserfälle, Gletscher und mit Glück Nordlichter.' },
  { code: 'BGO', city: 'Bergen', country: 'Norwegen', flightH: 2, costLevel: 3, interests: ['nature', 'adventure', 'city'], best: [5, 6, 7, 8, 9], why: 'Fjorde, Hausberge und bunte Holzhäuser.' },
  { code: 'NCE', city: 'Nizza', country: 'Frankreich', flightH: 1.5, costLevel: 3, interests: ['beach', 'city', 'nature'], best: [5, 6, 9, 10], why: 'Côte d’Azur, Altstadt und Wanderwege ins Hinterland.' },
];

export const destinationByCode = (code) => DESTINATIONS.find((d) => d.code === code);
export const findDestination = (text) => {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return null;
  return DESTINATIONS.find((d) => d.city.toLowerCase() === t || d.code.toLowerCase() === t) || null;
};

export const defaultTrip = () => ({
  airport: 'STR', from: '', to: '', nights: 3, budget: 400, flexible: true, city: '', interests: [], blind: true,
});

/** Validiert und normalisiert die Eingaben. Gibt { trip, errors } zurück. */
export function normalizeTrip(input = {}, today = new Date()) {
  const t = { ...defaultTrip(), ...input };
  const errors = [];
  if (!AIRPORTS[t.airport]) t.airport = 'STR';
  t.nights = Math.max(1, Math.min(14, Math.round(Number(t.nights) || 1)));
  t.budget = Math.max(50, Math.min(3000, Math.round(Number(t.budget) || 400)));
  t.interests = (t.interests || []).filter((i) => INTERESTS[i]);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (t.from && !iso.test(t.from)) t.from = '';
  if (t.to && !iso.test(t.to)) t.to = '';
  const todayIso = today.toISOString().slice(0, 10);
  if (t.from && t.from < todayIso) errors.push('Der Abflug liegt in der Vergangenheit.');
  if (t.from && t.to && t.to <= t.from) errors.push('Die Rückreise muss nach dem Abflug liegen.');
  if (!t.flexible && !t.city.trim()) errors.push('Gib eine Stadt ein oder wähle „flexibel“.');
  return { trip: t, errors };
}

/** Rückreisedatum: explizit oder Abflug + Nächte. */
export function returnDate(trip) {
  if (trip.to) return trip.to;
  if (!trip.from) return '';
  const d = new Date(`${trip.from}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + trip.nights);
  return d.toISOString().slice(0, 10);
}

const travelMonth = (trip, today) => (trip.from ? Number(trip.from.slice(5, 7)) : today.getMonth() + 1);

/**
 * Bewertet Ziele nach Interessen, Reisemonat, Budget (Preisniveau vor Ort) und
 * Reisedauer (kurze Trips -> kurze Flüge). Liefert Gründe für die Anzeige.
 */
export function rankDestinations(trip, today = new Date()) {
  const month = travelMonth(trip, today);
  return DESTINATIONS.map((d) => {
    let score = 0;
    const reasons = [];
    const hits = trip.interests.filter((i) => d.interests.includes(i));
    if (trip.interests.length) {
      score += hits.length * 3;
      if (hits.length) reasons.push(hits.map((h) => INTERESTS[h]).join(' & '));
    }
    if (d.best.includes(month)) { score += 2; reasons.push('gute Reisezeit'); } else { score -= 1; }
    const maxLevel = trip.budget < 300 ? 1 : trip.budget < 600 ? 2 : 3;
    if (d.costLevel > maxLevel) { score -= 4 * (d.costLevel - maxLevel); } else { reasons.push(d.costLevel === 1 ? 'günstig vor Ort' : 'passt zum Budget'); }
    if (trip.nights <= 2 && d.flightH > 2.5) score -= 2;
    if (trip.nights <= 2 && d.flightH <= 2) score += 1;
    return { dest: d, score, reasons };
  }).sort((a, b) => b.score - a.score || a.dest.flightH - b.dest.flightH);
}

/* ---------- Such-Links (echte Preise gibt es nur dort) ---------- */
const yymmdd = (iso) => iso.slice(2).replace(/-/g, '');

export function flightLinks(trip, dest = null, cityText = '') {
  const from = trip.airport;
  const back = returnDate(trip);
  const out = trip.from;
  const links = [];
  if (dest) {
    const code = dest.code;
    const q = `Flights from ${from} to ${code}${out ? ` on ${out}` : ''}${back ? ` through ${back}` : ''}`;
    links.push({ label: 'Google Flüge', url: `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&hl=de` });
    links.push({ label: 'Skyscanner', url: `https://www.skyscanner.de/transport/flights/${from.toLowerCase()}/${code.toLowerCase()}/${out ? `${yymmdd(out)}/` : ''}${out && back ? `${yymmdd(back)}/` : ''}` });
    if (out) links.push({ label: 'Kayak', url: `https://www.kayak.de/flights/${from}-${code}/${out}${back ? `/${back}` : ''}` });
  } else if (cityText) {
    const q = `Flights from ${from} to ${cityText}${out ? ` on ${out}` : ''}${back ? ` through ${back}` : ''}`;
    links.push({ label: 'Google Flüge', url: `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&hl=de` });
  } else {
    // Komplett flexibel: "Überallhin"-Suchen
    links.push({ label: 'Skyscanner: Überallhin', url: `https://www.skyscanner.de/transport/flights-from/${from.toLowerCase()}/` });
    links.push({ label: 'Google Flüge entdecken', url: 'https://www.google.com/travel/explore?hl=de' });
  }
  return links;
}

/** Zufälliges Ziel aus den besten Treffern (für den Blind-Modus). */
export function drawBlind(ranked, rnd = Math.random, top = 5) {
  const pool = ranked.slice(0, Math.min(top, ranked.length));
  return pool[Math.floor(rnd() * pool.length)]?.dest || null;
}
