// Aktivitäts-Feed: "Johannes hat Canyoning mit 5 Sternen bewertet"
// Wird aus dem aktuellen Datenstand abgeleitet (keine eigene Verlaufstabelle).
import { activityById } from './activities.js';
import { allData, millis, myUid, STATUS_LABEL, RESPONSE_LABEL } from './store.js';

const short = (text, n = 70) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

/**
 * @returns [{ ts, uid, activityId, kind, pre, post }] neueste zuerst
 * Satz: "<Name> hat <pre> <Aktivität> <post>", z. B. "Johannes hat Canyoning mit 5 Sternen bewertet".
 */
export function buildFeed(limit = 8) {
  const { ratings, states, comments, suggestions } = allData();
  const me = myUid();
  const items = [];
  for (const r of ratings) {
    if (!activityById(r.activityId)) continue;
    if (r.rating > 0) items.push({ ts: millis(r.updatedAt), uid: r.uid, activityId: r.activityId, kind: 'rating', pre: '', post: `mit ${r.rating} ${r.rating === 1 ? 'Stern' : 'Sternen'} bewertet` });
    else if (r.favorite) items.push({ ts: millis(r.updatedAt), uid: r.uid, activityId: r.activityId, kind: 'fav', pre: '', post: 'gemerkt ♥' });
  }
  for (const s of states) {
    if (s.status === 'open' || !activityById(s.activityId)) continue;
    items.push({ ts: millis(s.updatedAt), uid: s.updatedBy, activityId: s.activityId, kind: 'status', pre: '', post: `als „${STATUS_LABEL[s.status]}“ markiert` });
  }
  for (const c of comments) {
    if (!activityById(c.activityId)) continue;
    items.push({ ts: millis(c.createdAt), uid: c.uid, activityId: c.activityId, kind: 'comment', pre: '', post: `kommentiert: „${short(c.body)}“` });
  }
  for (const s of suggestions) {
    if (!activityById(s.activityId)) continue;
    items.push({ ts: millis(s.createdAt), uid: s.fromUid, activityId: s.activityId, kind: 'suggest', toMe: s.toUid === me, pre: s.toUid === me ? 'dir' : '', post: 'vorgeschlagen' });
    if (s.response !== 'pending') {
      items.push({ ts: millis(s.respondedAt), uid: s.toUid, activityId: s.activityId, kind: 'respond', pre: 'beim Vorschlag', post: `geantwortet: ${RESPONSE_LABEL[s.response]}` });
    }
  }
  return items.filter((i) => i.uid).sort((a, b) => b.ts - a.ts).slice(0, limit);
}

export function timeAgo(ts, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'gerade eben';
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  if (d < 7) return `vor ${d} ${d === 1 ? 'Tag' : 'Tagen'}`;
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(ts));
}
