// Ersetzt die Firebase-SDK-Module im Testbrowser durch Attrappen.
// Accounts (Passwort "correct"): nils@test, johannes@test (Mitglieder), stranger@test (kein Mitglied), locked@test (Regeln fehlen)
// Firestore-Daten liegen in localStorage["mockdb"] -> Tabs im selben Kontext teilen sich die "Datenbank"
// und bekommen Änderungen live (storage-Event). Schreibzugriffe prüfen dieselben Besitzregeln wie firestore.rules.
const appJs = `export const initializeApp = (c) => ({ options: c });`;

const authJs = `
const listeners = new Set();
const USERS = { 'nils@test': 'u-nils', 'johannes@test': 'u-johannes', 'stranger@test': 'u-x', 'locked@test': 'u-locked' };
let current = JSON.parse(sessionStorage.getItem('mockUser') || 'null');
const emit = () => listeners.forEach((cb) => setTimeout(() => cb(current), 0));
export const getAuth = () => ({});
export const browserLocalPersistence = 'local';
export const browserSessionPersistence = 'session';
export async function setPersistence() {}
export function onAuthStateChanged(auth, cb) { listeners.add(cb); setTimeout(() => cb(current), 50); return () => listeners.delete(cb); }
export async function signInWithEmailAndPassword(auth, email, pw) {
  await new Promise((r) => setTimeout(r, 150));
  if (!USERS[email] || pw !== 'correct') throw Object.assign(new Error('bad'), { code: 'auth/invalid-credential' });
  current = { uid: USERS[email], email };
  sessionStorage.setItem('mockUser', JSON.stringify(current));
  emit();
  return { user: current };
}
export async function signOut() { current = null; sessionStorage.removeItem('mockUser'); emit(); }
export async function sendPasswordResetEmail() {}
`;

const firestoreJs = `
const MEMBERS = { 'u-nils': { displayName: 'Nils' }, 'u-johannes': { displayName: 'Johannes' } };
const KEY = 'mockdb';
const uid = () => JSON.parse(sessionStorage.getItem('mockUser') || 'null')?.uid;
const load = () => JSON.parse(localStorage.getItem(KEY) || '{}');
const subs = new Set();
const notify = () => subs.forEach((s) => s.fire());
function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); notify(); }
window.addEventListener('storage', (e) => { if (e.key === KEY) notify(); });
const revive = (v) => JSON.parse(JSON.stringify(v), (k, x) => (x && typeof x === 'object' && '__ts' in x ? { toMillis: () => x.__ts } : x));
const deny = () => { throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }); };

function checkWrite(col, id, data) {
  const me = uid();
  if (!me || !MEMBERS[me]) deny();
  if (col === 'ratings') {
    if (data.uid !== me || id !== me + '_' + data.activityId) deny();
    if (!(Number.isInteger(data.rating) && data.rating >= 0 && data.rating <= 5)) deny();
    if ('note' in data && (typeof data.note !== 'string' || data.note.length > 2000)) deny();
  } else if (col === 'activityState') {
    if (!['open', 'planned', 'done'].includes(data.status) || data.updatedBy !== me) deny();
  } else if (col === 'comments') {
    if (load().comments?.[id]) deny(); // keine Update-Regel für Kommentare
    if (data.uid !== me || typeof data.body !== 'string' || !data.body.length || data.body.length > 2000) deny();
  } else if (col === 'suggestions') {
    if (data.fromUid !== me || !MEMBERS[data.toUid] || data.response !== 'pending') deny();
  } else deny();
}

export const getFirestore = () => ({});
export const doc = (db, col, id) => ({ col, id });
export const collection = (db, col) => ({ col });
export const where = (f, op, v) => ({ f, op, v });
export const query = (ref, ...filters) => ({ col: ref.col, filters });
const matches = (ref, v) => !ref.filters || ref.filters.every((w) => v[w.f] === w.v);
export const serverTimestamp = () => ({ __ts: Date.now() });
export async function getDoc(ref) {
  if (ref.id === 'u-locked') throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
  const data = MEMBERS[ref.id];
  return { id: ref.id, exists: () => !!data, data: () => data };
}
export async function getDocs(ref) {
  return { docs: Object.entries(MEMBERS).map(([id, d]) => ({ id, data: () => d })) };
}
export function onSnapshot(ref, next) {
  const s = { fire: () => {
    const d = load()[ref.col] || {};
    // Lese-Regel für Vorschläge: nur mit passendem Filter auf die eigene uid
    if (ref.col === 'suggestions' && !(ref.filters || []).some((w) => w.v === uid())) throw new Error('permission-denied (query)');
    next({ docs: Object.entries(d).filter(([, v]) => matches(ref, v)).map(([id, v]) => ({ id, data: () => revive(v) })) });
  } };
  subs.add(s);
  setTimeout(s.fire, 0);
  return () => subs.delete(s);
}
export async function setDoc(ref, data) {
  checkWrite(ref.col, ref.id, data);
  const d = load(); (d[ref.col] ||= {})[ref.id] = data; save(d);
}
export async function addDoc(ref, data) {
  const id = Math.random().toString(36).slice(2, 12);
  checkWrite(ref.col, id, data);
  const d = load(); (d[ref.col] ||= {})[id] = data; save(d);
  return { id };
}
export async function updateDoc(ref, patch) {
  const d = load();
  const cur = d[ref.col]?.[ref.id];
  if (!cur) throw Object.assign(new Error('not found'), { code: 'not-found' });
  if (ref.col !== 'suggestions') deny();
  if (cur.toUid !== uid()) deny();
  if (!Object.keys(patch).every((k) => ['response', 'responseNote', 'respondedAt'].includes(k))) deny();
  if (!['yes', 'maybe', 'no'].includes(patch.response)) deny();
  d[ref.col][ref.id] = { ...cur, ...patch }; save(d);
}
export async function deleteDoc(ref) {
  const d = load();
  const cur = d[ref.col]?.[ref.id];
  if (ref.col === 'comments' && cur && cur.uid !== uid()) deny();
  if (ref.col === 'suggestions' && cur && cur.fromUid !== uid()) deny();
  if (cur) { delete d[ref.col][ref.id]; save(d); }
}
`;

export async function mockFirebase(page) {
  const body = { 'firebase-app.js': appJs, 'firebase-auth.js': authJs, 'firebase-firestore.js': firestoreJs };
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => {
    const file = route.request().url().split('/').pop();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: body[file] });
  });
}
