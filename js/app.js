import { watchSession, login, logout, resetPassword, errorMessage } from './auth.js';
import { VIEWS, initials } from './views.js';
import { nav } from './nav.js';
import { startSync, stopSync, onChange, pendingIncomingCount } from './store.js';

const $ = (sel) => document.querySelector(sel);

const screens = {
  loading: $('#screen-loading'),
  login: $('#screen-login'),
  app: $('#screen-app'),
};

export const state = { session: null };

function show(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
}

export function toast(message, ms = 2600) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, ms);
}

/* ---------- Login ---------- */
const form = $('#login-form');
const emailInput = $('#login-email');
const pwInput = $('#login-password');
const errorBox = $('#login-error');
const infoBox = $('#login-info');
const submitBtn = $('#login-submit');

function setLoginMessage(box, text) {
  errorBox.hidden = true;
  infoBox.hidden = true;
  if (!box) return;
  box.textContent = text;
  box.hidden = false;
}

function failLogin(text) {
  setLoginMessage(errorBox, text);
  form.classList.remove('shake');
  void form.offsetWidth; // Animation neu starten
  form.classList.add('shake');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = emailInput.value;
  const password = pwInput.value;
  if (!email.trim() || !password) {
    failLogin('Bitte gib E-Mail und Passwort ein.');
    return;
  }
  setLoginMessage(null);
  submitBtn.disabled = true;
  submitBtn.textContent = 'Unlocking …';
  try {
    await login(email, password, $('#login-remember').checked);
    pwInput.value = '';
  } catch (err) {
    failLogin(errorMessage(err));
    pwInput.select();
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Unlock Adventure';
  }
});

$('#toggle-pw').addEventListener('click', (e) => {
  const visible = pwInput.type === 'text';
  pwInput.type = visible ? 'password' : 'text';
  e.currentTarget.textContent = visible ? 'Zeigen' : 'Verbergen';
  e.currentTarget.setAttribute('aria-label', visible ? 'Passwort anzeigen' : 'Passwort verbergen');
});

$('#login-reset').addEventListener('click', async () => {
  const email = emailInput.value.trim();
  if (!email) {
    failLogin('Gib zuerst deine E-Mail-Adresse ein, dann schicken wir dir einen Link.');
    emailInput.focus();
    return;
  }
  try {
    await resetPassword(email);
  } catch (err) {
    if (err.code === 'auth/invalid-email' || err.code === 'auth/network-request-failed') {
      failLogin(errorMessage(err));
      return;
    }
    // andere Fehler nicht verraten (kein Hinweis, ob ein Account existiert)
  }
  setLoginMessage(infoBox, 'Falls ein Account zu dieser Adresse existiert, ist ein Link zum Zurücksetzen unterwegs.');
});

$('#logout-btn').addEventListener('click', async () => {
  stopSync();
  await logout();
  toast('Bis zum nächsten Abenteuer!');
});

/* ---------- App & Router ---------- */
// Hash-Routing (#/finder …) funktioniert auf GitHub Pages ohne Server-Konfiguration.
function currentRoute() {
  const [name = '', ...params] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: VIEWS[name] ? name : 'home', params };
}

function render() {
  if (!state.session) return;
  const { name, params } = currentRoute();
  nav.depth += 1;
  const main = $('#main');
  main.innerHTML = '';
  const view = document.createElement('div');
  view.className = `view view-${name}`;
  main.append(view);
  current = VIEWS[name](view, state.session, params) || null;
  const navRoute = { results: 'finder', activity: 'all', trip: 'home' }[name] || name;
  $('#bell').classList.toggle('active', name === 'inbox');
  document.querySelectorAll('.nav a').forEach((a) => {
    const active = a.dataset.route === navRoute;
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);

// Live-Updates aus Firestore an die aktuelle Ansicht weitergeben
let current = null;
onChange(() => {
  current?.refresh?.();
  updateBell();
});

function updateBell() {
  const n = state.session ? pendingIncomingCount() : 0;
  const badge = $('#bell-badge');
  badge.textContent = n > 9 ? '9+' : String(n);
  badge.hidden = n === 0;
  $('#bell').setAttribute('aria-label', n ? `Vorschläge – ${n} offen` : 'Vorschläge');
}
let syncErrorShown = false;

function renderUser() {
  const { me } = state.session;
  $('#user-chip').innerHTML = `<span class="avatar">${initials(me.displayName)}</span><span class="user-name"></span>`;
  $('#user-chip .user-name').textContent = me.displayName || me.email;
}

watchSession((session) => {
  if (session?.error) {
    state.session = null;
    show('login');
    failLogin(session.error);
    return;
  }
  state.session = session;
  if (!session) {
    stopSync();
    current = null;
    show('login');
    return;
  }
  syncErrorShown = false;
  startSync(session, {
    onError: (err) => {
      if (syncErrorShown) return;
      syncErrorShown = true;
      toast(err?.code === 'permission-denied'
        ? 'Daten konnten nicht geladen werden – sind die Firestore-Regeln veröffentlicht?'
        : 'Verbindung zur Datenbank unterbrochen.', 5000);
    },
  });
  renderUser();
  show('app');
  render();
});
