// Blind-Trip-Planer – Oberfläche (#/trip)
import {
  AIRPORTS, INTERESTS, defaultTrip, normalizeTrip, rankDestinations, flightLinks, drawBlind,
  destinationByCode, findDestination, returnDate,
} from './trip.js';
import { local } from './storage.js';
import { suggest } from './store.js';
import { toast } from './social.js';
import { esc } from './util.js';

const euro = (n) => '€'.repeat(n);
const fmt = (iso) => (iso ? new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${iso}T12:00:00`)) : '');
const todayIso = () => new Date().toISOString().slice(0, 10);
const linkList = (links) => links.map((l) => `<a class="btn btn-ghost btn-sm" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('');

export function tripView(el, session) {
  const key = `${session.me.uid}:trip`;
  const saved = local.get(key, {});
  let trip = { ...defaultTrip(), ...(saved.trip || {}) };
  let drawn = saved.drawn || null; // IATA-Code des gezogenen Ziels
  let revealed = !!saved.revealed;
  const friendName = session.friend ? esc(session.friend.displayName) : 'deinem Freund';
  const persist = () => local.set(key, { trip, drawn, revealed });

  el.innerHTML = `
    <section class="container">
      <header class="page-head">
        <p class="eyebrow">Blind-Trip-Planer</p>
        <h1 class="display page-title">Ab ins Unbekannte</h1>
        <p class="page-lead">Sammelt eure Eckdaten, lasst euch Ziele vorschlagen – oder zieht ein Überraschungsziel, das erst am Gate verraten wird.</p>
      </header>

      <form class="trip-form panel" id="trip-form" novalidate>
        <fieldset class="tf-group">
          <legend>Abflughafen</legend>
          <div class="seg-row">
            ${Object.values(AIRPORTS).map((a) => `<label class="pill"><input type="radio" name="airport" value="${a.code}" ${trip.airport === a.code ? 'checked' : ''}><span>${a.name} (${a.code})</span></label>`).join('')}
          </div>
        </fieldset>
        <div class="tf-grid">
          <label class="field"><span>Abflug (frühestens)</span><input type="date" name="from" min="${todayIso()}" value="${esc(trip.from)}"></label>
          <label class="field"><span>Rückreise (spätestens)</span><input type="date" name="to" min="${todayIso()}" value="${esc(trip.to)}"></label>
          <label class="field"><span>Übernachtungen</span><input type="number" name="nights" min="1" max="14" inputmode="numeric" value="${trip.nights}"></label>
          <label class="field"><span>Budget pro Person: <output id="budget-out">${trip.budget} €</output></span>
            <input type="range" name="budget" min="100" max="1500" step="50" value="${trip.budget}"></label>
        </div>
        <fieldset class="tf-group">
          <legend>Reiseziel</legend>
          <div class="seg-row">
            <label class="pill"><input type="radio" name="mode" value="flex" ${trip.flexible ? 'checked' : ''}><span>Flexibel / Überraschung</span></label>
            <label class="pill"><input type="radio" name="mode" value="city" ${trip.flexible ? '' : 'checked'}><span>Konkrete Stadt</span></label>
          </div>
          <label class="field city-field" ${trip.flexible ? 'hidden' : ''}><span>Stadt</span>
            <input type="text" name="city" list="trip-cities" placeholder="z. B. Lissabon" value="${esc(trip.city)}" autocomplete="off"></label>
          <datalist id="trip-cities"></datalist>
        </fieldset>
        <fieldset class="tf-group">
          <legend>Worauf habt ihr Lust?</legend>
          <div class="seg-row">
            ${Object.entries(INTERESTS).map(([v, l]) => `<label class="pill"><input type="checkbox" name="interests" value="${v}" ${trip.interests.includes(v) ? 'checked' : ''}><span>${l}</span></label>`).join('')}
          </div>
        </fieldset>
        <p class="form-error" id="trip-error" role="alert" hidden></p>
      </form>

      <div id="trip-out"></div>
      <p class="muted small">Flugzeiten sind grobe Schätzungen, Preisniveau (€–€€€) bezieht sich auf Essen & Unterkunft vor Ort. Aktuelle Flüge und Preise findest du nur über die Links – hier wird nichts erfunden.</p>
    </section>`;

  const form = el.querySelector('#trip-form');
  const out = el.querySelector('#trip-out');
  const errEl = el.querySelector('#trip-error');
  el.querySelector('#trip-cities').innerHTML = rankDestinations(trip).map((r) => `<option value="${esc(r.dest.city)}">`).join('');

  function readForm() {
    const fd = new FormData(form);
    return {
      airport: fd.get('airport'),
      from: fd.get('from') || '',
      to: fd.get('to') || '',
      nights: fd.get('nights'),
      budget: fd.get('budget'),
      flexible: fd.get('mode') !== 'city',
      city: fd.get('city') || '',
      interests: fd.getAll('interests'),
    };
  }

  function summary() {
    const back = returnDate(trip);
    return `ab ${AIRPORTS[trip.airport].name}${trip.from ? `, ${fmt(trip.from)}${back ? `–${fmt(back)}` : ''}` : ''}, ${trip.nights} ${trip.nights === 1 ? 'Nacht' : 'Nächte'}, bis ca. ${trip.budget} € p. P.${trip.interests.length ? `, Lust auf ${trip.interests.map((i) => INTERESTS[i]).join('/')}` : ''}`;
  }

  function destCard(r) {
    const d = r.dest;
    return `
      <li class="dest" data-code="${d.code}">
        <div class="dest-head">
          <strong>${esc(d.city)}</strong><span class="muted">${esc(d.country)} · ${d.code}</span>
        </div>
        <p class="dest-why">${esc(d.why)}</p>
        <p class="dest-meta">✈️ ca. ${String(d.flightH).replace('.', ',')} h Flug (Schätzung) · Preisniveau ${euro(d.costLevel)}${r.reasons.length ? ` · ${esc(r.reasons.join(', '))}` : ''}</p>
        <div class="dest-links">${linkList(flightLinks(trip, d))}</div>
      </li>`;
  }

  function render() {
    const ranked = rankDestinations(trip);
    const city = !trip.flexible ? trip.city.trim() : '';
    const known = city ? findDestination(city) : null;
    let main;
    if (!trip.flexible) {
      main = known
        ? `<h2 class="section-sub">Euer Ziel</h2><ul class="dests">${destCard(ranked.find((r) => r.dest.code === known.code))}</ul>`
        : `<h2 class="section-sub">Euer Ziel: ${esc(city)}</h2>
           <div class="panel"><p>Zu ${esc(city)} habe ich keine Infos hinterlegt – die Flugsuche funktioniert trotzdem:</p>
           <div class="dest-links">${linkList(flightLinks(trip, null, city))}</div></div>`;
    } else {
      const d = drawn ? destinationByCode(drawn) : null;
      main = `
        <div class="blind panel" id="blind">
          <h2 class="h2">🎁 Überraschungsziel</h2>
          ${d ? (revealed ? `
            <p class="blind-reveal">Es geht nach <strong>${esc(d.city)}</strong> (${esc(d.country)})!</p>
            <div class="dest-links">${linkList(flightLinks(trip, d))}</div>
            <div class="panel-actions"><button type="button" class="btn btn-ghost btn-sm" id="blind-hide">Wieder verdecken</button>
              <button type="button" class="btn btn-ghost btn-sm" id="blind-draw">Neu ziehen</button></div>` : `
            <p class="blind-card" aria-live="polite">Ziel gezogen – noch verdeckt. 🤫</p>
            <p class="muted">Tipp: Einer deckt auf und bucht, der andere erfährt es erst am Gate.</p>
            <div class="panel-actions"><button type="button" class="btn btn-primary btn-sm" id="blind-reveal">Aufdecken</button>
              <button type="button" class="btn btn-ghost btn-sm" id="blind-draw">Neu ziehen</button></div>`) : `
            <p class="muted">Zieht zufällig eines der 5 bestpassenden Ziele.</p>
            <button type="button" class="btn btn-primary" id="blind-draw">Überraschungsziel ziehen</button>`}
        </div>
        <h2 class="section-sub">Passende Ziele <span class="count">${Math.min(6, ranked.length)}</span></h2>
        <ul class="dests" id="dests">${ranked.slice(0, 6).map(destCard).join('')}</ul>
        <div class="panel"><p class="muted" style="margin-top:0">Oder komplett offen suchen:</p>
          <div class="dest-links">${linkList(flightLinks(trip))}</div></div>`;
    }
    out.innerHTML = `
      <p class="trip-summary" id="trip-summary">${esc(summary())}</p>
      ${main}
      ${session.friend ? `<button type="button" class="btn btn-ghost btn-block" id="trip-suggest">💬 Trip-Idee an ${friendName} senden</button>` : ''}`;

    out.querySelectorAll('#blind-draw').forEach((b) => b.addEventListener('click', () => {
      drawn = drawBlind(ranked)?.code || null;
      revealed = false;
      persist();
      render();
      toast('Ziel gezogen – psst! 🤫');
    }));
    out.querySelector('#blind-reveal')?.addEventListener('click', () => { revealed = true; persist(); render(); });
    out.querySelector('#blind-hide')?.addEventListener('click', () => { revealed = false; persist(); render(); });
    out.querySelector('#trip-suggest')?.addEventListener('click', async () => {
      // Im Blind-Modus bleibt das Ziel geheim
      const target = !trip.flexible ? `Ziel: ${trip.city.trim()}` : drawn ? 'Ziel: Überraschung 🤫' : 'Ziel: noch offen';
      try {
        await suggest('blind-trip', { message: `Trip-Idee – ${target}, ${summary()}`.slice(0, 500), proposedDate: trip.from || null });
        toast(`Trip-Idee an ${session.friend.displayName} gesendet ✈️`);
      } catch (err) {
        console.warn(err);
        toast('Senden fehlgeschlagen. Bist du online?');
      }
    });
  }

  function update() {
    const { trip: next, errors } = normalizeTrip(readForm());
    trip = next; // ein gezogenes Überraschungsziel bleibt, bis neu gezogen wird
    errEl.hidden = !errors.length;
    errEl.textContent = errors.join(' ');
    el.querySelector('.city-field').hidden = trip.flexible;
    el.querySelector('#budget-out').textContent = `${trip.budget} €`;
    persist();
    render();
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', (e) => e.preventDefault());
  render();
}
