// "Alle Abenteuer" und die Detailansicht einer Aktivität
import {
  ACTIVITIES, activityById, costLabel, driveLabel, DURATION_LABEL, CAVE_TYPE_LABEL, isFree, isSpontaneous, mapsUrl,
} from './activities.js';
import { inSeasonNow } from './filter.js';
import { card, badges, adrenalineDots } from './cards.js';
import { local } from './storage.js';
import { esc } from './util.js';
import { nav } from './nav.js';
import { renderSocial, mountComments } from './social.js';
import { mountSuggest } from './inbox.js';

const CATS = [
  ['all', 'Alle'], ['adrenaline', 'Action'], ['nature', 'Natur'], ['spontaneous', 'Spontan'],
  ['special', 'Besonders'], ['weekend', 'Wochenende'], ['new', 'Neu'],
];
const SORTS = {
  name: ['Name', (a, b) => a.name.localeCompare(b.name, 'de')],
  distance: ['Entfernung', (a, b) => a.driveMin - b.driveMin],
  price: ['Preis', (a, b) => a.cost.min - b.cost.min || a.cost.max - b.cost.max],
  adrenaline: ['Adrenalin', (a, b) => b.adrenaline - a.adrenaline],
};
const defaultFilter = () => ({ q: '', cat: 'all', season: false, free: false, spont: false, sort: 'name' });

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function filterCatalog(list, f, now = new Date()) {
  const q = norm(f.q.trim());
  return list
    .filter((a) => f.cat === 'all' || a.categories.includes(f.cat))
    .filter((a) => !f.season || inSeasonNow(a, now))
    .filter((a) => !f.free || isFree(a))
    .filter((a) => !f.spont || isSpontaneous(a))
    .filter((a) => !q || norm([a.name, a.teaser, a.location.name, a.location.region, ...a.tags].join(' ')).includes(q))
    .sort(SORTS[f.sort]?.[1] || SORTS.name[1]);
}

/* ---------- #/all ---------- */
export function allView(el, session) {
  const key = `${session.me.uid}:catalogFilter`;
  const f = { ...defaultFilter(), ...local.get(key, {}) };

  el.innerHTML = `
    <section class="container">
      <header class="page-head">
        <p class="eyebrow">Die komplette Bucketlist</p>
        <h1 class="display page-title">Alle Abenteuer</h1>
        <p class="page-lead">${ACTIVITIES.length} Ideen rund um Ulm und darüber hinaus. Kosten und Fahrzeiten sind Schätzwerte.</p>
      </header>
      <div class="filters">
        <label class="search">
          <span class="sr-only">Suchen</span>
          <input type="search" id="cat-q" placeholder="Suchen: Höhle, Allgäu, Nacht …" value="${esc(f.q)}" autocomplete="off">
        </label>
        <div class="chips" role="group" aria-label="Kategorie">
          ${CATS.map(([v, l]) => `<button type="button" class="chip${f.cat === v ? ' active' : ''}" data-cat="${v}" aria-pressed="${f.cat === v}">${l}</button>`).join('')}
        </div>
        <div class="filter-row">
          <label class="toggle"><input type="checkbox" id="cat-season" ${f.season ? 'checked' : ''}><span>Gerade Saison</span></label>
          <label class="toggle"><input type="checkbox" id="cat-free" ${f.free ? 'checked' : ''}><span>Kostenlos</span></label>
          <label class="toggle"><input type="checkbox" id="cat-spont" ${f.spont ? 'checked' : ''}><span>Spontan möglich</span></label>
          <label class="sort">
            <span>Sortieren</span>
            <select id="cat-sort">${Object.entries(SORTS).map(([v, [l]]) => `<option value="${v}"${f.sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
          </label>
        </div>
      </div>
      <p class="result-count" id="cat-count" aria-live="polite"></p>
      <div id="cat-list"></div>
    </section>`;

  const list = el.querySelector('#cat-list');
  const count = el.querySelector('#cat-count');

  function update() {
    local.set(key, f);
    const items = filterCatalog(ACTIVITIES, f);
    count.textContent = `${items.length} von ${ACTIVITIES.length} Abenteuern`;
    list.innerHTML = items.length
      ? `<div class="cards">${items.map((a) => card(a)).join('')}</div>`
      : `<div class="empty"><strong>Nichts gefunden</strong><p>Probier andere Filter oder einen anderen Suchbegriff.</p>
         <button type="button" class="btn btn-ghost btn-sm" id="cat-reset">Filter zurücksetzen</button></div>`;
    list.querySelector('#cat-reset')?.addEventListener('click', () => {
      local.set(key, defaultFilter());
      allView(el, session);
    });
  }

  el.querySelector('#cat-q').addEventListener('input', (e) => { f.q = e.target.value; update(); });
  el.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
    f.cat = b.dataset.cat;
    el.querySelectorAll('.chip').forEach((c) => {
      c.classList.toggle('active', c === b);
      c.setAttribute('aria-pressed', String(c === b));
    });
    update();
  }));
  for (const [id, prop] of [['#cat-season', 'season'], ['#cat-free', 'free'], ['#cat-spont', 'spont']]) {
    el.querySelector(id).addEventListener('change', (e) => { f[prop] = e.target.checked; update(); });
  }
  el.querySelector('#cat-sort').addEventListener('change', (e) => { f.sort = e.target.value; update(); });
  update();
  return { refresh: update };
}

/* ---------- #/activity/:id ---------- */
const yesNo = (v) => (v ? 'Ja' : 'Nein');

export function detailView(el, session, params) {
  const a = activityById(params[0]);
  if (!a) {
    el.innerHTML = `<section class="container"><div class="empty" style="margin-top:40px"><strong>Abenteuer nicht gefunden</strong>
      <a class="btn btn-ghost btn-sm" href="#/all">Zu allen Abenteuern</a></div></section>`;
    return;
  }
  const facts = [
    ['Standort', `${esc(a.location.name)}<br><span class="muted">${esc(a.location.region)}</span>`],
    ['Entfernung', `${esc(driveLabel(a))}${a.travel === 'car' ? ' <span class="muted">(Schätzwert)</span>' : ''}`],
    ['Kosten p. P.', `${esc(costLabel(a))}<br><span class="muted">${esc(a.cost.note)}</span>`],
    ['Dauer', `${esc(DURATION_LABEL[a.duration])}<br><span class="muted">${esc(a.durationText)}</span>`],
    ['Schwierigkeit', `${adrenalineDots(a.difficulty).replace('Adrenalin', 'Schwierigkeit')} ${a.difficulty}/5`],
    ['Adrenalin', `${adrenalineDots(a.adrenaline)} ${a.adrenaline}/5`],
    ['Beste Jahreszeit', `${esc(a.seasonText)}${inSeasonNow(a) ? '' : '<br><span class="warn">Gerade keine Saison</span>'}`],
    ['Wetterabhängig', yesNo(a.weatherDependent)],
    ['Buchung nötig', yesNo(a.bookingRequired)],
    ['Führung/Guide nötig', yesNo(a.guideRequired)],
    ['Spontanität', `${a.spontaneity}/5${isSpontaneous(a) ? ' – spontan möglich' : ''}`],
  ];
  if (a.minAge || a.ageNote) facts.push(['Alter', `${a.minAge ? `ab ${a.minAge} Jahren` : ''}${a.ageNote ? `${a.minAge ? '<br>' : ''}<span class="muted">${esc(a.ageNote)}</span>` : ''}`]);
  if (a.caveType) facts.push(['Höhlenzugang', esc(CAVE_TYPE_LABEL[a.caveType])]);

  el.innerHTML = `
    <article class="detail">
      <header class="detail-hero">
        <img src="${esc(a.image.src)}" alt="${esc(a.image.alt)}" onerror="this.remove()">
        <div class="detail-hero-shade"></div>
        <div class="container detail-hero-text">
          <a href="#/all" class="back-link" id="detail-back">← Zurück</a>
          <div class="detail-badges">${badges(a)}</div>
          <h1 class="display detail-title">${esc(a.name)}</h1>
          <p class="detail-teaser">${esc(a.teaser)}</p>
        </div>
      </header>
      <div class="container detail-body">
        <p class="img-credit">Foto: ${esc(a.image.credit)}${a.imageNote ? ` · ${esc(a.imageNote)}` : ''}${
          a.image.source ? ` · <a href="${esc(a.image.source)}" target="_blank" rel="noopener">Quelle</a>` : ''}</p>
        <div class="detail-grid">
          <div class="detail-main">
            <section class="social" id="social" aria-label="Eure Bewertung"></section>
            <section class="suggest-box" id="suggest" aria-label="Vorschlagen"></section>
            <p class="detail-desc">${esc(a.description)}</p>
            <div class="why"><h2>Warum es sich lohnt</h2><p>${esc(a.why)}</p></div>
            ${a.safety ? `<div class="safety" role="note"><strong>Sicherheit:</strong> ${esc(a.safety)}</div>` : ''}
            ${a.caves ? `
              <h2 class="h2">Welche Höhle wie?</h2>
              <ul class="caves">${a.caves.map((c) => `
                <li class="cave cave-${c.type}">
                  <div class="cave-head"><strong>${esc(c.name)}</strong><span class="cave-type">${esc(CAVE_TYPE_LABEL[c.type])}</span></div>
                  <p>${esc(c.note)}</p>
                  <p class="muted">~${c.driveMin} min ab Ulm · <a href="${esc(c.url)}" target="_blank" rel="noopener">Infos</a></p>
                </li>`).join('')}</ul>` : ''}
            ${a.equipment.length ? `<h2 class="h2">Ausrüstung</h2><ul class="equip">${a.equipment.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
            <section class="comments-wrap" id="comments"></section>
          </div>
          <aside class="detail-side">
            <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
            ${a.tripPlanner ? '<a class="btn btn-primary btn-block trip-cta" href="#/trip">✈️ Trip planen</a>' : ''}
            <div class="detail-links">
              ${a.links.map((l) => `<a class="btn btn-ghost btn-block" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}
              <a class="btn btn-ghost btn-block" href="${esc(mapsUrl(a))}" target="_blank" rel="noopener">In Google Maps öffnen ↗</a>
            </div>
            <p class="muted small">Angaben recherchiert im November 2026. Preise, Zeiten und Saison vor dem Losfahren auf der offiziellen Seite prüfen.</p>
          </aside>
        </div>
      </div>
    </article>`;

  const socialEl = el.querySelector('#social');
  const comments = mountComments(el.querySelector('#comments'), a.id, session);
  renderSocial(socialEl, a.id, session);
  const suggestBox = mountSuggest(el.querySelector('#suggest'), a.id, session);

  // Zurück: wenn es eine vorherige Seite in der App gibt, dorthin
  el.querySelector('#detail-back').addEventListener('click', (e) => {
    if (nav.depth > 1) {
      e.preventDefault();
      history.back();
    }
  });

  return {
    refresh() {
      renderSocial(socialEl, a.id, session);
      comments.refresh();
      suggestBox.refresh();
    },
  };
}
