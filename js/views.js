// Ansichten der App. Jede View bekommt den Container und den Session-Kontext.
import { CONFIG } from './config.js';
import { esc, initials } from './util.js';
import { finderView, resultsView } from './finder.js';
import { allView, detailView } from './catalog.js';

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
    </section>`;
}

function placeholder(title, lead, note) {
  return (el) => {
    el.innerHTML = `
      <section class="container">
        <header class="page-head">
          <h1 class="display page-title">${title}</h1>
          <p class="page-lead">${lead}</p>
        </header>
        <div class="empty">
          <strong>Kommt gleich</strong>
          <p>${note}</p>
          <a href="#/" class="btn btn-ghost btn-sm">Zur Startseite</a>
        </div>
      </section>`;
  };
}

export const VIEWS = {
  home,
  finder: finderView,
  results: resultsView,
  all: allView,
  activity: detailView,
  favorites: placeholder('Favoriten', 'Alles, was ihr mit einem Herz markiert habt.', 'Favoriten und Matches folgen in Phase 5.'),
  completed: placeholder('Erledigt', 'Eure gemeinsame Abenteuer-Bilanz.', 'Status und Fortschritt folgen in Phase 5.'),
};
