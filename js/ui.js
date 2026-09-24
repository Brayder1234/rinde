// Utilidades de interfaz: íconos de línea, formato, fechas, avisos y archivos.
import { state } from './store.js';
import * as M from './money.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const cur = () => state.settings.currency;
export const HIDDEN = '••••••';

export function money(v, { code, signed = false, force = false } = {}) {
  if (state.settings.hide && !force) return HIDDEN;
  const c = code || cur();
  return M.fmt(v, c, { isMain: c === cur(), signed });
}
export const compactMoney = (v) => (state.settings.hide ? '•••' : M.compact(v, cur()));

// ---------------------------------------------------------------- Íconos (trazo fino, 24×24)

const UI = {
  home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/>',
  list: '<path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12"/><path d="M4 6.5h.01M4 12h.01M4 17.5h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".6"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeOff: '<path d="M3 3l18 18M10.5 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.5 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.7-1.3"/><path d="M10 10a2.8 2.8 0 0 0 4 4"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  camera: '<path d="M4 8h3l1.8-2.5h6.4L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.3"/>',
  left: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  right: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  spark: '<path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4"/><path d="M12 9.5 13 11l1.5 1-1.5 1-1 1.5-1-1.5-1.5-1 1.5-1z"/>',
  share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M6.5 11H5v9.5h14V11h-1.5"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 19.5h14"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  pencil: '<path d="M4 20l1.2-4.6L15.6 5 19 8.4 8.6 18.8z"/>',
  layers: '<path d="M3.5 8 12 4l8.5 4-8.5 4z"/><path d="M3.5 12 12 16l8.5-4M3.5 16 12 20l8.5-4"/>',
  wand: '<path d="M4 20 15 9M14 4v3M18.5 5.5l-2 2M20 10h-3"/>',
  dotsH: '<path d="M6 12h.01M12 12h.01M18 12h.01"/>',
  install: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M12 8v6M9.5 11.5 12 14l2.5-2.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
};

/** Íconos para categorías y metas. */
export const CAT_ICONS = {
  utensils: '<path d="M6 3v6.5M9 3v6.5M6 9.5a1.5 1.5 0 0 0 3 0M7.5 11v10"/><path d="M17 21V3c-2.2.7-3.5 3-3.5 6.5 0 2 1.2 3.5 3.5 3.5"/>',
  cart: '<path d="M3 4h2l2.2 11h10.3L20 7H6.2"/><circle cx="9" cy="19.5" r="1.2"/><circle cx="17" cy="19.5" r="1.2"/>',
  car: '<path d="M4 16v-4l2-5.5h12L20 12v4z"/><path d="M4 16v2.5M20 16v2.5M4 12h16M7.5 14.2h.01M16.5 14.2h.01"/>',
  fuel: '<path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14M5 10h10"/><path d="M15 8l3 3v6.5a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
  home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5M10 20v-5h4v5"/>',
  bolt: '<path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12z"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/>',
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  cap: '<path d="M2.5 9 12 5l9.5 4L12 13z"/><path d="M6.5 11v4.5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3V11M21.5 9v5"/>',
  gamepad: '<rect x="3" y="7" width="18" height="11" rx="5"/><path d="M8 10.5v4M6 12.5h4M15.5 11.5h.01M17.5 13.5h.01"/>',
  screen: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20.5h7M12 16.5v4M10.5 8.5l4 2-4 2z"/>',
  shirt: '<path d="M8 3.5 3.5 6.5l2 4L8 9.5V21h8V9.5l2.5 1 2-4L16 3.5a4 4 0 0 1-8 0z"/>',
  bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  sparkle: '<path d="M12 3c.7 4.6 2.4 6.3 7 7-4.6.7-6.3 2.4-7 7-.7-4.6-2.4-6.3-7-7 4.6-.7 6.3-2.4 7-7z"/><path d="M18.5 16c.3 1.8.9 2.4 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.1 2.2-.7 2.5-2.5z"/>',
  paw: '<circle cx="6.5" cy="10" r="1.6"/><circle cx="10" cy="6" r="1.6"/><circle cx="14" cy="6" r="1.6"/><circle cx="17.5" cy="10" r="1.6"/><path d="M12 12c-2.8 0-5 3.6-5 6 0 1.4 1.1 2.4 2.5 2.4 1.1 0 1.6-.6 2.5-.6s1.4.6 2.5.6c1.4 0 2.5-1 2.5-2.4 0-2.4-2.2-6-5-6z"/>',
  plane: '<path d="M10.5 4.5a1.5 1.5 0 0 1 3 0V10l7.5 4.5v2L13.5 14v4l2.5 2v1.5L12 20.5l-4 1V20l2.5-2v-4L3 16.5v-2L10.5 10z"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12M12 8v12.5M12 8S10.5 3.5 8 4.5 9 8 12 8zM12 8s1.5-4.5 4-3.5S15 8 12 8z"/>',
  card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
  dots: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
  wallet: '<path d="M4 7v11a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2 2 2 0 0 1 2-2h11v4"/><path d="M16.5 14.5h.01"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M3 12.5h18"/>',
  coinIn: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M8.8 13.3 12 16.5l3.2-3.2"/>',
  coffee: '<path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>',
  glass: '<path d="M7 4h9v16H7zM16 8h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 9h9"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  laptop: '<rect x="4.5" y="5" width="15" height="10" rx="1.5"/><path d="M2.5 19h19"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  umbrella: '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v6.5a2 2 0 0 0 4 0"/>',
  wrench: '<path d="M14.5 5.5a4 4 0 0 0 4 5.5L11 18.5a2.1 2.1 0 0 1-3-3L15.5 8a4 4 0 0 1-1-2.5z"/>',
  drop: '<path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z"/>',
  flame: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-1.5-2-1.5-3C7 10 6 12.5 6 15a6 6 0 0 0 6 6z"/>',
  leaf: '<path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z"/><path d="M5 19 14 10"/>',
  bank: '<path d="M3 9.5 12 4l9 5.5M4.5 10v8M9.5 10v8M14.5 10v8M19.5 10v8M3 20.5h18"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  bus: '<rect x="5" y="3.5" width="14" height="15" rx="3"/><path d="M5 11h14M8 21v-2.5M16 21v-2.5M8.5 14.5h.01M15.5 14.5h.01"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l3.5-7h5.5l3 7M12.5 16 9.5 9M8 6.5h3"/>',
  bed: '<path d="M3 18V7M3 13h18v5M21 18v-3a3 3 0 0 0-3-3h-7v1"/><circle cx="7" cy="10.5" r="1.5"/>',
  scissors: '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 8.5 20 18M8 15.5 20 6"/>',
  pill: '<path d="M10.5 20.5a4.95 4.95 0 0 1-7-7l6-6a4.95 4.95 0 0 1 7 7z"/><path d="M8.5 9.5l6 6"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4 4 0 0 0 7 0M9 10h.01M15 10h.01"/>',
  tag: '<path d="M3.5 12.5v-8a1 1 0 0 1 1-1h8L21 12l-8.5 8.5z"/><path d="M8 8h.01"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 3 2.5 14 0 17M12 3.5c-2.5 3-2.5 14 0 17"/>',
  shield: '<path d="M12 3 5 6v5.5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5V6z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2"/>',
  palm: '<path d="M12 21v-9M12 12c-1-3-4-4-7-3 2-3 6-3 7 0 1-3 5-3 7 0-3-1-6 0-7 3z"/><path d="M8 21h8"/>',
};

const svg = (inner, cls) =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
export const icon = (name, cls = '') => svg(UI[name] || CAT_ICONS[name] || '', cls);

/** Ícono de categoría o meta; si viene de una versión anterior (emoji), lo muestra tal cual. */
export function glyph(name, cls = '') {
  if (CAT_ICONS[name]) return svg(CAT_ICONS[name], cls);
  return `<span class="emoji ${cls}">${esc(name || '•')}</span>`;
}
export const catIcon = (c, size = 40) => `<span class="cat-ic" style="width:${size}px;height:${size}px">${glyph(c?.icon ?? 'tag')}</span>`;

// ---------------------------------------------------------------- Fechas

const pad = (n) => String(n).padStart(2, '0');
export const toInputDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function fromInputDate(s, now = new Date()) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export function dayLabel(d, now = new Date()) {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((a - b) / 864e5);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return cap(d.toLocaleDateString(M.LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }));
}
export const shortDate = (d) => d.toLocaleDateString(M.LOCALE, { day: 'numeric', month: 'short' }).replace('.', '');
export const longDate = (d) => d.toLocaleDateString(M.LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');

// ---------------------------------------------------------------- Aviso breve

let toastTimer;
export function toast(text, tone = 'ok') {
  const el = $('#toast');
  el.innerHTML = `<span class="tdot ${tone}"></span><span>${esc(text)}</span>`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), tone === 'warn' ? 4500 : 2200);
}

// ---------------------------------------------------------------- Compartir / descargar

export async function shareFile(name, content, type) {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
