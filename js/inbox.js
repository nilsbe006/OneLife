// Vorschläge: Formular in der Detailansicht und Inbox (#/inbox)
import { activityById } from './activities.js';
import {
  suggest, respond, withdraw, incoming, outgoing, suggestionsFor, millis, myUid,
  RESPONSE_LABEL, MAX_MESSAGE,
} from './store.js';
import { toast, nameOf } from './social.js';
import { esc, initials } from './util.js';

const fmtDay = (iso) => new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
  .format(new Date(`${iso}T12:00:00`));
const fmtWhen = (ms) => new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
const today = () => new Date().toISOString().slice(0, 10);

function errorToast(err) {
  console.warn(err);
  toast(err?.code === 'permission-denied' ? 'Keine Berechtigung – sind die Firestore-Regeln aktuell?' : 'Das hat nicht geklappt. Bist du online?');
}

/* ---------- Detail: "Johannes vorschlagen" ---------- */
export function mountSuggest(container, activityId, session) {
  const friend = session.friend;
  if (!friend) { container.innerHTML = ''; return { refresh() {} }; }
  const friendName = esc(friend.displayName);
  let open = false;

  function render() {
    const list = suggestionsFor(activityId);
    const status = list.map((x) => {
      const fromMe = x.fromUid === myUid();
      const who = fromMe ? `Du hast ${friendName}` : `${esc(nameOf(session, x.fromUid))} hat dir`;
      return `<li class="sug-line sug-${x.response}">${who} das ${fmtWhen(millis(x.createdAt))} vorgeschlagen${x.proposedDate ? ` (für ${fmtDay(x.proposedDate)})` : ''} – <strong>${RESPONSE_LABEL[x.response]}</strong>${
        !fromMe && x.response === 'pending' ? ' · <a href="#/inbox">Jetzt antworten</a>' : ''}</li>`;
    }).join('');
    container.innerHTML = `
      ${status ? `<ul class="sug-lines">${status}</ul>` : ''}
      ${open ? `
        <form class="sug-form" id="sug-form">
          <label class="field"><span>Nachricht an ${friendName} (optional)</span>
            <textarea id="sug-msg" rows="2" maxlength="${MAX_MESSAGE}" placeholder="Wie wär’s? Ich hätte richtig Bock drauf!"></textarea></label>
          <label class="field"><span>Wunschtermin (optional)</span>
            <input type="date" id="sug-date" min="${today()}"></label>
          <div class="sug-actions">
            <button type="button" class="btn btn-ghost btn-sm" id="sug-cancel">Abbrechen</button>
            <button type="submit" class="btn btn-primary btn-sm" id="sug-send">Vorschlag senden</button>
          </div>
        </form>` : `
        <button type="button" class="btn btn-ghost btn-block" id="sug-open">💬 ${friendName} vorschlagen</button>`}`;

    container.querySelector('#sug-open')?.addEventListener('click', () => { open = true; render(); container.querySelector('#sug-msg').focus(); });
    container.querySelector('#sug-cancel')?.addEventListener('click', () => { open = false; render(); });
    container.querySelector('#sug-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = container.querySelector('#sug-send');
      btn.disabled = true;
      try {
        await suggest(activityId, { message: container.querySelector('#sug-msg').value, proposedDate: container.querySelector('#sug-date').value || null });
        open = false;
        toast(`Vorschlag an ${friend.displayName} gesendet 🚀`);
        render();
      } catch (err) {
        errorToast(err);
        btn.disabled = false;
      }
    });
  }
  render();
  // Während das Formular offen ist, nicht neu zeichnen (sonst gehen Eingaben verloren)
  return { refresh: () => { if (!open) render(); } };
}

/* ---------- #/inbox ---------- */
export function inboxView(el, session) {
  const friendName = session.friend ? esc(session.friend.displayName) : 'Dein Freund';
  let editing = null; // id des Vorschlags, für den gerade eine Notiz getippt wird

  function item(x, mine) {
    const a = activityById(x.activityId);
    if (!a) return '';
    const from = esc(nameOf(session, x.fromUid));
    const pending = x.response === 'pending';
    return `
      <li class="sug sug-${x.response}" data-id="${esc(x.id)}">
        <a class="sug-img" href="#/activity/${esc(a.id)}"><img src="${esc(a.image.src)}" alt="" loading="lazy" onerror="this.remove()"></a>
        <div class="sug-body">
          <p class="sug-meta">${mine ? `An ${friendName}` : `<span class="avatar avatar-2">${initials(nameOf(session, x.fromUid))}</span> ${from}`} · ${fmtWhen(millis(x.createdAt))}</p>
          <a class="sug-title" href="#/activity/${esc(a.id)}">${esc(a.name)}</a>
          ${x.proposedDate ? `<p class="sug-date">📅 Wunschtermin: ${fmtDay(x.proposedDate)}</p>` : ''}
          ${x.message ? `<p class="sug-msg">„${esc(x.message)}“</p>` : ''}
          <p class="sug-state">Antwort: <strong>${RESPONSE_LABEL[x.response]}</strong>${x.responseNote ? ` – „${esc(x.responseNote)}“` : ''}</p>
          ${!mine && pending ? `
            <label class="sr-only" for="note-${esc(x.id)}">Antwort-Notiz</label>
            <input class="sug-note" id="note-${esc(x.id)}" type="text" maxlength="${MAX_MESSAGE}" placeholder="Kurze Antwort (optional)">
            <div class="sug-buttons">
              <button type="button" class="btn btn-primary btn-sm" data-respond="yes">Bin dabei</button>
              <button type="button" class="btn btn-ghost btn-sm" data-respond="maybe">Vielleicht</button>
              <button type="button" class="btn btn-ghost btn-sm" data-respond="no">Lieber nicht</button>
            </div>` : ''}
          ${mine ? `<button type="button" class="link-btn" data-withdraw>Vorschlag ${pending ? 'zurückziehen' : 'löschen'}</button>` : ''}
        </div>
      </li>`;
  }

  function render() {
    if (editing) return;
    const inc = incoming();
    const out = outgoing();
    const pending = inc.filter((x) => x.response === 'pending');
    const answered = inc.filter((x) => x.response !== 'pending');
    el.innerHTML = `
      <section class="container">
        <header class="page-head">
          <p class="eyebrow">Zwischen euch beiden</p>
          <h1 class="display page-title">Vorschläge</h1>
          <p class="page-lead">Schlag ${friendName} auf jeder Abenteuer-Seite etwas vor – hier landen die Antworten.</p>
        </header>
        <h2 class="section-sub">Für dich <span class="count" id="inbox-pending">${pending.length}</span></h2>
        ${inc.length ? `<ul class="sugs" id="sugs-in">${[...pending, ...answered].map((x) => item(x, false)).join('')}</ul>`
          : `<p class="muted list-empty">${friendName} hat dir noch nichts vorgeschlagen.</p>`}
        <h2 class="section-sub">Von dir <span class="count">${out.length}</span></h2>
        ${out.length ? `<ul class="sugs" id="sugs-out">${out.map((x) => item(x, true)).join('')}</ul>`
          : `<p class="muted list-empty">Du hast noch nichts vorgeschlagen. <a href="#/all">Abenteuer aussuchen</a></p>`}
      </section>`;

    el.querySelectorAll('.sug-note').forEach((inp) => {
      inp.addEventListener('focus', () => { editing = inp.closest('.sug').dataset.id; });
      inp.addEventListener('blur', () => { setTimeout(() => { if (document.activeElement?.classList.contains('sug-note')) return; editing = null; }, 0); });
    });
    el.querySelectorAll('[data-respond]').forEach((b) => b.addEventListener('click', async () => {
      const li = b.closest('.sug');
      const note = li.querySelector('.sug-note')?.value || '';
      editing = null;
      li.querySelectorAll('button').forEach((x) => { x.disabled = true; });
      try {
        await respond(li.dataset.id, b.dataset.respond, note);
        toast(b.dataset.respond === 'yes' ? 'Zugesagt! Status steht jetzt auf „Geplant“.' : `Antwort gesendet: ${RESPONSE_LABEL[b.dataset.respond]}`);
      } catch (err) {
        errorToast(err);
      }
      render();
    }));
    el.querySelectorAll('[data-withdraw]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Vorschlag wirklich löschen?')) return;
      try { await withdraw(b.closest('.sug').dataset.id); toast('Vorschlag gelöscht'); } catch (err) { errorToast(err); }
    }));
  }
  render();
  return { refresh: render };
}
