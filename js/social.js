// Gemeinsame Interaktionen: Favorit, Sterne, Status, Kommentare
import {
  getRating, getStatus, getComments, setFavorite, setRating, setStatus, addComment, deleteComment,
  averageRating, myUid, friendUid, millis, STATUS, STATUS_LABEL, MAX_COMMENT,
} from './store.js';
import { esc, initials } from './util.js';

const toastEl = () => document.getElementById('toast');
export function toast(msg, ms = 2600) {
  const el = toastEl();
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, ms);
}

async function safely(promise, okMsg) {
  try {
    await promise;
    if (okMsg) toast(okMsg);
  } catch (err) {
    console.warn('Speichern fehlgeschlagen', err);
    toast(err?.code === 'permission-denied' ? 'Keine Berechtigung – sind die Firestore-Regeln aktuell?' : 'Speichern fehlgeschlagen. Bist du online?');
  }
}

export const nameOf = (session, uid) => session.members.find((m) => m.uid === uid)?.displayName || 'Jemand';

export function starsText(n, max = 5) {
  return '★'.repeat(n) + '☆'.repeat(max - n);
}

const fmtDate = (ms) => new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

/* ---------- Kleine Indikatoren für Karten ---------- */
export function cardSocial(activityId) {
  const me = myUid();
  if (!me) return { mine: { favorite: false, rating: 0 }, match: false, status: 'open', avg: null };
  const mine = getRating(me, activityId);
  const fr = friendUid() ? getRating(friendUid(), activityId) : { favorite: false };
  return { mine, match: mine.favorite && fr.favorite, status: getStatus(activityId).status, avg: averageRating(activityId) };
}

/* ---------- Detail: Interaktions-Panel ---------- */
export function renderSocial(container, activityId, session) {
  const me = myUid();
  const friend = session.friend;
  const mine = getRating(me, activityId);
  const theirs = friend ? getRating(friend.uid, activityId) : null;
  const st = getStatus(activityId);
  const avg = averageRating(activityId);
  const match = mine.favorite && theirs?.favorite;

  container.innerHTML = `
    ${match ? '<div class="match-banner" role="status">🔥 <strong>It’s a Match!</strong> Ihr wollt das beide machen.</div>' : ''}
    <div class="social-row">
      <button type="button" class="fav-btn${mine.favorite ? ' on' : ''}" id="fav-btn" aria-pressed="${mine.favorite}"
              aria-label="${mine.favorite ? 'Aus Favoriten entfernen' : 'Als Favorit markieren'}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></svg>
        <span>${mine.favorite ? 'Favorit' : 'Merken'}</span>
      </button>
      <div class="rate">
        <span class="rate-label">Deine Bewertung</span>
        <div class="stars" role="radiogroup" aria-label="Deine Bewertung">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star${n <= mine.rating ? ' on' : ''}" data-star="${n}"
              role="radio" aria-checked="${n === mine.rating}" aria-label="${n} ${n === 1 ? 'Stern' : 'Sterne'}">★</button>`).join('')}
        </div>
      </div>
    </div>

    <div class="people">
      <div class="person">
        <span class="avatar">${initials(session.me.displayName)}</span>
        <span class="person-name">Du</span>
        <span class="person-stars" aria-label="${mine.rating} von 5 Sternen">${mine.rating ? starsText(mine.rating) : '<span class="muted">noch nicht bewertet</span>'}</span>
        ${mine.favorite ? '<span class="person-fav" title="Favorit">♥</span>' : ''}
      </div>
      ${friend ? `
      <div class="person" id="friend-rating">
        <span class="avatar avatar-2">${initials(friend.displayName)}</span>
        <span class="person-name">${esc(friend.displayName)}</span>
        <span class="person-stars" aria-label="${theirs.rating} von 5 Sternen">${theirs.rating ? starsText(theirs.rating) : '<span class="muted">noch nicht bewertet</span>'}</span>
        ${theirs.favorite ? '<span class="person-fav" title="Favorit">♥</span>' : ''}
      </div>` : ''}
      ${avg ? `<p class="avg">Ø ${avg.toLocaleString('de-DE', { maximumFractionDigits: 1 })} von 5</p>` : ''}
    </div>

    <div class="status-block">
      <span class="rate-label">Gemeinsamer Status</span>
      <div class="segmented" role="radiogroup" aria-label="Status">
        ${STATUS.map((s) => `<button type="button" class="seg${st.status === s ? ' on' : ''}" data-status="${s}" role="radio" aria-checked="${st.status === s}">${STATUS_LABEL[s]}</button>`).join('')}
      </div>
      ${st.updatedBy ? `<p class="muted small" id="status-meta">Zuletzt geändert von ${esc(st.updatedBy === me ? 'dir' : nameOf(session, st.updatedBy))}</p>` : ''}
    </div>`;

  container.querySelector('#fav-btn').addEventListener('click', () => {
    safely(setFavorite(activityId, !mine.favorite), mine.favorite ? 'Aus Favoriten entfernt' : 'Zu Favoriten hinzugefügt ♥');
  });
  container.querySelectorAll('.star').forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.star);
    const next = n === mine.rating ? 0 : n; // gleiche Zahl nochmal = Bewertung entfernen
    safely(setRating(activityId, next), next ? `Mit ${next} ${next === 1 ? 'Stern' : 'Sternen'} bewertet` : 'Bewertung entfernt');
  }));
  container.querySelectorAll('.seg').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.status === st.status) return;
    safely(setStatus(activityId, b.dataset.status), `Status: ${STATUS_LABEL[b.dataset.status]}`);
  }));
}

/* ---------- Detail: Kommentar-Thread ---------- */
export function mountComments(container, activityId, session) {
  container.innerHTML = `
    <h2 class="h2">Kommentare</h2>
    <ul class="comments" id="comment-list" aria-live="polite"></ul>
    <form class="comment-form" id="comment-form">
      <label class="sr-only" for="comment-input">Kommentar schreiben</label>
      <textarea id="comment-input" rows="2" maxlength="${MAX_COMMENT}"
        placeholder="z. B. „Das müssen wir unbedingt machen.“ oder „Im Winter ausprobieren.“"></textarea>
      <div class="comment-actions">
        <span class="muted small" id="comment-count">0/${MAX_COMMENT}</span>
        <button type="submit" class="btn btn-primary btn-sm" id="comment-send" disabled>Senden</button>
      </div>
    </form>`;

  const list = container.querySelector('#comment-list');
  const form = container.querySelector('#comment-form');
  const input = container.querySelector('#comment-input');
  const send = container.querySelector('#comment-send');
  const counter = container.querySelector('#comment-count');

  function renderList() {
    const comments = getComments(activityId);
    const me = myUid();
    list.innerHTML = comments.length ? comments.map((c) => `
      <li class="comment${c.uid === me ? ' mine' : ''}">
        <span class="avatar${c.uid === me ? '' : ' avatar-2'}">${initials(nameOf(session, c.uid))}</span>
        <div class="comment-bubble">
          <div class="comment-head"><strong>${esc(c.uid === me ? 'Du' : nameOf(session, c.uid))}</strong>
            <time class="muted small">${fmtDate(millis(c.createdAt))}</time></div>
          <p>${esc(c.body)}</p>
          ${c.uid === me ? `<button type="button" class="link-btn comment-del" data-id="${esc(c.id)}">Löschen</button>` : ''}
        </div>
      </li>`).join('') : '<li class="muted comment-empty">Noch keine Kommentare. Schreib den ersten!</li>';
    list.querySelectorAll('.comment-del').forEach((b) => b.addEventListener('click', () => {
      if (confirm('Kommentar löschen?')) safely(deleteComment(b.dataset.id), 'Kommentar gelöscht');
    }));
  }

  input.addEventListener('input', () => {
    counter.textContent = `${input.value.length}/${MAX_COMMENT}`;
    send.disabled = !input.value.trim();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) form.requestSubmit();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    send.disabled = true;
    try {
      await addComment(activityId, text);
      input.value = '';
      counter.textContent = `0/${MAX_COMMENT}`;
    } catch (err) {
      console.warn(err);
      toast('Kommentar konnte nicht gespeichert werden.');
      send.disabled = false;
    }
  });

  renderList();
  return { refresh: renderList };
}
