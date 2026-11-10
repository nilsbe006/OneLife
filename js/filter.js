// Filter- und Scoring-Logik für den Adventure Finder.
// Reine Funktionen ohne DOM -> mit Node testbar (tests/filter.test.mjs).
//
// Harte Kriterien (Budget, Dauer, Entfernung, Saison, Vorbereitung) entscheiden,
// ob eine Aktivität ein "perfekter Treffer" ist. Weiche Kriterien (Lust, Ort,
// Adrenalin) beeinflussen nur die Reihenfolge und werden als Hinweis angezeigt.
import { costLabel, monthName } from './activities.js';

const DUR_ORDER = { hours: 0, halfday: 1, day: 2, weekend: 3, multiday: 4 };
const DUR_TEXT = { hours: 'ein paar Stunden', halfday: 'einen halben Tag', day: 'einen ganzen Tag', weekend: 'ein Wochenende', multiday: 'mehrere Tage' };

// "Möglichst kostenlos" lässt Kleinstbeträge (Picknick, Parken) bis 5 € zu
export const BUDGET_LIMIT = { free: 5, lt30: 30, '30-100': 100, '100-300': 300, gt300: Infinity, any: Infinity };
export const DISTANCE_LIMIT = { 30: 30, 60: 60, 120: 120, 180: 180, de: 480, eu: 600, fly: Infinity };
const ADRENALINE_RANGE = { 1: [1, 2], 2: [2, 3], 3: [3, 4], 4: [4, 5] };
const MOOD_TEXT = { adrenaline: 'Action', nature: 'Natur', spontaneous: 'Spontan', special: 'Besonderes Erlebnis', weekend: 'Wochenendtrip', new: 'Etwas Neues' };

const HARD_PENALTY = 40;

/* ---------- Saison ---------- */

/** Nächster Samstag (oder heute, wenn Wochenende). */
function upcomingWeekend(now) {
  const d = new Date(now);
  const day = d.getDay(); // 0 = So, 6 = Sa
  if (day !== 0 && day !== 6) d.setDate(d.getDate() + (6 - day));
  return d;
}

/** Monate (1–12), in denen die Aktivität für die Antwort "Wann" stattfinden müsste. */
export function relevantMonths(when, now = new Date()) {
  const m = (d) => d.getMonth() + 1;
  if (when === 'now') {
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    return [...new Set([m(now), m(tomorrow)])];
  }
  if (when === 'weekend') {
    const sat = upcomingWeekend(now);
    const sun = new Date(sat); sun.setDate(sun.getDate() + 1);
    return [...new Set([m(sat), m(sun)])];
  }
  if (when === 'weeks') {
    const months = new Set();
    for (let i = 0; i <= 42; i += 7) { const d = new Date(now); d.setDate(d.getDate() + i); months.add(m(d)); }
    return [...months];
  }
  return null; // "wenn das Wetter passt" / "keine Einschränkung"
}

export const inSeason = (activity, months) => !months || months.some((mo) => activity.months.includes(mo));
export const inSeasonNow = (activity, now = new Date()) => activity.months.includes(now.getMonth() + 1);

function seasonRange(activity) {
  const ms = activity.months;
  if (ms.length === 12) return 'ganzjährig';
  return activity.seasonText || ms.map(monthName).join(', ');
}

/* ---------- Einzelkriterien ---------- */
// Jede Prüfung liefert { key, label, status: 'ok' | 'soft' | 'hard', reason, penalty }

function checkMood(a, mood) {
  if (!mood?.length) return null;
  const hit = mood.filter((m) => a.categories.includes(m));
  if (hit.length) return { key: 'mood', label: 'Lust', status: 'ok', reason: hit.map((m) => MOOD_TEXT[m]).join(', '), penalty: 0 };
  return { key: 'mood', label: 'Lust', status: 'soft', reason: `eher ${a.categories.map((c) => MOOD_TEXT[c]).slice(0, 2).join(' / ')}`, penalty: 25 };
}

function checkDuration(a, duration) {
  if (!duration) return null;
  const need = DUR_ORDER[a.duration];
  const have = DUR_ORDER[duration];
  if (need > have) return { key: 'duration', label: 'Dauer', status: 'hard', reason: `braucht ${DUR_TEXT[a.duration]} statt ${DUR_TEXT[duration]}`, penalty: HARD_PENALTY };
  if (have - need >= 3) return { key: 'duration', label: 'Dauer', status: 'soft', reason: `deutlich kürzer als ${DUR_TEXT[duration]}`, penalty: 10 };
  return { key: 'duration', label: 'Dauer', status: 'ok', reason: a.durationText, penalty: 0 };
}

function checkBudget(a, budget) {
  if (!budget) return null;
  const limit = BUDGET_LIMIT[budget];
  // "Unter 30 €" ist exklusiv gemeint, alle anderen Grenzen inklusiv
  const over = (v) => (budget === 'lt30' ? v >= limit : v > limit);
  if (over(a.cost.min)) {
    const lim = budget === 'free' ? 'möglichst kostenlos' : budget === 'lt30' ? 'unter 30 €' : `max. ${limit} €`;
    return { key: 'budget', label: 'Budget', status: 'hard', reason: `${costLabel(a)} statt ${lim}`, penalty: HARD_PENALTY };
  }
  if (over(a.cost.max)) return { key: 'budget', label: 'Budget', status: 'soft', reason: `${costLabel(a)} – kann knapp werden`, penalty: 8 };
  return { key: 'budget', label: 'Budget', status: 'ok', reason: costLabel(a), penalty: 0 };
}

function checkSetting(a, setting) {
  if (!setting?.length || setting.includes('any')) return null;
  if (setting.some((s) => a.setting.includes(s))) return { key: 'setting', label: 'Ort', status: 'ok', reason: '', penalty: 0 };
  const where = { outdoor: 'draußen', indoor: 'drinnen', city: 'in der Stadt' };
  return { key: 'setting', label: 'Ort', status: 'soft', reason: `findet ${a.setting.map((s) => where[s]).join('/')} statt`, penalty: 20 };
}

function checkDistance(a, distance) {
  if (!distance) return null;
  const limit = DISTANCE_LIMIT[distance];
  if (a.travel === 'flight') {
    if (distance !== 'fly') return { key: 'distance', label: 'Entfernung', status: 'hard', reason: 'nur mit Flugreise', penalty: HARD_PENALTY };
    return { key: 'distance', label: 'Entfernung', status: 'ok', reason: 'Flugreise', penalty: 0 };
  }
  if (distance === 'de' && a.country !== 'DE') return { key: 'distance', label: 'Entfernung', status: 'hard', reason: 'liegt im Ausland', penalty: HARD_PENALTY };
  if (a.driveMin > limit) return { key: 'distance', label: 'Entfernung', status: 'hard', reason: `ca. ${a.driveMin} min statt max. ${limit} min`, penalty: HARD_PENALTY };
  return { key: 'distance', label: 'Entfernung', status: 'ok', reason: `ca. ${a.driveMin} min`, penalty: 0 };
}

function checkAdrenaline(a, adrenaline) {
  if (!adrenaline) return null;
  const [lo, hi] = ADRENALINE_RANGE[adrenaline];
  const diff = a.adrenaline < lo ? lo - a.adrenaline : a.adrenaline > hi ? a.adrenaline - hi : 0;
  if (diff === 0) return { key: 'adrenaline', label: 'Adrenalin', status: 'ok', reason: `Level ${a.adrenaline}/5`, penalty: 0 };
  const dir = a.adrenaline < lo ? 'entspannter' : 'wilder';
  return { key: 'adrenaline', label: 'Adrenalin', status: 'soft', reason: `${diff >= 2 ? 'deutlich ' : ''}${dir} als gewünscht (Level ${a.adrenaline}/5)`, penalty: diff >= 2 ? 25 : 10 };
}

function checkWhen(a, when, now) {
  if (!when) return null;
  const months = relevantMonths(when, now);
  if (!inSeason(a, months)) {
    return { key: 'when', label: 'Saison', status: 'hard', reason: `gerade keine Saison (${seasonRange(a)})`, penalty: HARD_PENALTY };
  }
  if (when === 'now' && a.spontaneity < 3) return { key: 'when', label: 'Zeitpunkt', status: 'hard', reason: 'braucht mehr Vorlauf als heute/morgen', penalty: HARD_PENALTY };
  if (when === 'weekend' && a.spontaneity < 2) return { key: 'when', label: 'Zeitpunkt', status: 'hard', reason: 'bis zum Wochenende kaum planbar', penalty: HARD_PENALTY };
  return { key: 'when', label: 'Saison', status: 'ok', reason: months ? 'passt zur Jahreszeit' : '', penalty: 0 };
}

function checkPrep(a, prep) {
  if (!prep) return null;
  const why = [];
  if (a.bookingRequired) why.push('Buchung nötig');
  if (a.guideRequired) why.push('Guide/Führung nötig');
  if (prep === 'none' && (a.bookingRequired || a.guideRequired || a.spontaneity < 4)) {
    return { key: 'prep', label: 'Spontanität', status: 'hard', reason: why.length ? why.join(', ') : 'braucht etwas Vorbereitung', penalty: HARD_PENALTY };
  }
  if (prep === 'little' && (a.bookingRequired || a.spontaneity < 3)) {
    return { key: 'prep', label: 'Spontanität', status: 'hard', reason: why.length ? why.join(', ') : 'braucht Planung', penalty: HARD_PENALTY };
  }
  if (prep === 'booking' && a.spontaneity < 2) {
    return { key: 'prep', label: 'Spontanität', status: 'hard', reason: 'braucht größere Planung', penalty: HARD_PENALTY };
  }
  return { key: 'prep', label: 'Spontanität', status: 'ok', reason: '', penalty: 0 };
}

/* ---------- Bewertung ---------- */

export function evaluate(activity, answers = {}, now = new Date()) {
  const checks = [
    checkMood(activity, answers.mood),
    checkDuration(activity, answers.duration),
    checkBudget(activity, answers.budget),
    checkSetting(activity, answers.setting),
    checkDistance(activity, answers.distance),
    checkAdrenaline(activity, answers.adrenaline),
    checkWhen(activity, answers.when, now),
    checkPrep(activity, answers.prep),
  ].filter(Boolean);
  const hard = checks.filter((c) => c.status === 'hard');
  const soft = checks.filter((c) => c.status === 'soft');
  const score = 100 - checks.reduce((sum, c) => sum + c.penalty, 0);
  return { activity, score, checks, hard, soft, perfect: hard.length === 0 };
}

/**
 * Sortiert alle Aktivitäten nach Passung.
 * perfect: alle harten Kriterien erfüllt (nach Score sortiert)
 * alternatives: nächstbeste mit 1–2 verfehlten harten Kriterien
 */
export function rank(activities, answers = {}, now = new Date(), { maxAlternatives = 6 } = {}) {
  const results = activities.map((a) => evaluate(a, answers, now));
  const byScore = (x, y) => y.score - x.score || x.activity.name.localeCompare(y.activity.name, 'de');
  const perfect = results.filter((r) => r.perfect).sort(byScore);
  const alternatives = results
    .filter((r) => !r.perfect && r.hard.length <= 2)
    .sort((x, y) => x.hard.length - y.hard.length || byScore(x, y))
    .slice(0, maxAlternatives);
  return { perfect, alternatives, all: results.sort(byScore) };
}
