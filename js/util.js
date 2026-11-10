// Kleine Hilfsfunktionen ohne Abhängigkeiten.
export const esc = (str = '') => String(str).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export const initials = (name = '?') => (String(name).trim()[0] || '?').toUpperCase();
