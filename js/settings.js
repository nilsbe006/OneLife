// Konto & Daten: Export/Import als JSON (Backup)
import { snapshotAll, restoreBackup, myUid } from './store.js';
import { local, loadQuiz, saveQuiz } from './storage.js';
import { resetPassword } from './auth.js';
import { toast } from './social.js';
import { esc } from './util.js';

export const BACKUP_APP = 'onelife-adventure-planner';
export const BACKUP_VERSION = 1;

export function buildBackup(session) {
  const uid = session.me.uid;
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: { uid, displayName: session.me.displayName || '' },
    data: snapshotAll(),
    local: { quiz: loadQuiz(uid), catalogFilter: local.get(`${uid}:catalogFilter`, null) },
  };
}

/** Prüft eine eingelesene Datei. Wirft einen Fehler mit verständlicher Meldung. */
export function parseBackup(text) {
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('Die Datei ist kein gültiges JSON.'); }
  if (json?.app !== BACKUP_APP) throw new Error('Das ist kein ONE-LIFE-Backup.');
  if (json.version !== BACKUP_VERSION) throw new Error(`Unbekannte Backup-Version (${json.version}).`);
  if (typeof json.data !== 'object' || !json.data) throw new Error('Das Backup enthält keine Daten.');
  return json;
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function settingsView(el, session) {
  const { me } = session;
  el.innerHTML = `
    <section class="container narrow">
      <header class="page-head">
        <p class="eyebrow">Konto & Daten</p>
        <h1 class="display page-title">Einstellungen</h1>
      </header>

      <div class="panel">
        <h2 class="h2">Dein Konto</h2>
        <dl class="facts">
          <div><dt>Name</dt><dd>${esc(me.displayName || '–')}</dd></div>
          <div><dt>E-Mail</dt><dd>${esc(me.email || '–')}</dd></div>
        </dl>
        <div class="panel-actions">
          <button type="button" class="btn btn-ghost btn-sm" id="pw-reset">Passwort ändern (Link per E-Mail)</button>
          <button type="button" class="btn btn-ghost btn-sm" id="settings-logout">Logout</button>
        </div>
      </div>

      <div class="panel">
        <h2 class="h2">Backup exportieren</h2>
        <p class="muted">Lädt eure gemeinsamen Daten (Bewertungen, Favoriten, Status, Kommentare, Vorschläge) und deine Finder-Antworten als JSON-Datei herunter.</p>
        <button type="button" class="btn btn-primary" id="export-btn">JSON exportieren</button>
      </div>

      <div class="panel">
        <h2 class="h2">Backup importieren</h2>
        <p class="muted">Stellt fehlende Daten aus einem Export wieder her. Vorhandene Einträge werden <strong>nicht</strong> überschrieben, und Daten von ${esc(session.friend?.displayName || 'deinem Freund')} kann nur ${esc(session.friend?.displayName || 'er')} selbst wiederherstellen.</p>
        <label class="btn btn-ghost file-btn">
          <input type="file" id="import-file" accept="application/json,.json">
          JSON-Datei auswählen
        </label>
        <p class="form-info" id="import-result" role="status" hidden></p>
        <p class="form-error" id="import-error" role="alert" hidden></p>
      </div>

      <p class="muted small">Die Daten liegen in Firebase (Firestore) und sind nur für eure beiden Accounts sichtbar. Der Aktivitätenkatalog und das Design der Seite sind öffentlich auf GitHub.</p>
    </section>`;

  el.querySelector('#pw-reset').addEventListener('click', async () => {
    try { await resetPassword(me.email); toast('Link zum Ändern des Passworts ist unterwegs.'); } catch { toast('Konnte keinen Link senden.'); }
  });
  el.querySelector('#settings-logout').addEventListener('click', () => document.getElementById('logout-btn').click());

  el.querySelector('#export-btn').addEventListener('click', () => {
    const backup = buildBackup(session);
    const date = new Date().toISOString().slice(0, 10);
    download(`onelife-backup-${(me.displayName || 'user').toLowerCase()}-${date}.json`, JSON.stringify(backup, null, 2));
    toast('Backup heruntergeladen');
  });

  el.querySelector('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    const resultEl = el.querySelector('#import-result');
    const errorEl = el.querySelector('#import-error');
    resultEl.hidden = true;
    errorEl.hidden = true;
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      if (!confirm(`Backup vom ${new Date(backup.exportedAt).toLocaleString('de-DE')} importieren? Vorhandene Daten bleiben unverändert.`)) return;
      const r = await restoreBackup(backup);
      let quizNote = '';
      const currentQuiz = loadQuiz(myUid());
      if (backup.local?.quiz && backup.exportedBy?.uid === myUid() && !Object.keys(currentQuiz.answers).length) {
        saveQuiz(myUid(), backup.local.quiz);
        quizNote = ' Finder-Antworten wiederhergestellt.';
      }
      resultEl.textContent = `Wiederhergestellt: ${r.ratings} Bewertungen/Favoriten, ${r.states} Status, ${r.comments} Kommentare. Übersprungen (schon vorhanden oder nicht deine): ${r.skipped}.${quizNote}`;
      resultEl.hidden = false;
    } catch (err) {
      errorEl.textContent = err.message || 'Import fehlgeschlagen.';
      errorEl.hidden = false;
    } finally {
      e.target.value = '';
    }
  });
}
