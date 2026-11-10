// Gemeinsame Daten (Firestore) mit Live-Synchronisation.
// Datenmodell und Zugriffsregeln: siehe docs/ARCHITECTURE.md und firebase/firestore.rules
//   ratings/{uid}_{activityId}   -> { uid, activityId, rating 0–5, favorite, updatedAt }
//   activityState/{activityId}   -> { status: open|planned|done, updatedBy, updatedAt, doneAt }
//   comments/{autoId}            -> { activityId, uid, body, createdAt }
//   suggestions/{autoId}         -> { fromUid, toUid, activityId, message, proposedDate, response, responseNote, createdAt, respondedAt }
import {
  collection, doc, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot, serverTimestamp, query, where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './firebase.js';

const data = {
  ratings: new Map(), // docId -> rating
  states: new Map(), // activityId -> state
  comments: new Map(), // commentId -> comment
  sugIn: new Map(), // an mich
  sugOut: new Map(), // von mir
};
let me = null;
let friend = null;
let unsubs = [];
const listeners = new Set();
let scheduled = false;
let errorHandler = () => {};

const SNAP = { serverTimestamps: 'estimate' };

function emit() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    listeners.forEach((fn) => fn());
  });
}

/** Wandelt Firestore-Timestamps (oder Mock-Werte) in Millisekunden um. */
export const millis = (t) => (t?.toMillis ? t.toMillis() : typeof t === 'number' ? t : t ? Date.parse(t) : Date.now());

function watch(name, map, keyOf = (d) => d.id, ref = collection(db, name)) {
  return onSnapshot(ref, (snap) => {
    map.clear();
    snap.docs.forEach((d) => map.set(keyOf(d), { id: d.id, ...d.data(SNAP) }));
    emit();
  }, (err) => {
    console.warn(`Sync ${name} fehlgeschlagen`, err);
    errorHandler(err);
  });
}

export function startSync(session, { onError } = {}) {
  stopSync();
  me = session.me.uid;
  friend = session.friend?.uid || null;
  errorHandler = onError || (() => {});
  unsubs = [
    watch('ratings', data.ratings),
    watch('activityState', data.states),
    watch('comments', data.comments),
    // Regeln erlauben nur eigene Vorschläge -> Abfragen müssen danach filtern
    watch('suggestions', data.sugIn, undefined, query(collection(db, 'suggestions'), where('toUid', '==', me))),
    watch('suggestions', data.sugOut, undefined, query(collection(db, 'suggestions'), where('fromUid', '==', me))),
  ];
}

export function stopSync() {
  unsubs.forEach((u) => u());
  unsubs = [];
  data.ratings.clear();
  data.states.clear();
  data.comments.clear();
  data.sugIn.clear();
  data.sugOut.clear();
  me = null;
  friend = null;
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---------- Lesen ---------- */
export const myUid = () => me;
export const friendUid = () => friend;

const ratingId = (uid, activityId) => `${uid}_${activityId}`;

export function getRating(uid, activityId) {
  const r = data.ratings.get(ratingId(uid, activityId));
  return { rating: r?.rating || 0, favorite: !!r?.favorite, updatedAt: r?.updatedAt ?? null };
}

export function getStatus(activityId) {
  const s = data.states.get(activityId);
  return { status: s?.status || 'open', updatedBy: s?.updatedBy || null, updatedAt: s?.updatedAt ?? null, doneAt: s?.doneAt ?? null };
}

export function getComments(activityId) {
  return [...data.comments.values()]
    .filter((c) => c.activityId === activityId)
    .sort((a, b) => millis(a.createdAt) - millis(b.createdAt));
}

/** Aktivitäts-IDs, die ein Nutzer favorisiert hat. */
export function favoritesOf(uid) {
  return [...data.ratings.values()].filter((r) => r.uid === uid && r.favorite).map((r) => r.activityId);
}

export function idsWithStatus(status) {
  return [...data.states.entries()].filter(([, s]) => s.status === status).map(([id]) => id);
}

export const commentCount = (activityId) => getComments(activityId).length;

/** Alle Bewertungen einer Aktivität, z. B. für den Durchschnitt. */
export function ratingsFor(activityId) {
  return [...data.ratings.values()].filter((r) => r.activityId === activityId && r.rating > 0);
}

export function averageRating(activityId) {
  const list = ratingsFor(activityId);
  if (!list.length) return null;
  return list.reduce((s, r) => s + r.rating, 0) / list.length;
}

/* ---------- Schreiben ---------- */
function requireUser() {
  if (!me) throw new Error('Nicht eingeloggt');
  return me;
}

async function writeRating(activityId, patch) {
  const uid = requireUser();
  const current = getRating(uid, activityId);
  await setDoc(doc(db, 'ratings', ratingId(uid, activityId)), {
    uid,
    activityId,
    rating: current.rating,
    favorite: current.favorite,
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export const setFavorite = (activityId, favorite) => writeRating(activityId, { favorite: !!favorite });

export function setRating(activityId, rating) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return writeRating(activityId, { rating: n });
}

export const STATUS = ['open', 'planned', 'done'];
export const STATUS_LABEL = { open: 'Noch nicht ausprobiert', planned: 'Geplant', done: 'Erledigt' };

export async function setStatus(activityId, status) {
  if (!STATUS.includes(status)) throw new Error(`Unbekannter Status: ${status}`);
  const uid = requireUser();
  await setDoc(doc(db, 'activityState', activityId), {
    status,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
    doneAt: status === 'done' ? serverTimestamp() : null,
  });
}

export const MAX_COMMENT = 2000;

export async function addComment(activityId, body) {
  const text = String(body || '').trim();
  if (!text) throw new Error('Leerer Kommentar');
  if (text.length > MAX_COMMENT) throw new Error('Kommentar zu lang');
  const uid = requireUser();
  await addDoc(collection(db, 'comments'), { activityId, uid, body: text, createdAt: serverTimestamp() });
}

export const deleteComment = (commentId) => deleteDoc(doc(db, 'comments', commentId));

/* ---------- Export ---------- */
export function snapshotAll() {
  const plain = (m) => [...m.values()].map((v) => JSON.parse(JSON.stringify(v, (k, x) => (x?.toMillis ? new Date(x.toMillis()).toISOString() : x))));
  return {
    ratings: plain(data.ratings),
    activityState: plain(data.states),
    comments: plain(data.comments),
    suggestions: [...plain(data.sugIn), ...plain(data.sugOut)],
  };
}

/* ---------- Vorschläge ---------- */
export const RESPONSES = ['yes', 'maybe', 'no'];
export const RESPONSE_LABEL = { pending: 'Offen', yes: 'Bin dabei', maybe: 'Vielleicht', no: 'Lieber nicht' };
export const MAX_MESSAGE = 500;

const byNewest = (a, b) => millis(b.createdAt) - millis(a.createdAt);
export const incoming = () => [...data.sugIn.values()].sort(byNewest);
export const outgoing = () => [...data.sugOut.values()].sort(byNewest);
export const pendingIncomingCount = () => incoming().filter((x) => x.response === 'pending').length;
export const suggestionsFor = (activityId) => [...incoming(), ...outgoing()].filter((x) => x.activityId === activityId).sort(byNewest);

export async function suggest(activityId, { message = '', proposedDate = null } = {}) {
  const uid = requireUser();
  if (!friend) throw new Error('Kein Freund gefunden');
  const text = String(message).trim().slice(0, MAX_MESSAGE);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(proposedDate || '') ? proposedDate : null;
  await addDoc(collection(db, 'suggestions'), {
    fromUid: uid,
    toUid: friend,
    activityId,
    message: text,
    proposedDate: date,
    response: 'pending',
    responseNote: '',
    createdAt: serverTimestamp(),
    respondedAt: null,
  });
}

/** Antwort auf einen Vorschlag. "Bin dabei" setzt den gemeinsamen Status auf "Geplant". */
export async function respond(suggestionId, response, note = '') {
  if (!RESPONSES.includes(response)) throw new Error(`Unbekannte Antwort: ${response}`);
  const sug = data.sugIn.get(suggestionId);
  await updateDoc(doc(db, 'suggestions', suggestionId), {
    response,
    responseNote: String(note).trim().slice(0, MAX_MESSAGE),
    respondedAt: serverTimestamp(),
  });
  if (response === 'yes' && sug && getStatus(sug.activityId).status === 'open') {
    await setStatus(sug.activityId, 'planned');
  }
}

export const withdraw = (suggestionId) => deleteDoc(doc(db, 'suggestions', suggestionId));

/** Rohdaten für den Feed (nur lesend). */
export const allData = () => ({
  ratings: [...data.ratings.values()],
  states: [...data.states.entries()].map(([id, v]) => ({ ...v, activityId: id })),
  comments: [...data.comments.values()],
  suggestions: [...data.sugIn.values(), ...data.sugOut.values()],
});

/* ---------- Import (Backup wiederherstellen) ---------- */
/**
 * Stellt fehlende Daten aus einem Export wieder her. Überschreibt nichts, was
 * bereits existiert, und schreibt nur, was die Regeln erlauben (eigene Bewertungen
 * und Kommentare, gemeinsamer Status). Gibt eine Zusammenfassung zurück.
 */
export async function restoreBackup(backup) {
  const uid = requireUser();
  const result = { ratings: 0, states: 0, comments: 0, skipped: 0 };
  const src = backup?.data || {};
  for (const r of src.ratings || []) {
    if (r.uid !== uid || !r.activityId || data.ratings.has(ratingId(uid, r.activityId))) { result.skipped++; continue; }
    await setDoc(doc(db, 'ratings', ratingId(uid, r.activityId)), {
      uid, activityId: r.activityId,
      rating: Math.max(0, Math.min(5, Math.round(Number(r.rating) || 0))),
      favorite: !!r.favorite,
      updatedAt: serverTimestamp(),
    });
    result.ratings++;
  }
  for (const st of src.activityState || []) {
    const id = st.id || st.activityId;
    if (!id || !STATUS.includes(st.status) || st.status === 'open' || data.states.has(id)) { result.skipped++; continue; }
    await setStatus(id, st.status);
    result.states++;
  }
  for (const c of src.comments || []) {
    if (c.uid !== uid || !c.id || !c.activityId || data.comments.has(c.id) || !String(c.body || '').trim()) { result.skipped++; continue; }
    await setDoc(doc(db, 'comments', c.id), {
      activityId: c.activityId, uid, body: String(c.body).slice(0, MAX_COMMENT), createdAt: serverTimestamp(),
    });
    result.comments++;
  }
  result.skipped += (src.suggestions || []).length; // Vorschläge werden nicht wiederhergestellt
  return result;
}
