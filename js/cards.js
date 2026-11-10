// Aktivitätskarten (werden in "Alle Abenteuer", Vorschlägen und später Favoriten genutzt)
import { costLabel, driveLabel, DURATION_LABEL, isFree, isSpontaneous } from './activities.js';
import { inSeasonNow } from './filter.js';
import { esc } from './util.js';

export function adrenalineDots(level, max = 5) {
  return `<span class="dots" role="img" aria-label="Adrenalin ${level} von ${max}">${
    Array.from({ length: max }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('')}</span>`;
}

export function badges(a, now = new Date()) {
  const out = [];
  if (isFree(a)) out.push('<span class="badge badge-free">Kostenlos</span>');
  if (isSpontaneous(a)) out.push('<span class="badge badge-spont">Spontan möglich</span>');
  if (a.bookingRequired) out.push('<span class="badge">Buchung nötig</span>');
  if (a.guideRequired) out.push('<span class="badge">Mit Guide</span>');
  if (a.pricey) out.push('<span class="badge badge-warn">Eher teuer</span>');
  if (!inSeasonNow(a, now)) out.push('<span class="badge badge-off">Gerade keine Saison</span>');
  return out.join('');
}

/**
 * @param a Aktivität
 * @param opts.result optionales Ergebnis aus filter.evaluate() für Begründungen
 */
export function card(a, { result = null, now = new Date() } = {}) {
  let reasons = '';
  if (result && !result.perfect) {
    reasons = `<p class="card-why card-why-miss"><strong>Passt nicht:</strong> ${
      result.hard.map((h) => `${esc(h.label)} – ${esc(h.reason)}`).join(' · ')}</p>`;
  } else if (result?.soft.length) {
    reasons = `<p class="card-why card-why-soft">${result.soft.map((s) => `${esc(s.label)}: ${esc(s.reason)}`).join(' · ')}</p>`;
  }
  return `
    <a class="card" href="#/activity/${esc(a.id)}" data-id="${esc(a.id)}">
      <div class="card-img">
        <img src="${esc(a.image.src)}" alt="${esc(a.image.alt)}" loading="lazy" decoding="async"
             onerror="this.remove()">
        <div class="card-badges">${badges(a, now)}</div>
      </div>
      <div class="card-body">
        <h3 class="card-title">${esc(a.name)}</h3>
        <p class="card-teaser">${esc(a.teaser)}</p>
        <ul class="card-meta">
          <li title="Geschätzte Anfahrt ab Ulm">🚗 ${esc(driveLabel(a))}</li>
          <li title="Geschätzte Kosten pro Person">💶 ${esc(costLabel(a))}</li>
          <li>⏱️ ${esc(DURATION_LABEL[a.duration])}</li>
        </ul>
        <div class="card-foot">${adrenalineDots(a.adrenaline)}</div>
        ${reasons}
      </div>
    </a>`;
}

export const cardGrid = (items, opts) => `<div class="cards">${items.map((x) => card(x.activity || x, { ...opts, result: x.activity ? x : null })).join('')}</div>`;
