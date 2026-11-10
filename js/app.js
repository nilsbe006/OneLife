import { watchSession, login, logout, resetPassword, errorMessage } from './auth.js';

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

export const initials = (name = '?') => name.trim().slice(0, 1).toUpperCase();

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
  await logout();
  toast('Bis zum nächsten Abenteuer!');
});

/* ---------- App ---------- */
function renderApp() {
  const { me } = state.session;
  $('#user-chip').innerHTML = `<span class="avatar">${initials(me.displayName)}</span><span class="user-name"></span>`;
  $('#user-chip .user-name').textContent = me.displayName || me.email;
  $('#main').innerHTML = `
    <section class="container" style="padding-top:48px">
      <p class="eyebrow">Eingeloggt</p>
      <h1 class="display" style="font-size:3rem">Hallo <span id="hello-name"></span></h1>
    </section>`;
  $('#hello-name').textContent = me.displayName || '';
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
    show('login');
    return;
  }
  renderApp();
  show('app');
});
