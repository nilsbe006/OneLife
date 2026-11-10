import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { auth, db } from './firebase.js';

const ERRORS = {
  'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht.',
  'auth/invalid-login-credentials': 'E-Mail oder Passwort stimmt nicht.',
  'auth/wrong-password': 'E-Mail oder Passwort stimmt nicht.',
  'auth/user-not-found': 'E-Mail oder Passwort stimmt nicht.',
  'auth/invalid-email': 'Das sieht nicht nach einer gültigen E-Mail-Adresse aus.',
  'auth/missing-password': 'Bitte gib dein Passwort ein.',
  'auth/too-many-requests': 'Zu viele Versuche. Bitte warte kurz und probiere es dann erneut.',
  'auth/network-request-failed': 'Keine Verbindung. Prüfe dein Internet.',
  'auth/user-disabled': 'Dieser Account wurde deaktiviert.',
  'not-member': 'Dieser Account ist für ONE LIFE nicht freigeschaltet.',
};

export function errorMessage(err) {
  return ERRORS[err?.code] || 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.';
}

export async function login(email, password, remember = true) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export const logout = () => signOut(auth);

export const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim());

/**
 * Meldet Session-Änderungen. Eine Session ist nur gültig, wenn es ein
 * Dokument members/{uid} gibt (Allowlist). cb(null) = ausgeloggt,
 * cb({ user, me, members }) = eingeloggt, cb({ error }) = kein Zugriff.
 */
export function watchSession(cb) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return cb(null);
    try {
      const meSnap = await getDoc(doc(db, 'members', user.uid));
      if (!meSnap.exists()) throw Object.assign(new Error('not member'), { code: 'not-member' });
      const all = await getDocs(collection(db, 'members'));
      const members = all.docs.map((d) => ({ uid: d.id, ...d.data() }));
      const me = { uid: user.uid, email: user.email, ...meSnap.data() };
      cb({ user, me, members, friend: members.find((m) => m.uid !== user.uid) || null });
    } catch (err) {
      const code = err.code === 'permission-denied' ? 'not-member' : err.code;
      await signOut(auth);
      cb({ error: errorMessage({ code }) });
    }
  });
}
