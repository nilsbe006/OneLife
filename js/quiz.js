// Adventure Finder – Fragen, Antwortoptionen und dynamische Regeln.
// Reine Daten + Funktionen ohne DOM-Zugriff -> mit Node testbar (tests/quiz.test.mjs).

const IMG = (id) => `https://images.unsplash.com/photo-${id}?w=700&q=65&auto=format&fit=crop`;

/**
 * Jede Frage: id, title, (hint), multi (Mehrfachauswahl), options[].
 * Option: value, label, (sub), (icon), (image), (exclusive = hebt andere Auswahl auf).
 */
export const QUESTIONS = [
  {
    id: 'mood',
    short: 'Lust',
    title: 'Worauf hast du heute Lust?',
    hint: 'Mehrfachauswahl möglich',
    multi: true,
    options: [
      { value: 'adrenaline', label: 'Adrenalin und Action', icon: '⚡', image: IMG('1601024445121-e5b82f020549') },
      { value: 'nature', label: 'Natur und Outdoor', icon: '🌲', image: IMG('1440581572325-0bea30075d9d') },
      { value: 'spontaneous', label: 'Spontane Abenteuer', icon: '🎲', image: IMG('1469854523086-cc02fe5d8800') },
      { value: 'special', label: 'Ein besonderes Erlebnis', icon: '✨', image: IMG('1478131143081-80f7f84ca84d') },
      { value: 'weekend', label: 'Ein Wochenendtrip', icon: '🧳', image: IMG('1517400508447-f8dd518b86db') },
      { value: 'new', label: 'Einfach mal etwas komplett Neues ausprobieren', icon: '🚀', image: IMG('1528543606781-2f6e6857f318') },
    ],
  },
  {
    id: 'duration',
    short: 'Dauer',
    title: 'Wie lange soll das Abenteuer dauern?',
    options: [
      { value: 'hours', label: 'Ein paar Stunden', sub: 'ca. 2–4 Stunden', icon: '⏱️' },
      { value: 'halfday', label: 'Ein halber Tag', sub: 'ca. 4–6 Stunden', icon: '🌗' },
      { value: 'day', label: 'Ein ganzer Tag', sub: 'Früh los, spät zurück', icon: '☀️' },
      { value: 'weekend', label: 'Ein komplettes Wochenende', sub: '1–2 Übernachtungen', icon: '🏕️' },
      { value: 'multiday', label: 'Mehrere Tage / Ausland', sub: '3+ Tage', icon: '🌍' },
    ],
  },
  {
    id: 'budget',
    short: 'Budget',
    title: 'Wie viel möchten wir ausgeben?',
    hint: 'Geschätzte Gesamtkosten pro Person',
    options: [
      { value: 'free', label: 'Möglichst kostenlos', sub: 'Höchstens Sprit & Snacks', icon: '🆓' },
      { value: 'lt30', label: 'Unter 30 €', sub: 'pro Person', icon: '💶' },
      { value: '30-100', label: '30–100 €', sub: 'pro Person', icon: '💳' },
      { value: '100-300', label: '100–300 €', sub: 'pro Person', icon: '💰' },
      { value: 'gt300', label: 'Über 300 € möglich', sub: 'pro Person', icon: '💎' },
      { value: 'any', label: 'Budget spielt diesmal keine große Rolle', icon: '🤑' },
    ],
  },
  {
    id: 'setting',
    short: 'Ort',
    title: 'Wo soll das Abenteuer stattfinden?',
    hint: 'Mehrfachauswahl möglich',
    multi: true,
    options: [
      { value: 'outdoor', label: 'Draußen in der Natur', icon: '🏞️' },
      { value: 'indoor', label: 'Drinnen', sub: 'Wetterunabhängig', icon: '🏠' },
      { value: 'city', label: 'Stadt / besondere Orte', icon: '🏙️' },
      { value: 'any', label: 'Egal, Hauptsache Erlebnis', icon: '🤙', exclusive: true },
    ],
  },
  {
    id: 'distance',
    short: 'Entfernung',
    title: 'Wie weit wollen wir fahren?',
    hint: 'Ab Ulm – Fahrzeiten sind Schätzwerte mit dem Auto',
    options: [
      { value: '30', label: 'Bis 30 Minuten', sub: 'z. B. Blautal, Lonetal', icon: '📍' },
      { value: '60', label: 'Bis 60 Minuten', sub: 'z. B. Schwäbische Alb, Lautertal', icon: '🚗' },
      { value: '120', label: 'Bis 120 Minuten', sub: 'z. B. Allgäu, Bodensee', icon: '🛣️' },
      { value: '180', label: 'Bis 180 Minuten', sub: 'z. B. Tirol, Vorarlberg, Schwarzwald', icon: '🏔️' },
      { value: 'de', label: 'Ganz Deutschland', icon: '🇩🇪' },
      { value: 'eu', label: 'Auch Österreich und andere Länder', icon: '🗺️' },
      { value: 'fly', label: 'Flugreisen ins Ausland', sub: 'ab Stuttgart oder Friedrichshafen', icon: '✈️' },
    ],
  },
  {
    id: 'adrenaline',
    short: 'Adrenalin',
    title: 'Wie viel Adrenalin darf es sein?',
    options: [
      { value: '1', label: 'Entspannt und gemütlich', icon: '😌' },
      { value: '2', label: 'Etwas Action darf dabei sein', icon: '🙂' },
      { value: '3', label: 'Ich möchte meinen Puls spüren', icon: '💓' },
      { value: '4', label: 'Richtiges Abenteuer und Nervenkitzel', icon: '🔥' },
    ],
  },
  {
    id: 'when',
    short: 'Zeitpunkt',
    title: 'Wann soll es stattfinden?',
    hint: 'Saison und Wetter werden bei den Vorschlägen berücksichtigt',
    options: [
      { value: 'now', label: 'Heute / morgen', icon: '⚡' },
      { value: 'weekend', label: 'Dieses Wochenende', icon: '📅' },
      { value: 'weeks', label: 'In den nächsten Wochen', icon: '🗓️' },
      { value: 'weather', label: 'Irgendwann, wenn das Wetter passt', icon: '🌤️' },
      { value: 'anytime', label: 'Keine zeitliche Einschränkung', icon: '♾️' },
    ],
  },
  {
    id: 'prep',
    short: 'Vorbereitung',
    title: 'Wie spontan möchten wir sein?',
    hint: 'Manche Abenteuer brauchen Buchung, Guide oder Ausrüstung',
    options: [
      { value: 'none', label: 'Einfach losfahren und machen', sub: 'Keine Buchung, keine Spezialausrüstung', icon: '🏃' },
      { value: 'little', label: 'Ein bisschen Vorbereitung ist okay', sub: 'Stirnlampe einpacken, Öffnungszeiten checken', icon: '🎒' },
      { value: 'booking', label: 'Buchung und Planung sind kein Problem', sub: 'Tickets, Termine, Anbieter', icon: '📝' },
      { value: 'big', label: 'Auch größere Abenteuer mit Vorbereitung', sub: 'Guides, Ausrüstung, Reiseplanung', icon: '🧭' },
    ],
  },
];

export const QUESTION_COUNT = QUESTIONS.length;
export const questionById = (id) => QUESTIONS.find((q) => q.id === id);

/* ---------- Dynamische Regeln ---------- */

const has = (answers, id, value) => {
  const a = answers[id];
  return Array.isArray(a) ? a.includes(value) : a === value;
};

/**
 * Gibt für eine Option einen Grund zurück, warum sie bei den bisherigen
 * Antworten nicht sinnvoll ist (dann ausgegraut), sonst null.
 */
export function disabledReason(questionId, value, answers) {
  if (questionId === 'distance') {
    const far = { 120: 1, 180: 1, de: 1, eu: 1, fly: 1 };
    if (has(answers, 'duration', 'hours') && far[value]) return 'Für ein paar Stunden zu weit';
    if (has(answers, 'duration', 'halfday') && ['180', 'de', 'eu', 'fly'].includes(value)) return 'Für einen halben Tag zu weit';
    if (has(answers, 'duration', 'day') && value === 'fly') return 'Flugreise passt nicht in einen Tag';
    if ((has(answers, 'budget', 'free') || has(answers, 'budget', 'lt30')) && value === 'fly') return 'Flüge sprengen dieses Budget';
  }
  if (questionId === 'prep' && value === 'big') {
    if (has(answers, 'when', 'now')) return 'Für heute/morgen ist das zu viel Vorbereitung';
    if (has(answers, 'when', 'weekend')) return 'Bis zum Wochenende kaum zu schaffen';
  }
  if (questionId === 'duration' && value === 'multiday' && has(answers, 'when', 'now')) {
    // "when" kommt erst später – greift nur, wenn die Frage nachträglich geändert wird
    return 'Mehrtägige Reise ab heute/morgen ist kaum planbar';
  }
  return null;
}

/** Optionen, die zu den bisherigen Antworten besonders gut passen. */
export function recommended(questionId, answers) {
  const rec = new Set();
  const mood = answers.mood || [];
  if (questionId === 'duration') {
    if (mood.includes('weekend')) rec.add('weekend');
    if (mood.includes('spontaneous')) { rec.add('hours'); rec.add('halfday'); }
  }
  if (questionId === 'setting' && mood.includes('nature')) rec.add('outdoor');
  if (questionId === 'distance') {
    if (has(answers, 'duration', 'hours')) { rec.add('30'); rec.add('60'); }
    if (has(answers, 'duration', 'weekend')) { rec.add('180'); rec.add('eu'); }
    if (has(answers, 'duration', 'multiday')) rec.add('fly');
  }
  if (questionId === 'adrenaline' && mood.includes('adrenaline')) { rec.add('3'); rec.add('4'); }
  if (questionId === 'prep') {
    if (has(answers, 'when', 'now') || mood.includes('spontaneous')) rec.add('none');
    if (has(answers, 'duration', 'multiday')) rec.add('big');
  }
  return rec;
}

/** Wendet eine Auswahl auf eine Frage an und gibt die neue Antwort zurück. */
export function toggleOption(question, current, value) {
  if (!question.multi) return value;
  const list = Array.isArray(current) ? [...current] : [];
  const option = question.options.find((o) => o.value === value);
  if (list.includes(value)) return list.filter((v) => v !== value);
  if (option?.exclusive) return [value];
  const exclusive = question.options.filter((o) => o.exclusive).map((o) => o.value);
  return [...list.filter((v) => !exclusive.includes(v)), value];
}

/**
 * Entfernt Antworten, die durch geänderte frühere Antworten ungültig wurden.
 * Gibt { answers, removed: [{ questionId, value, reason }] } zurück.
 */
export function sanitize(answers) {
  const next = { ...answers };
  const removed = [];
  for (const q of QUESTIONS) {
    const a = next[q.id];
    if (a == null) continue;
    const values = Array.isArray(a) ? a : [a];
    const keep = [];
    for (const v of values) {
      const reason = disabledReason(q.id, v, next);
      if (reason) removed.push({ questionId: q.id, value: v, reason });
      else keep.push(v);
    }
    next[q.id] = q.multi ? keep : (keep[0] ?? null);
    if (q.multi && keep.length === 0) next[q.id] = null;
  }
  return { answers: next, removed };
}

export const isAnswered = (a) => (Array.isArray(a) ? a.length > 0 : a != null);

/** Lesbare Kurzfassung einer Antwort, z. B. für die Profil-Chips. */
export function answerLabel(questionId, answer) {
  const q = questionById(questionId);
  if (!q || !isAnswered(answer)) return 'Egal';
  const values = Array.isArray(answer) ? answer : [answer];
  return values.map((v) => q.options.find((o) => o.value === v)?.label ?? v).join(', ');
}

/** Index der ersten noch unbeantworteten (und nicht übersprungenen) Frage. */
export function firstOpenIndex(answers, skipped = []) {
  const i = QUESTIONS.findIndex((q) => !isAnswered(answers[q.id]) && !skipped.includes(q.id));
  return i === -1 ? QUESTIONS.length : i;
}
