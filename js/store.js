// Datos de Rinde: se guardan solo en este teléfono (localStorage del navegador).
import { SEED, ACCOUNT_SEED } from './catalog.js';

const KEY = 'rinde.v1';

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));

const REGION_CURRENCY = { CO: 'COP', MX: 'MXN', AR: 'ARS', CL: 'CLP', PE: 'PEN', US: 'USD', ES: 'EUR', BR: 'BRL',
  UY: 'UYU', PY: 'PYG', BO: 'BOB', VE: 'VES', CR: 'CRC', GT: 'GTQ', HN: 'HNL', NI: 'NIO', PA: 'USD', DO: 'DOP',
  EC: 'USD', SV: 'USD' };

function guessCurrency() {
  const region = (navigator.language || 'es-CO').split('-')[1]?.toUpperCase();
  return REGION_CURRENCY[region] || 'COP';
}

export function seedCategories() {
  return SEED.map((s, i) => ({ id: s.key, name: s.name, icon: s.icon, color: s.color, kind: s.kind, key: s.key,
    order: i, budget: 0, archived: false }));
}

export function seedAccounts() {
  return ACCOUNT_SEED.map((a, i) => ({ id: a.key, key: a.key, name: a.name, icon: a.icon, color: a.color,
    order: i, initial: 0, hasBalance: false, archived: false }));
}

function defaults() {
  return {
    v: 1,
    settings: { onboarded: false, name: '', currency: guessCurrency(), budget: 0, cycleDay: 1, hide: false,
      theme: 'auto', alerts: true, safeMode: 0, lastBackup: null, installDismissed: false, lastAccount: {}, applePay: false, cardAccounts: {} },
    categories: seedCategories(),
    accounts: seedAccounts(),
    movements: [],
    rules: [],
    goals: [],
    learned: {},
    alertsSent: {},
    pasted: {},
  };
}

function load() {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const data = JSON.parse(raw);
    return restoreV1({ ...base, ...data, settings: { ...base.settings, ...(data.settings || {}) } });
  } catch {
    return base;
  }
}

/** Datos guardados por el diseño negro (v2, retirado): vuelve a emojis y colores. */
function restoreV1(data) {
  if ((data.v || 1) < 2) return data;
  const seed = Object.fromEntries(SEED.map((s) => [s.key, s]));
  const isWord = (x) => /^[a-z]+$/i.test(x || '');
  for (const c of data.categories || []) {
    if (seed[c.key]) { c.icon = seed[c.key].icon; c.color = seed[c.key].color; continue; }
    if (isWord(c.icon)) c.icon = '📦';
    if (!c.color || c.color === '#FFFFFF') c.color = '#64748B';
  }
  for (const g of data.goals || []) {
    if (isWord(g.icon)) g.icon = '⭐';
    if (!g.color || /^#fff(fff)?$/i.test(g.color)) g.color = '#0E9F6E';
  }
  if (data.settings.theme === 'dark') data.settings.theme = 'auto';
  data.v = 1;
  return data;
}

/** El objeto de estado nunca se reemplaza (las vistas guardan referencias a él). */
export const state = load();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function replaceAll(data) {
  const base = defaults();
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, restoreV1({ ...base, ...data, settings: { ...base.settings, ...(data.settings || {}) } }));
  save();
}

export function resetAll() {
  const keepTheme = state.settings.theme;
  replaceAll({ settings: { onboarded: true, theme: keepTheme, currency: state.settings.currency } });
}

/** Pide al navegador no borrar los datos si le falta espacio. */
export function askPersistence() {
  try { navigator.storage?.persist?.(); } catch { /* sin soporte */ }
}
