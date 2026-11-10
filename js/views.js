// Ansichten der App. Jede View bekommt den Container und den Session-Kontext.
import { CONFIG } from './config.js';
import { esc, initials } from './util.js';
import { finderView, resultsView } from './finder.js';
import { allView, detailView } from './catalog.js';
import { favoritesView, completedView } from './lists.js';
import { inboxView } from './inbox.js';
import { settingsView } from './settings.js';
import { buildFeed, timeAgo } from './feed.js';
import { activityById, ACTIVITIES } from './activities.js';
import { favoritesOf, idsWithStatus, myUid, friendUid, pendingIncomingCount } from './store.js';

export { esc, initials };

const IMG = (id, w = 1200) => `https://images.unsplash.com/${id}?w=${w}&q=70&auto=format&fit=crop`;

function home(el, { me, friend }) {
  const myName = esc(me.displayName || 'Abenteurer');
  const friendName = friend ? esc(friend.displayName) : null;
  el.innerHTML = `
    <section class="hero">
      <div class="hero-bg" aria-hidden="true"></div>
      <div class="container">
        <p class="eyebrow">Hey ${myName}</p>
        <h1 class="display hero-title">One life.<span>No limits.</span></h1>
        <p class="hero-lead">Das nächste Wochenende könnte legendär werden.</p>
        <p class="hero-sub">Two friends. One bucketlist. Countless adventures.</p>
        <div class="hero-actions">
          <a href="#/finder" class="btn btn-primary btn-lg" id="cta-finder">Let's find an adventure</a>
          <a href="#/all" class="btn btn-ghost btn-lg">Alle Abenteuer</a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <h2 class="display section-title">Euer Basecamp</h2>
        <div class="duo">
          <div class="duo-avatars" aria-hidden="true">
            <span class="avatar">${initials(me.displayName)}</span>
            ${friend ? `<span class="avatar">${initials(friend.displayName)}</span>` : ''}
          </div>
          <div class="duo-text">
            <strong>${myName}${friendName ? ` &amp; ${friendName}` : ''}</strong>
            <span>Startpunkt: ${esc(CONFIG.homeBase.name)} · Bewertungen, Favoriten und Vorschläge teilt ihr miteinander.</span>
          </div>
        </div>
        <div class="home-stats" id="home-stats"></div>
        <div class="tiles">
          <a class="tile" href="#/favorites" style="--img:url('${IMG('photo-1501785888041-af3ef285b470', 900)}')">
            <strong>Favoriten</strong><span>Was euch beide reizt</span>
          </a>
          <a class="tile" href="#/completed" style="--img:url('${IMG('photo-1519681393784-d120267933ba', 900)}')">
            <strong>Erledigt</strong><span>Eure Abenteuer-Bilanz</span>
          </a>
          <a class="tile" href="#/all" style="--img:url('${IMG('photo-1464822759023-fed622ff2c3b', 900)}')">
            <strong>Alle Abenteuer</strong><span>Die komplette Bucketlist</span>
          </a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <h2 class="display section-title">Was gerade passiert</h2>
        <ul class="feed" id="feed"></ul>
      </div>
    </section>`;

  const statsEl = el.querySelector('#home-stats');
  const feedEl = el.querySelector('#feed');
  function refresh() {
    const mine = favoritesOf(myUid());
    const theirs = friendUid() ? favoritesOf(friendUid()) : [];
    const matches = mine.filter((id) => theirs.includes(id)).length;
    const done = idsWithStatus('done').filter((id) => activityById(id)).length;
    const pending = pendingIncomingCount();
    statsEl.innerHTML = `
      <a class="hstat" href="#/favorites"><strong id="hs-matches">${matches}</strong><span>${matches === 1 ? 'Match' : 'Matches'}</span></a>
      <a class="hstat" href="#/completed"><strong id="hs-done">${done}/${ACTIVITIES.length}</strong><span>erledigt</span></a>
      <a class="hstat${pending ? ' hot' : ''}" href="#/inbox"><strong id="hs-pending">${pending}</strong><span>${pending === 1 ? 'offener Vorschlag' : 'offene Vorschläge'}</span></a>`;
    const items = buildFeed(8);
    feedEl.innerHTML = items.length ? items.map((i) => {
      const a = activityById(i.activityId);
      const who = i.uid === myUid() ? 'Du' : (friend && i.uid === friend.uid ? esc(friend.displayName) : 'Jemand');
      return `<li class="feed-item feed-${i.kind}">
        <span class="avatar${i.uid === myUid() ? '' : ' avatar-2'}">${initials(who)}</span>
        <p><strong>${who}</strong> ${who === 'Du' ? 'hast' : 'hat'}${i.pre ? ` ${esc(i.pre)}` : ''} <a href="#/activity/${esc(a.id)}">${esc(a.name)}</a> ${esc(i.post)}
        <time class="muted small">${timeAgo(i.ts)}</time></p></li>`;
    }).join('') : '<li class="muted feed-empty">Noch nichts los. Bewertet ein Abenteuer oder schlagt euch etwas vor!</li>';
  }
  refresh();
  return { refresh };
}

export const VIEWS = {
  home,
  finder: finderView,
  results: resultsView,
  all: allView,
  activity: detailView,
  favorites: favoritesView,
  completed: completedView,
  inbox: inboxView,
  settings: settingsView,
};
