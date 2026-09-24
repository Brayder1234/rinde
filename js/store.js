// Datos de Rinde: se guardan solo en este teléfono (localStorage del navegador).
import { SEED } from './catalog.js';

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

function defaults() {
  return {
    v: 2,
    settings: { onboarded: false, name: '', currency: guessCurrency(), budget: 0, cycleDay: 1, hide: false,
      theme: 'dark', alerts: true, safeMode: 0, lastBackup: null, installDismissed: false },
    categories: seedCategories(),
    movements: [],
    rules: [],
    goals: [],
    learned: {},
    alertsSent: {},
  };
}

function load() {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const data = JSON.parse(raw);
    return migrate({ ...base, ...data, settings: { ...base.settings, ...(data.settings || {}) } });
  } catch {
    return base;
  }
}

/** v1 → v2: diseño negro con íconos de línea (antes emojis y colores por categoría). */
function migrate(data) {
  if ((data.v || 1) < 2) {
    const byKey = Object.fromEntries(SEED.map((s) => [s.key, s.icon]));
    for (const c of data.categories || []) {
      if (byKey[c.key]) c.icon = byKey[c.key];
      else if (!/^[a-z]+$/i.test(c.icon || '')) c.icon = 'tag';
    }
    for (const g of data.goals || []) if (!/^[a-z]+$/i.test(g.icon || '')) g.icon = 'star';
    if (data.settings.theme === 'auto') data.settings.theme = 'dark';
    data.v = 2;
  }
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
  Object.assign(state, migrate({ ...base, ...data, settings: { ...base.settings, ...(data.settings || {}) } }));
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
