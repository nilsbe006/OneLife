// Lokale Speicherung (pro Gerät und Account) für Einstellungen wie den Quiz-Stand.
// Gemeinsame Daten (Bewertungen, Kommentare …) kommen in Phase 5 über Firestore dazu.
const PREFIX = 'onelife:';

function safeGet(key) {
  try { return localStorage.getItem(PREFIX + key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(PREFIX + key, value); return true; } catch { return false; }
}

export const local = {
  get(key, fallback = null) {
    const raw = safeGet(key);
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  },
  set(key, value) { return safeSet(key, JSON.stringify(value)); },
  remove(key) { try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ } },
};

/* ---------- Quiz-Stand ---------- */
const quizKey = (uid) => `${uid}:quiz`;
export const emptyQuiz = () => ({ answers: {}, skipped: [], completedAt: null, updatedAt: null });

export function loadQuiz(uid) {
  const q = local.get(quizKey(uid));
  if (!q || typeof q !== 'object' || typeof q.answers !== 'object') return emptyQuiz();
  return { ...emptyQuiz(), ...q };
}
export function saveQuiz(uid, quiz) {
  local.set(quizKey(uid), { ...quiz, updatedAt: new Date().toISOString() });
}
export function resetQuiz(uid) {
  local.remove(quizKey(uid));
}
