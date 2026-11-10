// Gemeinsame Daten (Firestore) mit Live-Synchronisation.
// Datenmodell und Zugriffsregeln: siehe docs/ARCHITECTURE.md und firebase/firestore.rules
//   ratings/{uid}_{activityId}   -> { uid, activityId, rating 0–5, favorite, updatedAt }
//   activityState/{activityId}   -> { status: open|planned|done, updatedBy, updatedAt, doneAt }
//   comments/{autoId}            -> { activityId, uid, body, createdAt }
import {
  collection, doc, setDoc, addDoc, deleteDoc, onSnapshot, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './firebase.js';

const data = {
  ratings: new Map(), // docId -> rating
  states: new Map(), // activityId -> state
  comments: new Map(), // commentId -> comment
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

function watch(name, map, keyOf = (d) => d.id) {
  return onSnapshot(collection(db, name), (snap) => {
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
  ];
}

export function stopSync() {
  unsubs.forEach((u) => u());
  unsubs = [];
  data.ratings.clear();
  data.states.clear();
  data.comments.clear();
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

/* ---------- Export (für Backup in Phase 6) ---------- */
export function snapshotAll() {
  const plain = (m) => [...m.values()].map((v) => JSON.parse(JSON.stringify(v, (k, x) => (x?.toMillis ? new Date(x.toMillis()).toISOString() : x))));
  return { ratings: plain(data.ratings), activityState: plain(data.states), comments: plain(data.comments) };
}
