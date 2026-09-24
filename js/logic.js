// Cálculos: periodos, disponible para gastar, gráficas, recurrentes, alertas, exportar.
import { state, save, uid } from './store.js';
import { SEED, FALLBACK, ACCOUNT_SEED } from './catalog.js';
import * as P from './parser.js';
import * as M from './money.js';

export const S = () => state.settings;
export const md = (m) => new Date(m.date);
export const catById = (id) => state.categories.find((c) => c.id === id);
export const acctById = (id) => (id ? state.accounts.find((a) => a.id === id) : undefined);
export const activeAccounts = () => state.accounts.filter((a) => !a.archived).sort((a, b) => a.order - b.order);
export const activeCats = (kind) => state.categories
  .filter((c) => !c.archived && (!kind || c.kind === kind))
  .sort((a, b) => a.order - b.order);

export const currentPeriod = (now = new Date()) => M.periodContaining(now, S().cycleDay || 1);
export const inPeriod = (ms, p) => ms.filter((m) => M.inPeriod(p, md(m)));
export const total = (ms, kind) => ms.reduce((a, m) => (m.kind === kind ? a + m.main : a), 0);
export const sortedMovements = () => [...state.movements].sort((a, b) => md(b) - md(a));

export function byCategory(ms, kind = 'expense') {
  const map = new Map();
  for (const m of ms) {
    if (m.kind !== kind) continue;
    const e = map.get(m.catId) || { total: 0, count: 0 };
    e.total += m.main; e.count += 1;
    map.set(m.catId, e);
  }
  return [...map.entries()].map(([id, v]) => {
    const c = catById(id);
    return { id, name: c?.name ?? 'Sin categoría', icon: c?.icon ?? '❔', color: c?.color ?? '#94A3B8', ...v };
  }).sort((a, b) => b.total - a.total);
}

export function periodTotals(ms, ending, count) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const p = M.shiftPeriod(ending, -i);
    const pm = inPeriod(ms, p);
    out.push({ p, spent: total(pm, 'expense'), income: total(pm, 'income') });
  }
  return out;
}

export function dailyTotals(ms, p, now = new Date()) {
  const map = new Map();
  for (const m of ms) {
    if (m.kind !== 'expense') continue;
    const d = md(m);
    if (!M.inPeriod(p, d)) continue;
    const k = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    map.set(k, (map.get(k) || 0) + m.main);
  }
  const out = [];
  const last = Math.min(p.end.getTime(), new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime());
  for (let d = new Date(p.start); d.getTime() < last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    out.push({ day: d, total: map.get(d.getTime()) || 0 });
  }
  return out;
}

export function tagTotals(ms) {
  const map = new Map();
  for (const m of ms) {
    if (m.kind !== 'expense') continue;
    for (const t of m.tags || []) {
      const e = map.get(t) || { total: 0, count: 0 };
      e.total += m.main; e.count += 1;
      map.set(t, e);
    }
  }
  return [...map.entries()].map(([tag, v]) => ({ tag, ...v })).sort((a, b) => b.total - a.total);
}

export const isToday = (d, now = new Date()) =>
  d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();

/** Lo de la tarjeta "Disponible para gastar". */
export function safeToSpend(now = new Date()) {
  const p = currentPeriod(now);
  const ms = inPeriod(state.movements, p);
  let budget = S().budget || 0;
  if (budget <= 0) budget = activeCats('expense').reduce((a, c) => a + (c.budget || 0), 0);
  const spent = total(ms, 'expense');
  const income = total(ms, 'income');
  const today = ms.reduce((a, m) => (m.kind === 'expense' && isToday(md(m), now) ? a + m.main : a), 0);
  const days = M.daysLeft(p, now);
  const hasBudget = budget > 0;
  const remaining = hasBudget ? budget - spent : income - spent;
  return {
    p, budget, spent, income, today, days, hasBudget, remaining,
    isOver: remaining < 0,
    perDay: Math.max(remaining, 0) / Math.max(days, 1),
    dayBudget: (Math.max(remaining, 0) + today) / Math.max(days, 1),
    progress: hasBudget ? spent / budget : 0,
  };
}

// ---------------------------------------------------------------- Analizador

export function matchers() {
  return activeCats().map((c) => {
    const seed = SEED.find((s) => s.key === c.key);
    const kws = [P.key(c.name), ...(seed ? seed.keywords : []),
      ...P.words(c.name).filter((w) => w.length >= 4 && !['para', 'otros', 'otras'].includes(w))];
    return { id: c.id, kind: c.kind, keywords: kws };
  });
}

export function accountMatchers() {
  return activeAccounts().map((a) => {
    const seed = ACCOUNT_SEED.find((s) => s.key === a.key);
    return { id: a.id, keywords: [P.key(a.name), ...(seed ? seed.keywords : [])] };
  });
}

export const parseText = (text) => P.parse(text, matchers(), state.learned, new Date(), accountMatchers());

export function learn(note, catId) {
  const k = P.key(note);
  if (k.length < 3 || k.length > 40 || k.split(' ').length > 4 || /\d/.test(k)) return;
  state.learned[k] = catId;
  const keys = Object.keys(state.learned);
  if (keys.length > 600) delete state.learned[keys[0]];
}

export function fallbackCategory(kind) {
  const key = FALLBACK[kind];
  return activeCats(kind).find((c) => c.key === key) || activeCats(kind)[0];
}

// ---------------------------------------------------------------- Movimientos

export function addMovement({ amount, kind, catId, note = '', date = new Date(), tags = [], currency, rate = 1, source = 'manual', ruleId = null, accountId = null }) {
  const main = S().currency;
  const code = currency || main;
  const r = code === main ? 1 : rate;
  const m = { id: uid(), amount: Math.abs(amount), currency: code, rate: r, main: Math.abs(amount) * r, kind,
    catId: catId || fallbackCategory(kind)?.id || null, note, date: date.toISOString(), created: new Date().toISOString(),
    tags, source, ruleId, accountId: acctById(accountId) ? accountId : null };
  state.movements.push(m);
  return m;
}

// ---------------------------------------------------------------- Cuentas

/** Entradas y salidas por cuenta en una lista de movimientos (clave '' = sin cuenta). */
export function accountFlow(ms) {
  const flow = new Map();
  for (const m of ms) {
    const id = acctById(m.accountId) ? m.accountId : '';
    const f = flow.get(id) || { in: 0, out: 0, count: 0 };
    if (m.kind === 'income') f.in += m.main; else f.out += m.main;
    f.count += 1;
    flow.set(id, f);
  }
  return flow;
}

const accountNet = (id) => state.movements.reduce((t, m) => (m.accountId === id ? t + (m.kind === 'income' ? m.main : -m.main) : t), 0);

/** Saldo actual, si el usuario le dijo a Rinde cuánto tenía (si no, null). */
export const accountBalance = (a) => (a?.hasBalance ? a.initial + accountNet(a.id) : null);

/** "Hoy tengo X en esta cuenta": ajusta el punto de partida para que el saldo cuadre. */
export function setAccountBalance(a, value) {
  a.initial = value - accountNet(a.id);
  a.hasBalance = true;
}

export function deleteMovement(id) {
  state.movements = state.movements.filter((m) => m.id !== id);
}

/** Aviso al pasar 80 % o 100 % de un presupuesto (una vez por periodo). */
export function budgetAlert(m) {
  if (!S().alerts || m.kind !== 'expense') return null;
  const p = currentPeriod();
  if (!M.inPeriod(p, md(m))) return null;
  const ms = inPeriod(state.movements, p).filter((x) => x.kind === 'expense');
  const check = (id, name, spent, budget) => {
    const ratio = spent / budget;
    const th = ratio >= 1 ? 100 : ratio >= 0.8 ? 80 : 0;
    if (!th) return null;
    const k = `${id}-${p.start.getTime()}-${th}`;
    if (state.alertsSent[k]) return null;
    state.alertsSent[k] = true;
    return th === 100
      ? `Superaste ${name}: ${M.fmt(spent, S().currency)} de ${M.fmt(budget, S().currency)}.`
      : `Llevas el ${Math.round(ratio * 100)} % de ${name}. Te quedan ${M.fmt(budget - spent, S().currency)}.`;
  };
  let msg = null;
  const c = catById(m.catId);
  if (c && c.budget > 0) {
    const spent = ms.filter((x) => x.catId === c.id).reduce((a, x) => a + x.main, 0);
    msg = check(c.id, c.name, spent, c.budget);
  }
  const s = safeToSpend();
  if (s.hasBudget) msg = msg || check('global', 'tu presupuesto del mes', s.spent, s.budget);
  return msg;
}

export function frequent(kind, limit = 8) {
  const since = Date.now() - 120 * 864e5;
  const groups = new Map();
  for (const m of state.movements) {
    if (m.kind !== kind || md(m).getTime() < since || m.currency !== S().currency) continue;
    const title = m.note || catById(m.catId)?.name || '';
    const k = `${P.key(title)}|${m.catId}|${m.amount}`;
    const g = groups.get(k) || { title, amount: m.amount, catId: m.catId, count: 0, accountId: null, last: 0 };
    g.count += 1;
    if (md(m).getTime() > g.last) { g.last = md(m).getTime(); g.accountId = m.accountId || null; }
    groups.set(k, g);
  }
  return [...groups.values()].filter((g) => g.count >= 2).sort((a, b) => b.count - a.count).slice(0, limit);
}

// ---------------------------------------------------------------- Recurrentes

export const nextDate = (r) => M.occurrence(r.freq, r.count, new Date(r.start));

/** Registra las ocurrencias vencidas de las reglas automáticas. */
export function processRecurring(now = new Date()) {
  let n = 0;
  for (const r of state.rules) {
    if (!r.active || !r.auto) continue;
    let guard = 0;
    while (nextDate(r) <= now && guard++ < 400) {
      addMovement({ amount: r.amount, kind: r.kind, catId: r.catId, note: r.title, date: nextDate(r), source: 'recurring', ruleId: r.id, accountId: r.accountId });
      r.count += 1;
      n++;
    }
  }
  if (n) save();
  return n;
}

export const pendingRules = (now = new Date()) =>
  state.rules.filter((r) => r.active && !r.auto && nextDate(r) <= now).sort((a, b) => nextDate(a) - nextDate(b));

export function confirmRule(r) {
  addMovement({ amount: r.amount, kind: r.kind, catId: r.catId, note: r.title, date: nextDate(r), source: 'recurring', ruleId: r.id, accountId: r.accountId });
  r.count += 1;
}

/** Gastos con la misma descripción, monto parecido y separación regular. */
export function suggestions(now = new Date()) {
  const since = now.getTime() - 210 * 864e5;
  const ruleTitles = new Set(state.rules.map((r) => P.key(r.title)));
  const groups = new Map();
  for (const m of state.movements) {
    if (m.kind !== 'expense' || md(m).getTime() < since || m.source === 'recurring') continue;
    const k = P.key(m.note || '');
    if (k.length < 3 || ruleTitles.has(k)) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }
  const out = [];
  for (const items of groups.values()) {
    if (items.length < 2) continue;
    items.sort((a, b) => md(a) - md(b));
    const amounts = items.map((m) => m.main);
    if (Math.max(...amounts) / Math.min(...amounts) > 1.2) continue;
    const gaps = items.slice(1).map((m, i) => (md(m) - md(items[i])) / 864e5);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (!gaps.every((g) => Math.abs(g - avg) <= Math.max(3, avg * 0.2))) continue;
    const freq = avg >= 6 && avg <= 8 ? 'weekly' : avg >= 13 && avg <= 16 ? 'biweekly'
      : avg >= 27 && avg <= 33 ? 'monthly' : avg >= 85 && avg <= 95 ? 'quarterly' : null;
    const last = items[items.length - 1];
    if (!freq || (now - md(last)) / 864e5 > avg * 2 + 5 || (freq === 'weekly' && items.length < 3)) continue;
    out.push({ title: last.note, amount: last.amount, freq, catId: last.catId, last: md(last), count: items.length, accountId: last.accountId || null });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

// ---------------------------------------------------------------- Tasas de cambio

export async function exchangeRate(from, to) {
  if (from === to) return 1;
  const ck = 'rinde.rates';
  try {
    const cache = JSON.parse(localStorage.getItem(ck) || '{}');
    const e = cache[from];
    if (e && Date.now() - e.ts < 12 * 3600e3 && e.rates[to]) return e.rates[to];
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    const data = await res.json();
    if (data.result !== 'success' || !data.rates[to]) throw new Error('sin tasa');
    cache[from] = { ts: Date.now(), rates: data.rates };
    localStorage.setItem(ck, JSON.stringify(cache));
    return data.rates[to];
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Exportar

export function csv() {
  const main = S().currency;
  const q = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const num = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => {
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? '+' : '-';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
  };
  const rows = [`fecha,tipo,monto,moneda,monto_${main.toLowerCase()},categoria,cuenta,descripcion,etiquetas`];
  for (const m of [...state.movements].sort((a, b) => md(a) - md(b))) {
    rows.push([iso(md(m)), m.kind === 'expense' ? 'gasto' : 'ingreso', num(m.amount), m.currency, num(m.main),
      catById(m.catId)?.name ?? '', acctById(m.accountId)?.name ?? '', m.note, (m.tags || []).map((t) => '#' + t).join(' ')].map((x) => q(String(x))).join(','));
  }
  return '﻿' + rows.join('\r\n');
}

export const backupJSON = () => JSON.stringify({ app: 'Rinde', version: 1, exportedAt: new Date().toISOString(), ...state }, null, 1);
