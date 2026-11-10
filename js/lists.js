// Favoriten (inkl. Matches) und erledigte Abenteuer
import { ACTIVITIES, activityById } from './activities.js';
import { favoritesOf, idsWithStatus, getStatus, millis, myUid, friendUid } from './store.js';
import { card } from './cards.js';
import { esc } from './util.js';

const cards = (ids) => `<div class="cards">${ids.map(activityById).filter(Boolean).map((a) => card(a)).join('')}</div>`;

function section(id, title, ids, emptyText) {
  return `
    <section class="list-section" id="${id}">
      <h2 class="section-sub">${title} <span class="count">${ids.length}</span></h2>
      ${ids.length ? cards(ids) : `<p class="muted list-empty">${emptyText}</p>`}
    </section>`;
}

/* ---------- #/favorites ---------- */
export function favoritesView(el, session) {
  const friendName = session.friend ? esc(session.friend.displayName) : 'Dein Freund';
  function render() {
    const mine = favoritesOf(myUid());
    const theirs = friendUid() ? favoritesOf(friendUid()) : [];
    const matches = mine.filter((id) => theirs.includes(id));
    const onlyMine = mine.filter((id) => !matches.includes(id));
    const onlyTheirs = theirs.filter((id) => !matches.includes(id));
    el.innerHTML = `
      <section class="container">
        <header class="page-head">
          <p class="eyebrow">Was euch reizt</p>
          <h1 class="display page-title">Favoriten</h1>
          <p class="page-lead">Markiert Abenteuer mit einem Herz. Wenn ihr beide dasselbe markiert, ist es ein Match.</p>
        </header>
        ${!mine.length && !theirs.length ? `
          <div class="empty"><strong>Noch keine Favoriten</strong>
            <p>Öffne ein Abenteuer und tippe auf „Merken“.</p>
            <a class="btn btn-primary btn-sm" href="#/all">Abenteuer entdecken</a></div>` : `
          ${section('fav-matches', '🔥 Matches', matches, `Noch kein Match – schau dir die Favoriten von ${friendName} an.`)}
          ${section('fav-mine', 'Deine Favoriten', onlyMine, 'Alle deine Favoriten sind schon Matches.')}
          ${section('fav-theirs', `Favoriten von ${friendName}`, onlyTheirs, `${friendName} hat noch nichts zusätzlich markiert.`)}`}
      </section>`;
  }
  render();
  return { refresh: render };
}

/* ---------- #/completed ---------- */
export function completedView(el) {
  function render() {
    const done = idsWithStatus('done')
      .filter((id) => activityById(id))
      .sort((a, b) => millis(getStatus(b).doneAt) - millis(getStatus(a).doneAt));
    const planned = idsWithStatus('planned').filter((id) => activityById(id));
    const total = ACTIVITIES.length;
    const pct = total ? Math.round((done.length / total) * 100) : 0;
    el.innerHTML = `
      <section class="container">
        <header class="page-head">
          <p class="eyebrow">Eure Abenteuer-Bilanz</p>
          <h1 class="display page-title">Erledigt</h1>
        </header>
        <div class="stats" id="stats">
          <div class="stat"><span class="stat-num" id="stat-done">${done.length}</span><span class="stat-label">erledigt</span></div>
          <div class="stat"><span class="stat-num">${total}</span><span class="stat-label">Abenteuer gesamt</span></div>
          <div class="stat"><span class="stat-num" id="stat-pct">${pct}%</span><span class="stat-label">geschafft</span></div>
          <div class="stat"><span class="stat-num">${planned.length}</span><span class="stat-label">geplant</span></div>
          <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Fortschritt">
            <div class="progress-bar" style="width:${pct}%"></div>
          </div>
        </div>
        ${section('list-planned', 'Geplant', planned, 'Noch nichts geplant – setzt bei einem Abenteuer den Status auf „Geplant“.')}
        ${section('list-done', 'Erledigt', done, 'Noch nichts erledigt. Zeit, das zu ändern!')}
        <p class="muted small">Tippe auf ein Abenteuer, um es erneut zu öffnen oder den Status zurückzusetzen.</p>
      </section>`;
  }
  render();
  return { refresh: render };
}
