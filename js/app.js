// Rinde Web · control de gastos que se instala desde Safari.
import { state, save, uid, replaceAll, resetAll, askPersistence } from './store.js';
import * as L from './logic.js';
import * as M from './money.js';
import * as C from './charts.js';
import * as P from './parser.js';
import { SEED } from './catalog.js';
import { $, $$, esc, cur, money, compactMoney, icon, catIcon, toInputDate, fromInputDate, dayLabel, shortDate, longDate, toast, shareFile } from './ui.js';

const S = () => state.settings;
const ui = {
  tab: 'home', sheets: [], mvOffset: 0, anOffset: 0,
  filter: { kind: null, cat: null, tag: null, q: '' },
  anKind: 'expense', evoCat: null, plans: 'budgets', onb: { step: 0, q: '' },
};
const A = {};   // acciones de botones (data-act)
const IN = {};  // acciones al escribir (data-in)
const CH = {};  // acciones al cambiar (data-ch)

const EMOJIS = ['🍽️', '☕', '🍔', '🍕', '🍺', '🛒', '🥦', '🚗', '🚕', '🚌', '🏍️', '⛽', '🅿️', '✈️', '🏨', '🏠', '🛋️', '🔧',
  '💡', '💧', '🔥', '📶', '📱', '💻', '📺', '🎮', '🎬', '🎵', '🎟️', '⚽', '🏋️', '🩺', '💊', '🦷', '👓', '🎓', '📚', '✏️',
  '👕', '👟', '👜', '💄', '💅', '💈', '🐾', '🐶', '🐱', '👶', '🎁', '🎂', '🎉', '💐', '⛪', '💳', '🏦', '🧾', '📦', '🛍️',
  '💰', '💼', '💵', '📈', '🪙', '🏖️', '⭐', '❤️', '🛡️', '🧹', '🧺', '🚿', '🌱', '🐔', '🥐', '🍎', '🍷', '🚲', '🛵', '🧸'];
const COLORS = ['#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#10B981', '#0E9F6E', '#14B8A6', '#06B6D4',
  '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#F43F5E', '#B45309', '#A16207', '#78716C', '#64748B'];

// ================================================================ Arranque

function boot() {
  L.processRecurring();
  render();
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = A[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
  });
  document.addEventListener('input', (e) => { const fn = IN[e.target.dataset.in]; if (fn) fn(e.target, e); });
  document.addEventListener('change', (e) => { const fn = CH[e.target.dataset.ch]; if (fn) fn(e.target, e); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && L.processRecurring() && !ui.sheets.length) render();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  askPersistence();
}

function applyTheme() {
  const t = S().theme;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#F2F2F7');
}

function commit(msg, warn) {
  save();
  if (msg) toast(msg, warn);
}

function render() {
  applyTheme();
  const main = $('#main');
  if (!S().onboarded) {
    main.innerHTML = viewOnboarding();
    $('#tabbar').hidden = true;
    return;
  }
  $('#tabbar').hidden = false;
  main.innerHTML = VIEWS[ui.tab]();
  $('#tabbar').innerHTML = tabbar();
}

A.tab = (d) => {
  if (d.tab === 'add') return openAdd();
  if (ui.tab === d.tab) { scrollTo({ top: 0, behavior: 'smooth' }); return; }
  ui.tab = d.tab;
  render();
  scrollTo(0, 0);
};

function tabbar() {
  const t = (id, label, ic) => `<button class="tab ${ui.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">${icon(ic)}<span>${label}</span></button>`;
  return `${t('home', 'Inicio', 'home')}${t('movements', 'Movimientos', 'list')}
    <button class="tab add" data-act="tab" data-tab="add" aria-label="Registrar"><span class="add-dot">${icon('plus')}</span><span>Registrar</span></button>
    ${t('analysis', 'Análisis', 'pie')}${t('plans', 'Planes', 'target')}`;
}

// ================================================================ Bienvenida

function viewOnboarding() {
  const st = ui.onb;
  const bars = [0, 1, 2].map((i) => `<i class="${i <= st.step ? 'on' : ''}"></i>`).join('');
  let body = '';
  if (st.step === 0) {
    body = `<div class="onb-hero">${logo(96)}<h1>Que tu plata rinda</h1>
      <p class="muted">Controla tus gastos escribiendo como en un chat. Sin bancos, sin cuentas y 100&nbsp;% privado.</p></div>
      <ul class="features">
        ${feat('💬', 'Escribe “almuerzo 18 mil”', 'Rinde entiende el monto, la categoría y la fecha.')}
        ${feat('📊', 'Presupuestos y metas', 'Sabe cuánto puedes gastar hoy y ahorra para lo que quieres.')}
        ${feat('🔒', 'Tus datos no salen del teléfono', 'Sin servidores y sin publicidad. Funciona sin internet.')}
      </ul>
      <button class="primary" data-act="onbNext">Empezar</button>`;
  } else if (st.step === 1) {
    const q = P.key(st.q);
    const list = M.CURRENCIES.filter((c) => !q || P.key(`${c} ${M.currencyName(c)}`).includes(q));
    body = `<h2>¿En qué moneda manejas tu plata?</h2>
      <label class="search">${icon('search')}<input placeholder="Buscar" value="${esc(st.q)}" data-in="onbSearch"></label>
      <div class="group scroll-list" id="onbList">${currencyRows(list)}</div>
      <button class="primary" data-act="onbNext">Continuar con ${esc(S().currency)}</button>`;
  } else {
    body = `<h2>Últimos detalles</h2>
      <label class="field-label">¿Cómo te llamas?</label>
      <input class="field" placeholder="Tu nombre (opcional)" value="${esc(S().name)}" data-in="onbName" autocomplete="given-name">
      <label class="field-label">¿Cuánto quieres gastar al mes?</label>
      <p class="muted small">Con esto calculamos cuánto puedes gastar cada día. Puedes cambiarlo cuando quieras.</p>
      <div class="field amount-field"><span>${esc(M.symbol(S().currency))}</span>
        <input inputmode="decimal" placeholder="0" value="${S().budget ? M.groupDigits(M.rawFromValue(S().budget, cur())) : ''}" data-in="onbBudget"></div>
      <div class="spacer"></div>
      <button class="primary" data-act="onbFinish">Empezar a usar Rinde</button>`;
  }
  return `<div class="onb"><div class="steps">${bars}</div>${body}</div>`;
}
const feat = (e, t, s) => `<li><span class="feat-ic">${e}</span><div><b>${t}</b><small>${s}</small></div></li>`;
const currencyRows = (list) => list.map((c) => `<button class="row" data-act="onbCurrency" data-code="${c}">
  <span class="flag">${M.currencyFlag(c)}</span><span class="grow"><b>${esc(M.currencyName(c))}</b><small>${c}</small></span>
  ${c === S().currency ? `<span class="check">${icon('check')}</span>` : ''}</button>`).join('');

A.onbNext = () => { ui.onb.step++; render(); scrollTo(0, 0); };
A.onbCurrency = (d) => { S().currency = d.code; $('#onbList').innerHTML = currencyRows(M.CURRENCIES.filter((c) => !P.key(ui.onb.q) || P.key(`${c} ${M.currencyName(c)}`).includes(P.key(ui.onb.q)))); $('.onb .primary').textContent = `Continuar con ${d.code}`; };
IN.onbSearch = (el) => { ui.onb.q = el.value; const q = P.key(el.value); $('#onbList').innerHTML = currencyRows(M.CURRENCIES.filter((c) => !q || P.key(`${c} ${M.currencyName(c)}`).includes(q))); };
IN.onbName = (el) => { S().name = el.value.trim(); };
IN.onbBudget = (el) => { const raw = M.sanitizeAmount(el.value, cur()); el.value = M.groupDigits(raw); S().budget = M.amountValue(raw); };
A.onbFinish = () => { S().onboarded = true; commit(); render(); };

function logo(size = 64) {
  const id = `lg${size}`;
  return `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#10B981"/><stop offset="1" stop-color="#047857"/></linearGradient></defs>
    <rect width="100" height="100" rx="26" fill="url(#${id})"/>
    <rect x="23.5" y="53" width="13" height="24" rx="5" fill="#fff"/><rect x="43.5" y="41" width="13" height="36" rx="5" fill="#fff"/>
    <rect x="63.5" y="29" width="13" height="48" rx="5" fill="#fff"/><circle cx="70" cy="18" r="7.5" fill="#fff"/></svg>`;
}

// ================================================================ Inicio

function viewHome() {
  const s = L.safeToSpend();
  const ms = L.inPeriod(state.movements, s.p);
  const pending = L.pendingRules();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const name = S().name.split(' ')[0];
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const recent = L.sortedMovements().slice(0, 6);
  return `<header class="top">
      <div class="top-actions"><button class="icon-btn" data-act="toggleHide" aria-label="Ocultar montos">${icon(S().hide ? 'eyeOff' : 'eye')}</button>
      <button class="icon-btn" data-act="openSettings" aria-label="Ajustes">${icon('gear')}</button></div>
      <h1>${esc(name ? `${greet}, ${name}` : greet)}</h1></header>
    ${!standalone && !S().installDismissed ? installCard() : ''}
    ${safeCard(s)}
    <button class="quick" data-act="openAdd">${icon('sparkles', 'brand')}<span>Escribe: “almuerzo 18 mil”</span><span class="quick-mic">${icon('plus')}</span></button>
    <div class="tiles">
      ${tile('Gastos', s.spent, 'up', 'red')}${tile('Ingresos', s.income, 'dn', 'green')}${tile('Hoy', s.today, 'sun', 'orange')}
    </div>
    ${pending.length ? `<button class="card row-card" data-act="openPending">${icon('clock', 'orange big')}<span class="grow"><b>${pending.length === 1 ? 'Tienes 1 pago por revisar' : `Tienes ${pending.length} pagos por revisar`}</b><small>${esc(pending.slice(0, 3).map((r) => r.title).join(', '))}</small></span>${icon('right', 'muted')}</button>` : ''}
    ${!state.movements.length ? welcomeCard() : `
      ${s.spent > 0 ? donutCard(ms) : ''}
      ${budgetWatch(ms)}
      ${goalsPreview()}
      <section class="card"><div class="sec-title"><h3>Últimos movimientos</h3><button class="link" data-act="tab" data-tab="movements">Ver todos</button></div>
        <div class="list">${recent.map((m) => movementRow(m, true)).join('')}</div></section>
      ${backupReminder()}`}`;
}

function installCard() {
  return `<section class="card install"><button class="close" data-act="dismissInstall" aria-label="Cerrar">${icon('x')}</button>
    <b>Instala Rinde en tu iPhone</b>
    <p class="muted small">En Safari toca <b>Compartir</b> ${icon('share', 'inline')} y luego <b>Agregar a pantalla de inicio</b>. Quedará como una app, a pantalla completa y sin internet.</p></section>`;
}

function backupReminder() {
  const last = S().lastBackup ? new Date(S().lastBackup) : null;
  if (state.movements.length < 15 || (last && Date.now() - last < 30 * 864e5)) return '';
  return `<button class="card row-card" data-act="openData">${icon('download', 'brand big')}<span class="grow"><b>Haz una copia de seguridad</b><small>Tus datos viven solo en este teléfono. Guárdalos en Archivos o iCloud.</small></span>${icon('right', 'muted')}</button>`;
}

function safeCard(s) {
  const mode = S().safeMode || 0;
  const hasModes = (s.hasBudget || s.income > 0) && !s.isOver;
  let value = s.remaining; let title;
  if (s.isOver) title = 'Te pasaste del presupuesto';
  else if (!s.hasBudget) title = s.income > 0 ? 'Disponible (ingresos − gastos)' : 'Balance del mes';
  else title = ['Puedes gastar hoy', 'Puedes gastar esta semana', 'Disponible este mes'][mode];
  if (hasModes) value = mode === 0 ? s.dayBudget - s.today : mode === 1 ? Math.min(s.perDay * 7, Math.max(s.remaining, 0)) : s.remaining;
  const days = s.days === 1 ? 'Último día del periodo' : `${s.days} días restantes`;
  let sub;
  if (s.isOver) sub = `Vas ${money(-s.remaining)} por encima. ${days}.`;
  else if (!s.hasBudget && s.income <= 0) sub = 'Registra tus ingresos o define un presupuesto para saber cuánto puedes gastar.';
  else if (s.hasBudget && mode === 0) sub = `Tu cupo diario es ${money(s.dayBudget)} · ${days}`;
  else sub = `≈ ${money(s.perDay)} por día · ${days}`;
  return `<section class="safe ${s.isOver ? 'over' : ''}">
    <div class="safe-top"><span>${title}</span><span class="pill">${esc(M.periodTitle(s.p))}</span></div>
    <div class="safe-amount">${money(value)}</div>
    ${hasModes ? `<div class="modes">${['Hoy', 'Semana', 'Mes'].map((l, i) => `<button class="${i === mode ? 'on' : ''}" data-act="safeMode" data-mode="${i}">${l}</button>`).join('')}</div>` : ''}
    <p class="safe-sub">${sub}</p>
    ${s.hasBudget ? `<div class="bar light"><i style="width:${Math.min(s.progress, 1) * 100}%"></i></div>
      <div class="safe-foot"><span>Gastado ${money(s.spent)}</span><span>de ${money(s.budget)}</span></div>`
      : `<button class="safe-cta" data-act="openBudget">＋ Define tu presupuesto mensual</button>`}
  </section>`;
}
const tile = (label, v, ic, color) => {
  const t = money(v);
  return `<div class="tile"><span class="tile-l ${color}">${icon(ic)}${label}</span><b class="${t.length > 10 ? 'long' : ''}">${t}</b></div>`;
};

function welcomeCard() {
  const ex = ['almuerzo 18 mil', 'uber 12.500 ayer', 'me pagaron 2 millones', 'mercado 120 mil #casa'];
  return `<section class="card"><h3>Registra tu primer movimiento</h3>
    <p class="muted">Escríbelo como se lo dirías a un amigo. Rinde entiende el monto, la categoría y la fecha.</p>
    <div class="chips">${ex.map((t) => `<button class="chip brand" data-act="openAdd" data-prefill="${esc(t)}">“${esc(t)}”</button>`).join('')}</div></section>`;
}

function donutCard(ms) {
  const sl = L.byCategory(ms);
  const t = sl.reduce((a, x) => a + x.total, 0);
  return `<section class="card"><div class="sec-title"><h3>¿En qué se va tu plata?</h3><button class="link" data-act="tab" data-tab="analysis">Análisis</button></div>
    <div class="donut-row">${C.donut(sl.map((x) => ({ value: x.total, color: x.color })), { size: 140, center: compactMoney(t) })}
    <ul class="legend">${sl.slice(0, 5).map((x) => `<li><i style="background:${x.color}"></i><span>${esc(x.name)}</span><small>${Math.round((x.total / t) * 100)} %</small></li>`).join('')}</ul></div></section>`;
}

function budgetRow(c, spent) {
  const pr = c.budget > 0 ? spent / c.budget : 0;
  return `<button class="budget" data-act="openCatBudget" data-id="${c.id}">
    <div class="budget-top">${catIcon(c, 30)}<b class="grow">${esc(c.name)}</b><small><b>${money(spent)}</b> / ${money(c.budget)}</small></div>
    ${bar(pr, c.color)}${pr >= 1 ? `<small class="red">Te pasaste por ${money(spent - c.budget)}</small>` : ''}</button>`;
}
function bar(pr, color) {
  const col = pr >= 1 ? 'var(--red)' : pr >= 0.8 ? 'var(--orange)' : color;
  return `<div class="bar"><i style="width:${Math.min(Math.max(pr, 0), 1) * 100}%;background:${col}"></i></div>`;
}
const spentIn = (ms, catId) => ms.reduce((a, m) => (m.kind === 'expense' && m.catId === catId ? a + m.main : a), 0);

function budgetWatch(ms) {
  const rows = L.activeCats('expense').filter((c) => c.budget > 0)
    .map((c) => ({ c, spent: spentIn(ms, c.id) })).sort((a, b) => b.spent / b.c.budget - a.spent / a.c.budget);
  if (!rows.length) return '';
  return `<section class="card"><div class="sec-title"><h3>Presupuestos</h3><button class="link" data-act="goPlans" data-p="budgets">Ver todos</button></div>
    ${rows.slice(0, 3).map((r) => budgetRow(r.c, r.spent)).join('')}</section>`;
}

const goalSaved = (g) => g.contribs.reduce((a, c) => a + c.amount, 0);
const goalProgress = (g) => (g.target > 0 ? Math.min(goalSaved(g) / g.target, 1) : 0);
function goalMonthly(g) {
  if (!g.deadline) return null;
  const rem = g.target - goalSaved(g);
  if (rem <= 0) return null;
  const d = new Date(g.deadline); const n = new Date();
  const months = (d.getFullYear() - n.getFullYear()) * 12 + d.getMonth() - n.getMonth();
  return rem / Math.max(months, 1);
}
function ring(pr, color, content, size = 56) {
  const r = size / 2 - 5; const c = 2 * Math.PI * r;
  return `<span class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-opacity=".18" stroke-width="${size * 0.1}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${size * 0.1}" stroke-linecap="round"
      stroke-dasharray="${c * pr} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><span style="font-size:${size * 0.36}px">${content}</span></span>`;
}

function goalsPreview() {
  const gs = state.goals.filter((g) => !g.archived).slice(0, 2);
  if (!gs.length) return '';
  return `<section class="card"><div class="sec-title"><h3>Metas de ahorro</h3><button class="link" data-act="goPlans" data-p="goals">Ver</button></div>
    ${gs.map((g) => `<button class="row" data-act="openGoal" data-id="${g.id}">${ring(goalProgress(g), g.color, g.icon, 44)}
      <span class="grow"><b>${esc(g.name)}</b><small>${money(goalSaved(g))} de ${money(g.target)}</small></span>
      <b style="color:${g.color}">${Math.round(goalProgress(g) * 100)} %</b></button>`).join('')}</section>`;
}

function movementRow(m, showDate = false) {
  const c = L.catById(m.catId);
  const title = m.note || c?.name || (m.kind === 'expense' ? 'Gasto' : 'Ingreso');
  const parts = [];
  if (m.note && c) parts.push(c.name);
  if (showDate) parts.push(shortDate(L.md(m)));
  if (m.source === 'recurring') parts.push('Recurrente');
  const sign = m.kind === 'expense' ? -1 : 1;
  return `<button class="row mv" data-act="editMovement" data-id="${m.id}">${catIcon(c)}
    <span class="grow"><b>${esc(title)}</b><small>${esc(parts.join(' · ') || (m.kind === 'expense' ? 'Gasto' : 'Ingreso'))}${(m.tags || []).length ? ` <em>${esc(m.tags.map((t) => '#' + t).join(' '))}</em>` : ''}</small></span>
    <span class="amt ${m.kind === 'income' ? 'green' : ''}">${money(sign * m.main, { signed: true })}${m.currency !== cur() ? `<small>${money(m.amount, { code: m.currency })}</small>` : ''}</span></button>`;
}

A.toggleHide = () => { S().hide = !S().hide; commit(); render(); };
A.safeMode = (d) => { S().safeMode = Number(d.mode); commit(); render(); };
A.dismissInstall = () => { S().installDismissed = true; commit(); render(); };
A.goPlans = (d) => { ui.plans = d.p; ui.tab = 'plans'; render(); scrollTo(0, 0); };

// ================================================================ Movimientos

function periodNav(offset, act) {
  const p = M.shiftPeriod(L.currentPeriod(), offset);
  return `<div class="pnav"><button class="icon-btn" data-act="${act}" data-d="-1">${icon('left')}</button>
    <div><b>${esc(M.periodTitle(p))}</b>${offset ? `<button class="link small" data-act="${act}" data-d="0">Volver a hoy</button>` : ''}</div>
    <button class="icon-btn" data-act="${act}" data-d="1" ${offset >= 0 ? 'disabled' : ''}>${icon('right')}</button></div>`;
}

function filteredMovements() {
  const f = ui.filter;
  const q = P.key(f.q);
  const p = M.shiftPeriod(L.currentPeriod(), ui.mvOffset);
  return L.sortedMovements().filter((m) => {
    if (!q && !M.inPeriod(p, L.md(m))) return false;
    if (f.kind && m.kind !== f.kind) return false;
    if (f.cat && m.catId !== f.cat) return false;
    if (f.tag && !(m.tags || []).includes(f.tag)) return false;
    if (q) {
      const hay = P.key(`${m.note} ${L.catById(m.catId)?.name ?? ''} ${(m.tags || []).join(' ')} ${m.amount}`);
      return hay.includes(q);
    }
    return true;
  });
}

function movementsList() {
  const ms = filteredMovements();
  const spent = L.total(ms, 'expense'); const income = L.total(ms, 'income');
  const groups = new Map();
  for (const m of ms) {
    const d = L.md(m); const k = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }
  return `<div class="tiles">${tile('Gastos', spent, 'up', 'red')}${tile('Ingresos', income, 'dn', 'green')}${tile('Balance', income - spent, 'stack', income - spent >= 0 ? 'brand' : 'red')}</div>
    ${!ms.length ? `<div class="empty">${icon(ui.filter.q ? 'search' : 'list', 'big')}<b>${ui.filter.q ? 'Sin resultados' : 'Sin movimientos'}</b><small>${ui.filter.q ? 'Prueba con otra palabra.' : 'Toca Registrar para anotar tu primer gasto de este periodo.'}</small></div>` : ''}
    ${[...groups.entries()].map(([k, items]) => {
      const dt = items.reduce((a, m) => a + (m.kind === 'expense' ? -m.main : m.main), 0);
      return `<h4 class="day"><span>${esc(dayLabel(new Date(Number(k))))}</span><span>${money(dt)}</span></h4><div class="card list">${items.map((m) => movementRow(m)).join('')}</div>`;
    }).join('')}`;
}

function viewMovements() {
  const f = ui.filter;
  const tags = [...new Set(state.movements.flatMap((m) => m.tags || []))].sort();
  const chip = (label, on, act, extra = '') => `<button class="chip ${on ? 'on' : ''}" data-act="${act}" ${extra}>${label}</button>`;
  return `<header class="top"><h1>Movimientos</h1></header>
    <label class="search">${icon('search')}<input type="search" placeholder="Buscar: nota, categoría, #etiqueta" value="${esc(f.q)}" data-in="mvSearch"></label>
    ${f.q ? '' : `<section class="card pad-s">${periodNav(ui.mvOffset, 'mvPeriod')}</section>`}
    <div class="chips scroll">
      ${chip('Todos', !f.kind && !f.cat && !f.tag, 'mvFilter', 'data-k="all"')}
      ${chip('Gastos', f.kind === 'expense', 'mvFilter', 'data-k="expense"')}
      ${chip('Ingresos', f.kind === 'income', 'mvFilter', 'data-k="income"')}
      <select class="chip ${f.cat ? 'on' : ''}" data-ch="mvCat"><option value="">Categoría</option>${L.activeCats().map((c) => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select>
      ${tags.length ? `<select class="chip ${f.tag ? 'on' : ''}" data-ch="mvTag"><option value="">Etiqueta</option>${tags.map((t) => `<option value="${esc(t)}" ${f.tag === t ? 'selected' : ''}>#${esc(t)}</option>`).join('')}</select>` : ''}
    </div>
    <div id="mvList">${movementsList()}</div>`;
}

A.mvPeriod = (d) => { ui.mvOffset = d.d === '0' ? 0 : Math.min(ui.mvOffset + Number(d.d), 0); render(); };
A.mvFilter = (d) => {
  if (d.k === 'all') ui.filter = { ...ui.filter, kind: null, cat: null, tag: null };
  else ui.filter.kind = ui.filter.kind === d.k ? null : d.k;
  render();
};
CH.mvCat = (el) => { ui.filter.cat = el.value || null; render(); };
CH.mvTag = (el) => { ui.filter.tag = el.value || null; render(); };
IN.mvSearch = (el) => { ui.filter.q = el.value; $('#mvList').innerHTML = movementsList(); };

// ================================================================ Análisis

function viewAnalysis() {
  const p = M.shiftPeriod(L.currentPeriod(), ui.anOffset);
  const ms = L.inPeriod(state.movements, p);
  const prev = L.inPeriod(state.movements, M.shiftPeriod(p, -1));
  const spent = L.total(ms, 'expense'); const income = L.total(ms, 'income'); const prevSpent = L.total(prev, 'expense');
  const saving = income - spent;
  const change = prevSpent > 0 ? (spent - prevSpent) / prevSpent : null;
  const slices = L.byCategory(ms, ui.anKind);
  const sliceTotal = slices.reduce((a, x) => a + x.total, 0);
  const trend = L.periodTotals(state.movements, p, 6);
  const days = L.dailyTotals(state.movements, p);
  const avg = days.length ? days.reduce((a, d) => a + d.total, 0) / days.length : 0;
  const expCats = L.activeCats('expense');
  const evoId = ui.evoCat || L.byCategory(ms)[0]?.id || expCats[0]?.id;
  const evoCat = L.catById(evoId);
  const evo = L.periodTotals(state.movements.filter((m) => m.catId === evoId), p, 6);
  const tags = L.tagTotals(ms);
  const fmtAxis = (v) => (S().hide ? '•' : M.compact(v, cur()));
  return `<header class="top"><h1>Análisis</h1></header>
    <section class="card pad-s">${periodNav(ui.anOffset, 'anPeriod')}</section>
    <section class="card">
      <div class="split"><div><small class="muted">Gastaste</small><div class="big-num">${money(spent)}</div></div>
        ${change != null ? `<span class="badge ${change > 0 ? 'red' : 'green'}">${change > 0 ? '+' : ''}${Math.round(change * 100)} % vs. periodo anterior</span>` : ''}</div>
      <div class="split mt"><div><small class="muted">Ingresos</small><b>${money(income)}</b></div>
        <div class="right"><small class="muted">${saving >= 0 ? 'Ahorro' : 'Déficit'}</small><b class="${saving >= 0 ? 'green' : 'red'}">${money(saving)}</b></div></div>
      ${income > 0 ? `<p class="muted small mt">${saving >= 0 ? `Ahorraste el ${Math.round((saving / income) * 100)} % de tus ingresos.` : 'Gastaste más de lo que ganaste este periodo.'}</p>` : ''}
    </section>
    <section class="card">
      <div class="seg">${['expense', 'income'].map((k) => `<button class="${ui.anKind === k ? 'on' : ''}" data-act="anKind" data-k="${k}">${k === 'expense' ? 'Gastos' : 'Ingresos'}</button>`).join('')}</div>
      ${!slices.length ? `<div class="empty">${icon('pie', 'big')}<b>Sin datos</b><small>No hay ${ui.anKind === 'expense' ? 'gastos' : 'ingresos'} en este periodo.</small></div>` : `
      <div class="center">${C.donut(slices.map((x) => ({ value: x.total, color: x.color })), { size: 210, center: compactMoney(sliceTotal) })}</div>
      ${slices.map((x) => `<button class="slice" data-act="openCatDetail" data-id="${x.id ?? ''}" data-off="${ui.anOffset}">${catIcon(x, 34)}
        <span class="grow"><span class="split"><b>${esc(x.name)}</b><b>${money(x.total)}</b></span>
        <span class="split">${bar(x.total / sliceTotal, x.color).replace('class="bar"', 'class="bar thin"')}<small class="muted pct">${Math.round((x.total / sliceTotal) * 100)} %</small></span></span></button>`).join('')}`}
    </section>
    <section class="card"><h3>Últimos 6 periodos</h3>
      ${C.bars(trend.map((t) => ({ label: M.periodShort(t.p), values: [t.spent, t.income] })), ['#EF4444', '#16A34A'], fmtAxis)}
      <div class="legend-inline"><span><i style="background:#EF4444"></i>Gastos</span><span><i style="background:#16A34A"></i>Ingresos</span></div></section>
    <section class="card"><div class="split"><h3>Gasto por día</h3><small class="muted">Promedio ${money(avg)}</small></div>
      ${C.daily(days.map((d) => d.total), days.map((d, i) => (i % 7 === 0 ? String(d.day.getDate()) : '')), avg, fmtAxis, 'var(--brand)')}</section>
    <section class="card"><div class="split"><h3>Evolución por categoría</h3>
      <select class="chip on" data-ch="evoCat">${expCats.map((c) => `<option value="${c.id}" ${c.id === evoId ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select></div>
      ${C.line(evo.map((t) => ({ label: M.periodShort(t.p), value: t.spent })), evoCat?.color || '#0E9F6E', fmtAxis)}
      ${evo[0].spent > 0 ? `<p class="muted small">${evo[5].spent >= evo[0].spent ? `Subió ${Math.round(((evo[5].spent - evo[0].spent) / evo[0].spent) * 100)} %` : `Bajó ${Math.round(((evo[0].spent - evo[5].spent) / evo[0].spent) * 100)} %. ¡Bien!`} en 6 periodos.</p>` : ''}</section>
    ${tags.length ? `<section class="card"><h3>Etiquetas</h3>${tags.slice(0, 8).map((t) => `<div class="split row-s"><span><b class="brand">#${esc(t.tag)}</b> <small class="muted">· ${t.count}</small></span><b>${money(t.total)}</b></div>`).join('')}</section>` : ''}`;
}
A.anPeriod = (d) => { ui.anOffset = d.d === '0' ? 0 : Math.min(ui.anOffset + Number(d.d), 0); render(); };
A.anKind = (d) => { ui.anKind = d.k; render(); };
CH.evoCat = (el) => { ui.evoCat = el.value; render(); };

// ================================================================ Planes

function viewPlans() {
  const seg = [['budgets', 'Presupuestos'], ['goals', 'Metas'], ['recurring', 'Recurrentes']]
    .map(([k, l]) => `<button class="${ui.plans === k ? 'on' : ''}" data-act="plansSeg" data-k="${k}">${l}</button>`).join('');
  const body = ui.plans === 'budgets' ? plansBudgets() : ui.plans === 'goals' ? plansGoals() : plansRecurring();
  return `<header class="top"><h1>Planes</h1></header><div class="seg big">${seg}</div>${body}`;
}
A.plansSeg = (d) => { ui.plans = d.k; render(); };

function plansBudgets() {
  const s = L.safeToSpend();
  const ms = L.inPeriod(state.movements, s.p);
  const withBudget = L.activeCats('expense').filter((c) => c.budget > 0);
  return `<button class="card block" data-act="openBudget"><div class="split"><h3>Presupuesto del mes</h3>${icon('pencil', 'muted')}</div>
      ${s.hasBudget ? `<div class="big-num">${money(s.spent)} <small class="muted">de ${money(s.budget)}</small></div>${bar(s.progress, 'var(--brand)')}
        <p class="small ${s.isOver ? 'red' : 'muted'}">${s.isOver ? `Te pasaste por ${money(-s.remaining)}.` : `Te quedan ${money(s.remaining)} · ≈ ${money(s.perDay)} por día.`}</p>
        ${!S().budget ? '<p class="muted small">Calculado con la suma de los presupuestos por categoría.</p>' : ''}`
      : '<p class="muted">Define cuánto quieres gastar al mes y Rinde te dirá cuánto puedes gastar cada día.</p>'}</button>
    <section class="card"><div class="sec-title"><h3>Por categoría</h3><button class="link" data-act="pickCatBudget">＋ Agregar</button></div>
      ${withBudget.length ? withBudget.map((c) => budgetRow(c, spentIn(ms, c.id))).join('')
        : '<p class="muted">Pon un límite a las categorías donde más gastas y recibe alertas al 80 % y al 100 %.</p>'}</section>`;
}

function plansGoals() {
  const gs = state.goals.filter((g) => !g.archived);
  return `${!gs.length ? `<section class="card center-text"><div class="emoji-big">⭐</div><h3>Ahorra para lo que quieres</h3><p class="muted">Un viaje, un celular, el fondo de emergencia… Crea una meta y ve sumando aportes.</p></section>` : ''}
    ${gs.map((g) => {
      const mo = goalMonthly(g);
      return `<button class="card row-card" data-act="openGoal" data-id="${g.id}">${ring(goalProgress(g), g.color, g.icon, 60)}
      <span class="grow"><b>${esc(g.name)}</b><small><b>${money(goalSaved(g))}</b> de ${money(g.target)}</small>
      ${goalSaved(g) >= g.target ? '<small class="green">¡Meta cumplida!</small>' : mo ? `<small>Ahorra ${money(mo)}/mes para el ${longDate(new Date(g.deadline))}</small>` : ''}</span>
      <b class="pct-big" style="color:${g.color}">${Math.round(goalProgress(g) * 100)} %</b></button>`;
    }).join('')}
    <button class="card add-btn" data-act="openGoalEditor">＋ Nueva meta</button>`;
}

function plansRecurring() {
  const active = state.rules.filter((r) => r.active); const paused = state.rules.filter((r) => !r.active);
  const monthly = active.filter((r) => r.kind === 'expense').reduce((a, r) => a + r.amount * (M.FREQUENCIES[r.freq]?.perMonth ?? 1), 0);
  const sug = L.suggestions(); const pend = L.pendingRules();
  const list = (title, rs) => `<section class="card"><h3>${title}</h3>${rs.map((r) => {
    const c = L.catById(r.catId);
    return `<button class="row" data-act="openRule" data-id="${r.id}">${catIcon(c, 36)}<span class="grow"><b>${esc(r.title)}</b>
      <small>${M.FREQUENCIES[r.freq]?.title} · ${r.active ? `próximo ${shortDate(L.nextDate(r))}` : 'pausado'}</small></span>
      <span class="amt ${r.kind === 'income' ? 'green' : ''}">${money((r.kind === 'expense' ? -1 : 1) * r.amount, { signed: true })}<small>${r.auto ? 'Automático' : 'Recordatorio'}</small></span></button>`;
  }).join('')}</section>`;
  return `<section class="card"><small class="muted">Pagos fijos al mes</small><div class="big-num">${money(monthly)}</div>
      <p class="muted small">Arriendo, servicios, suscripciones, cuotas… Se registran solos o quedan pendientes para que los confirmes.</p></section>
    ${pend.length ? `<button class="card row-card" data-act="openPending">${icon('clock', 'orange big')}<b class="grow orange">${pend.length} por revisar</b>${icon('right', 'muted')}</button>` : ''}
    ${sug.length ? `<section class="card"><h3>${icon('wand', 'inline brand')} Detectamos pagos que se repiten</h3>${sug.slice(0, 4).map((s, i) => `<div class="row">
      <span class="grow"><b>${esc(s.title)}</b><small>${M.FREQUENCIES[s.freq].title} · ${s.count} veces</small></span><b>${money(s.amount)}</b>
      <button class="mini" data-act="ruleFromSuggestion" data-i="${i}">Crear</button></div>`).join('')}</section>` : ''}
    ${!state.rules.length && !sug.length ? '<section class="card center-text"><p class="muted">Aún no tienes pagos recurrentes.</p></section>' : ''}
    ${active.length ? list('Activos', active) : ''}${paused.length ? list('Pausados', paused) : ''}
    <button class="card add-btn" data-act="openRuleEditor">＋ Nuevo pago recurrente</button>`;
}

const VIEWS = { home: viewHome, movements: viewMovements, analysis: viewAnalysis, plans: viewPlans };

// ================================================================ Hojas (sheets)

const SHEETS = {};
const topSheet = () => ui.sheets[ui.sheets.length - 1];
const sheetEl = (sh) => $(`[data-sheet="${sh.id}"]`);

function openSheet(type, props = {}) {
  const sh = { id: uid(), type, props, st: SHEETS[type].init ? SHEETS[type].init(props) : {} };
  ui.sheets.push(sh);
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.dataset.sheet = sh.id;
  wrap.innerHTML = `<div class="backdrop" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true">${SHEETS[type].html(sh)}</div>`;
  $('#sheets').append(wrap);
  document.body.classList.add('noscroll');
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  SHEETS[type].mounted?.(sh, wrap);
  return sh;
}

function refreshSheet(sh = topSheet()) {
  if (!sh) return;
  const el = sheetEl(sh);
  const body = el.querySelector('.sh-body');
  const scroll = body?.scrollTop ?? 0;
  el.querySelector('.sheet').innerHTML = SHEETS[sh.type].html(sh);
  const nb = el.querySelector('.sh-body');
  if (nb) nb.scrollTop = scroll;
  SHEETS[sh.type].mounted?.(sh, el);
}

function closeSheet() {
  const sh = ui.sheets.pop();
  if (!sh) return;
  SHEETS[sh.type].closed?.(sh);
  const el = sheetEl(sh);
  el.classList.remove('open');
  setTimeout(() => el.remove(), 280);
  if (!ui.sheets.length) document.body.classList.remove('noscroll');
  else refreshSheet(topSheet());
  render();
}
A.closeSheet = () => closeSheet();

const head = (title, right = '', left = '<button class="link" data-act="closeSheet">Cancelar</button>') =>
  `<header class="sh-head">${left}<h3>${esc(title)}</h3>${right || '<span></span>'}</header>`;
const done = '<button class="link bold" data-act="closeSheet">Listo</button>';

function amountInput(field, value, code = cur(), cls = 'field amount-field') {
  return `<div class="${cls}"><span>${esc(M.symbol(code))}</span><input inputmode="decimal" placeholder="0" data-in="amount" data-f="${field}"
    value="${value ? M.groupDigits(M.rawFromValue(value, code)) : ''}"></div>`;
}
IN.amount = (el) => {
  const sh = topSheet();
  const raw = M.sanitizeAmount(el.value, cur());
  el.value = M.groupDigits(raw);
  sh.st[el.dataset.f] = M.amountValue(raw);
  SHEETS[sh.type].changed?.(sh, el.dataset.f);
};
IN.field = (el) => {
  const sh = topSheet();
  sh.st[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
  SHEETS[sh.type].changed?.(sh, el.dataset.f);
};
CH.field = (el) => IN.field(el);

// ---------------------------------------------------------------- Registrar / editar movimiento

function openAdd(prefill) { openSheet('add', { prefill }); }
A.openAdd = (d) => openAdd(d.prefill);
A.editMovement = (d) => openSheet('add', { editId: d.id });

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

SHEETS.add = {
  init({ editId, prefill }) {
    const m = editId && state.movements.find((x) => x.id === editId);
    if (m) {
      return { editId, kind: m.kind, smart: '', amount: m.amount, catId: m.catId, note: m.note, date: toInputDate(L.md(m)),
        tags: (m.tags || []).map((t) => '#' + t).join(' '), currency: m.currency, rate: m.rate, parsed: [], source: m.source, time: L.md(m) };
    }
    return { kind: 'expense', smart: prefill || '', amount: 0, catId: null, note: '', date: toInputDate(new Date()), tags: '',
      currency: cur(), rate: 1, parsed: [], source: 'manual', showAll: false };
  },
  html(sh) {
    const st = sh.st;
    const multi = !st.editId && st.parsed.filter((e) => e.amount != null).length > 1;
    return `${head(st.editId ? 'Editar movimiento' : 'Registrar')}
    <div class="sh-body">
      <div class="seg">${['expense', 'income'].map((k) => `<button class="${st.kind === k ? 'on' : ''}" data-act="addKind" data-k="${k}">${k === 'expense' ? 'Gasto' : 'Ingreso'}</button>`).join('')}</div>
      ${st.editId ? '' : `<section class="card">
        <div class="smart-top">${icon('sparkles', 'brand')}<span id="smartHint">Escribe como en un chat</span><span class="grow"></span><span id="ocrStatus"></span></div>
        <textarea id="smart" rows="1" enterkeyhint="done" placeholder="Ej: almuerzo 18 mil ayer #trabajo" data-in="smart">${esc(st.smart)}</textarea>
        <div class="smart-actions">
          ${SR ? `<button class="pill-btn" data-act="dictate" id="dictBtn">${icon('mic')}<span>Dictar</span></button>` : ''}
          <label class="pill-btn">${icon('camera')}<span>Recibo</span><input type="file" accept="image/*" hidden data-ch="receipt"></label>
          <span class="grow"></span>
          <button class="clear" data-act="clearSmart" aria-label="Borrar">${icon('x')}</button>
        </div>
        ${SR ? '' : '<p class="muted tiny">Tip: toca el micrófono 🎤 del teclado para dictar.</p>'}
        <div id="understood"></div></section>`}
      <div id="multi" ${multi ? '' : 'hidden'}></div>
      <div id="single" ${multi ? 'hidden' : ''}>
        <section class="card">
          <div class="split"><small class="muted b">Monto</small>
            <select class="chip" data-ch="addCurrency">${M.CURRENCIES.map((c) => `<option value="${c}" ${c === st.currency ? 'selected' : ''}>${M.currencyFlag(c)} ${c}</option>`).join('')}</select></div>
          <div class="amount-big ${st.kind === 'income' ? 'green' : ''}"><span id="amtSym">${esc(M.symbol(st.currency, st.currency === cur()))}</span>
            <input id="amount" inputmode="decimal" placeholder="0" data-in="addAmount" value="${st.amount ? M.groupDigits(M.rawFromValue(st.amount, st.currency)) : ''}"></div>
          <div id="rateRow"></div>
        </section>
        <section class="card"><small class="muted b">Categoría</small><div class="cat-grid" id="catGrid"></div></section>
        <section class="card form">
          <label class="frow"><span>📝</span><input id="note" placeholder="Descripción (opcional)" value="${esc(st.note)}" data-in="field" data-f="note"></label>
          <label class="frow"><span>📅</span><input id="date" type="date" value="${st.date}" max="${toInputDate(new Date(Date.now() + 366 * 864e5))}" data-ch="field" data-in="field" data-f="date"></label>
          <label class="frow"><span>#</span><input id="tags" placeholder="Etiquetas: #viaje #trabajo" value="${esc(st.tags)}" autocapitalize="off" data-in="field" data-f="tags"></label>
        </section>
        <div id="frequent"></div>
        ${st.editId ? `<button class="card danger-btn" data-act="deleteMovement">${icon('trash')} Eliminar movimiento</button>` : ''}
      </div>
    </div>
    <footer class="sh-foot"><button class="primary" id="saveBtn" data-act="saveAdd">Guardar</button></footer>`;
  },
  mounted(sh, el) {
    SHEETS.add.update(sh);
    const ta = el.querySelector('#smart');
    if (ta) {
      autoGrow(ta);
      if (sh.st.smart) SHEETS.add.parse(sh);
      else setTimeout(() => ta.focus({ preventScroll: true }), 350);
    }
  },
  closed(sh) { sh.recognition?.stop?.(); },
  changed(sh) { SHEETS.add.update(sh); },
  parse(sh) {
    const st = sh.st;
    st.parsed = L.parseText(st.smart);
    const first = st.parsed[0];
    if (first && st.parsed.length === 1) {
      if (first.kind) st.kind = first.kind;
      if (first.amount != null) {
        st.amount = first.amount;
        if (first.currency && first.currency !== st.currency) setCurrency(sh, first.currency);
      }
      if (first.categoryId) st.catId = first.categoryId;
      st.date = toInputDate(first.date || new Date());
      st.note = first.note;
      if (first.tags.length) st.tags = first.tags.map((t) => '#' + t).join(' ');
      if (st.source === 'manual') st.source = 'text';
      const s = sheetEl(sh);
      s.querySelector('#amount').value = st.amount ? M.groupDigits(M.rawFromValue(st.amount, st.currency)) : '';
      s.querySelector('#note').value = st.note;
      s.querySelector('#date').value = st.date;
      s.querySelector('#tags').value = st.tags;
      s.querySelector('select[data-ch="addCurrency"]').value = st.currency;
    }
    SHEETS.add.update(sh);
  },
  update(sh) {
    const st = sh.st; const el = sheetEl(sh);
    if (!el) return;
    if (st.catId && L.catById(st.catId)?.kind !== st.kind) st.catId = null;
    const multi = !st.editId && st.parsed.filter((e) => e.amount != null).length > 1;
    el.querySelector('#multi').hidden = !multi;
    el.querySelector('#single').hidden = multi;
    $$('.seg button', el).forEach((b) => b.classList.toggle('on', b.dataset.k === st.kind));
    el.querySelector('.amount-big')?.classList.toggle('green', st.kind === 'income');
    el.querySelector('#amtSym').textContent = M.symbol(st.currency, st.currency === cur());
    // Lo que entendió
    const u = el.querySelector('#understood');
    if (u) {
      const f = st.parsed[0];
      if (f && !multi && (f.amount != null || f.categoryId)) {
        const c = L.catById(f.categoryId);
        const chips = [];
        if (f.amount != null) chips.push(`💲 ${money(f.amount, { code: f.currency || st.currency, force: true })}`);
        if (c) chips.push(`${c.icon} ${esc(c.name)}`);
        if (f.date) chips.push(`📅 ${esc(dayLabel(f.date))}`);
        if (f.kind === 'income') chips.push('⬇️ Ingreso');
        f.tags.forEach((t) => chips.push(`#${esc(t)}`));
        u.innerHTML = `<div class="understood"><small class="muted">Entendí:</small>${chips.map((x) => `<span class="chip sm">${x}</span>`).join('')}</div>`;
      } else u.innerHTML = '';
    }
    // Varios movimientos
    if (multi) {
      const list = st.parsed.filter((e) => e.amount != null);
      el.querySelector('#multi').innerHTML = `<section class="card"><h3>${icon('stack', 'inline brand')} Detecté ${list.length} movimientos</h3>
        ${list.map((e) => { const c = L.catById(e.categoryId) || L.fallbackCategory(e.kind || st.kind);
          return `<div class="row">${catIcon(c, 34)}<span class="grow"><b>${esc(e.note || c?.name || 'Movimiento')}</b><small>${esc([c?.name, e.date ? dayLabel(e.date) : null].filter(Boolean).join(' · '))}</small></span>
          <b class="${(e.kind || st.kind) === 'income' ? 'green' : ''}">${money(e.amount, { code: e.currency || cur(), force: true })}</b></div>`; }).join('')}
        <p class="muted small">Puedes editarlos luego desde Movimientos.</p></section>`;
    }
    // Tasa de cambio
    el.querySelector('#rateRow').innerHTML = st.currency !== cur()
      ? `<div class="rate">1 ${st.currency} = <input inputmode="decimal" value="${st.rate}" data-in="addRate"> ${cur()}
         ${st.amount ? `<small class="muted">≈ ${money(st.amount * st.rate, { force: true })}</small>` : ''}</div>` : '';
    // Categorías
    const cats = L.activeCats(st.kind);
    let visible = cats;
    if (!st.showAll && cats.length > 8) {
      visible = cats.slice(0, 7);
      const sel = cats.find((c) => c.id === st.catId);
      if (sel && !visible.includes(sel)) visible[6] = sel;
    }
    el.querySelector('#catGrid').innerHTML = visible.map((c) => `<button class="cat ${c.id === st.catId ? 'on' : ''}" data-act="addCat" data-id="${c.id}" style="--c:${c.color}">
        <span class="cat-dot">${c.icon}</span><small>${esc(c.name)}</small></button>`).join('') +
      (!st.showAll && cats.length > 8 ? '<button class="cat" data-act="addShowAll"><span class="cat-dot more">•••</span><small>Ver todas</small></button>' : '');
    // Frecuentes
    const fr = !st.editId && !st.amount && !st.smart ? L.frequent(st.kind) : [];
    el.querySelector('#frequent').innerHTML = fr.length ? `<small class="muted b pad-x">Frecuentes</small><div class="chips scroll">${fr.map((f, i) => {
      const c = L.catById(f.catId);
      return `<button class="chip freq" data-act="addFrequent" data-i="${i}">${c?.icon ?? ''} <span><b>${esc(f.title)}</b><small>${money(f.amount, { force: true })}</small></span></button>`; }).join('')}</div>` : '';
    sh.frequent = fr;
    // Botón guardar
    const btn = el.querySelector('#saveBtn');
    const count = st.parsed.filter((e) => e.amount != null).length;
    if (multi) btn.textContent = `Guardar ${count} movimientos`;
    else if (st.editId) btn.textContent = 'Guardar cambios';
    else btn.textContent = `${st.kind === 'expense' ? 'Guardar gasto' : 'Guardar ingreso'}${st.amount ? ` · ${M.fmt(st.amount, st.currency, { isMain: st.currency === cur() })}` : ''}`;
    btn.disabled = !(multi || st.amount > 0);
  },
};

function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; }

IN.smart = (el) => {
  const sh = topSheet();
  if (el.value.includes('\n')) { el.value = el.value.replace(/\n/g, ' ').trim(); el.blur(); }
  sh.st.smart = el.value;
  autoGrow(el);
  SHEETS.add.parse(sh);
};
IN.addAmount = (el) => {
  const sh = topSheet();
  const raw = M.sanitizeAmount(el.value, sh.st.currency);
  el.value = M.groupDigits(raw);
  sh.st.amount = M.amountValue(raw);
  SHEETS.add.update(sh);
};
IN.addRate = (el) => { const sh = topSheet(); sh.st.rate = Number(el.value.replace(',', '.')) || 0; };
A.addKind = (d) => { const sh = topSheet(); sh.st.kind = d.k; SHEETS.add.update(sh); };
A.addCat = (d) => { const sh = topSheet(); sh.st.catId = d.id; SHEETS.add.update(sh); navigator.vibrate?.(8); };
A.addShowAll = () => { const sh = topSheet(); sh.st.showAll = true; SHEETS.add.update(sh); };
A.clearSmart = () => { const sh = topSheet(); sh.st.smart = ''; sh.st.parsed = []; const ta = $('#smart'); ta.value = ''; autoGrow(ta); SHEETS.add.update(sh); ta.focus(); };
A.addFrequent = (d) => {
  const sh = topSheet(); const f = sh.frequent[Number(d.i)];
  Object.assign(sh.st, { amount: f.amount, catId: f.catId, note: f.title, source: 'frequent' });
  const el = sheetEl(sh);
  el.querySelector('#amount').value = M.groupDigits(M.rawFromValue(f.amount, sh.st.currency));
  el.querySelector('#note').value = f.title;
  SHEETS.add.update(sh);
};
CH.addCurrency = (el) => setCurrency(topSheet(), el.value);

async function setCurrency(sh, code) {
  sh.st.currency = code;
  sh.st.rate = 1;
  SHEETS.add.update(sh);
  if (code === cur()) return;
  const r = await L.exchangeRate(code, cur());
  if (r) { sh.st.rate = Math.round(r * 10000) / 10000; SHEETS.add.update(sh); } else toast('Sin internet: escribe la tasa de cambio a mano.', true);
}

A.dictate = (d, btn) => {
  const sh = topSheet();
  if (sh.recognition) { sh.recognition.stop(); return; }
  const rec = new SR();
  rec.lang = 'es-CO'; rec.interimResults = true; rec.continuous = false;
  sh.recognition = rec;
  btn.classList.add('rec'); btn.querySelector('span').textContent = 'Detener';
  $('#smartHint').textContent = 'Te escucho…';
  rec.onresult = (ev) => {
    const text = [...ev.results].map((r) => r[0].transcript).join(' ');
    const ta = $('#smart'); ta.value = text; sh.st.smart = text; sh.st.source = 'voice'; autoGrow(ta); SHEETS.add.parse(sh);
  };
  rec.onerror = () => toast('No se pudo usar el micrófono. Revisa los permisos de Safari.', true);
  rec.onend = () => { sh.recognition = null; btn.classList.remove('rec'); btn.querySelector('span').textContent = 'Dictar'; $('#smartHint').textContent = 'Escribe como en un chat'; };
  try { rec.start(); } catch { rec.onend(); }
};

CH.receipt = async (input) => {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const sh = topSheet();
  const status = $('#ocrStatus');
  status.textContent = 'Leyendo el recibo…';
  try {
    if (!window.Tesseract) {
      await new Promise((ok, fail) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        s.onload = ok; s.onerror = fail;
        document.head.append(s);
      });
    }
    const worker = await window.Tesseract.createWorker('spa');
    const { data } = await worker.recognize(file);
    await worker.terminate();
    const r = P.parseReceipt(data.text || '', L.matchers(), state.learned);
    Object.assign(sh.st, { kind: 'expense', source: 'receipt' });
    if (r.total) sh.st.amount = r.total;
    if (r.merchant) sh.st.note = r.merchant;
    if (r.date) sh.st.date = toInputDate(r.date);
    if (r.categoryId) sh.st.catId = r.categoryId;
    const el = sheetEl(sh);
    el.querySelector('#amount').value = sh.st.amount ? M.groupDigits(M.rawFromValue(sh.st.amount, sh.st.currency)) : '';
    el.querySelector('#note').value = sh.st.note;
    el.querySelector('#date').value = sh.st.date;
    SHEETS.add.update(sh);
    status.textContent = r.total ? 'Recibo leído ✓' : 'No encontré el total';
  } catch {
    status.textContent = '';
    toast('No se pudo leer el recibo. Para esto necesitas internet la primera vez.', true);
  }
};

function tagsFrom(text) {
  return [...new Set(text.split(/[\s,#]+/).map((t) => t.toLowerCase().replace(/[^\p{L}\p{N}_]/gu, '')).filter(Boolean))];
}

A.saveAdd = async () => {
  const sh = topSheet(); const st = sh.st;
  sh.recognition?.stop?.();
  const multi = !st.editId && st.parsed.filter((e) => e.amount != null).length > 1;
  let alert = null;
  if (multi) {
    let n = 0;
    for (const e of st.parsed.filter((x) => x.amount != null)) {
      let rate = 1;
      if (e.currency && e.currency !== cur()) rate = (await L.exchangeRate(e.currency, cur())) || 1;
      const m = L.addMovement({ amount: e.amount, kind: e.kind || st.kind, catId: e.categoryId, note: e.note, date: e.date || new Date(),
        tags: e.tags, currency: e.currency || cur(), rate, source: st.source });
      alert = L.budgetAlert(m) || alert;
      n++;
    }
    commit(alert || `${n} movimientos guardados`, !!alert);
  } else {
    if (!(st.amount > 0)) return;
    const catId = st.catId || L.fallbackCategory(st.kind)?.id;
    const date = fromInputDate(st.date, st.time || new Date());
    const note = st.note.trim();
    const tags = tagsFrom(st.tags);
    if (st.editId) {
      const m = state.movements.find((x) => x.id === st.editId);
      const rate = st.currency === cur() ? 1 : st.rate || 1;
      Object.assign(m, { amount: st.amount, kind: st.kind, catId, note, date: date.toISOString(), tags, currency: st.currency, rate, main: st.amount * rate });
      commit('Cambios guardados');
    } else {
      const m = L.addMovement({ amount: st.amount, kind: st.kind, catId, note, date, tags, currency: st.currency, rate: st.rate, source: st.source });
      alert = L.budgetAlert(m);
      commit(alert || `${st.kind === 'expense' ? 'Gasto' : 'Ingreso'} guardado · ${M.fmt(st.amount, st.currency, { isMain: st.currency === cur() })}`, !!alert);
    }
    if (note && catId) { L.learn(note, catId); save(); }
  }
  closeSheet();
};

A.deleteMovement = () => {
  const sh = topSheet();
  if (!confirm('¿Eliminar este movimiento?')) return;
  L.deleteMovement(sh.st.editId);
  commit('Movimiento eliminado');
  closeSheet();
};

// ---------------------------------------------------------------- Presupuestos

A.openBudget = () => openSheet('budget');
SHEETS.budget = {
  init: () => ({ budget: S().budget, cycleDay: S().cycleDay }),
  html: (sh) => `${head('Presupuesto', '<button class="link bold" data-act="saveBudget">Guardar</button>')}
    <div class="sh-body"><section class="card form">
      <label class="frow"><span class="grow">Presupuesto mensual</span>${amountInput('budget', sh.st.budget, cur(), 'inline-amount')}</label></section>
      <p class="foot-note">Es lo máximo que quieres gastar en el periodo. Déjalo en 0 para usar la suma de los presupuestos por categoría.</p>
      <section class="card form"><label class="frow"><span class="grow">El mes empieza el día</span>
        <select data-ch="field" data-f="cycleDay">${Array.from({ length: 28 }, (_, i) => `<option ${i + 1 === Number(sh.st.cycleDay) ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label></section>
      <p class="foot-note">Útil si te pagan, por ejemplo, el 15 o el 30: tu “mes” irá de ese día al mismo día del mes siguiente.</p></div>`,
};
A.saveBudget = () => { const st = topSheet().st; S().budget = st.budget || 0; S().cycleDay = Number(st.cycleDay) || 1; commit('Presupuesto guardado'); closeSheet(); };

A.pickCatBudget = () => openSheet('pickCat');
SHEETS.pickCat = {
  html: () => `${head('Elige una categoría')}<div class="sh-body"><section class="card list">
    ${L.activeCats('expense').filter((c) => !c.budget).map((c) => `<button class="row" data-act="pickedCat" data-id="${c.id}">${catIcon(c, 34)}<b class="grow">${esc(c.name)}</b>${icon('right', 'muted')}</button>`).join('')}</section></div>`,
};
A.pickedCat = (d) => { closeSheet(); setTimeout(() => openSheet('catBudget', { id: d.id }), 300); };
A.openCatBudget = (d) => openSheet('catBudget', { id: d.id });
SHEETS.catBudget = {
  init: ({ id }) => ({ budget: L.catById(id)?.budget || 0 }),
  html: (sh) => {
    const c = L.catById(sh.props.id);
    return `${head('Presupuesto', '<button class="link bold" data-act="saveCatBudget">Guardar</button>')}
    <div class="sh-body"><section class="card form"><div class="frow">${catIcon(c, 40)}<b class="grow">${esc(c.name)}</b></div>
      <label class="frow"><span class="grow">Límite mensual</span>${amountInput('budget', sh.st.budget, cur(), 'inline-amount')}</label></section>
      <p class="foot-note">Te avisamos cuando llegues al 80 % y al 100 %.</p>
      ${c.budget ? '<button class="card danger-btn" data-act="removeCatBudget">Quitar presupuesto</button>' : ''}</div>`;
  },
};
A.saveCatBudget = () => { const sh = topSheet(); L.catById(sh.props.id).budget = sh.st.budget || 0; commit('Presupuesto guardado'); closeSheet(); };
A.removeCatBudget = () => { const sh = topSheet(); L.catById(sh.props.id).budget = 0; commit(); closeSheet(); };

// ---------------------------------------------------------------- Metas

A.openGoalEditor = (d) => openSheet('goalEdit', { id: d?.id });
SHEETS.goalEdit = {
  init: ({ id }) => {
    const g = id && state.goals.find((x) => x.id === id);
    const six = new Date(); six.setMonth(six.getMonth() + 6);
    return g ? { name: g.name, icon: g.icon, color: g.color, target: g.target, hasDeadline: !!g.deadline, deadline: toInputDate(new Date(g.deadline || six)) }
      : { name: '', icon: '⭐', color: '#0E9F6E', target: 0, initial: 0, hasDeadline: false, deadline: toInputDate(six) };
  },
  html: (sh) => {
    const st = sh.st;
    return `${head(sh.props.id ? 'Editar meta' : 'Nueva meta', '<button class="link bold" data-act="saveGoal">Guardar</button>')}
    <div class="sh-body"><section class="card form">
      <label class="frow"><input placeholder="Nombre (ej: Viaje a Cartagena)" value="${esc(st.name)}" data-in="field" data-f="name"></label>
      <label class="frow"><span class="grow">Meta</span>${amountInput('target', st.target, cur(), 'inline-amount')}</label>
      ${sh.props.id ? '' : `<label class="frow"><span class="grow">Ya tengo ahorrado</span>${amountInput('initial', st.initial, cur(), 'inline-amount')}</label>`}
      <label class="frow"><span class="grow">Fecha límite</span><input type="checkbox" class="switch" ${st.hasDeadline ? 'checked' : ''} data-ch="goalDeadline"></label>
      ${st.hasDeadline ? `<label class="frow"><span class="grow">Para el</span><input type="date" value="${st.deadline}" min="${toInputDate(new Date())}" data-ch="field" data-in="field" data-f="deadline"></label>` : ''}
    </section>
    <small class="muted b pad-x">Ícono</small><section class="card"><div class="emoji-grid">${EMOJIS.map((e) => `<button class="${e === st.icon ? 'on' : ''}" data-act="goalIcon" data-e="${e}">${e}</button>`).join('')}</div></section>
    <small class="muted b pad-x">Color</small><section class="card"><div class="color-grid">${COLORS.map((c) => `<button style="background:${c}" class="${c === st.color ? 'on' : ''}" data-act="goalColor" data-c="${c}"></button>`).join('')}</div></section></div>`;
  },
};
CH.goalDeadline = (el) => { topSheet().st.hasDeadline = el.checked; refreshSheet(); };
A.goalIcon = (d) => { topSheet().st.icon = d.e; refreshSheet(); };
A.goalColor = (d) => { topSheet().st.color = d.c; refreshSheet(); };
A.saveGoal = () => {
  const sh = topSheet(); const st = sh.st;
  if (!st.name.trim() || !(st.target > 0)) { toast('Ponle nombre y monto a la meta.', true); return; }
  const deadline = st.hasDeadline ? fromInputDate(st.deadline).toISOString() : null;
  if (sh.props.id) {
    Object.assign(state.goals.find((g) => g.id === sh.props.id), { name: st.name.trim(), icon: st.icon, color: st.color, target: st.target, deadline });
  } else {
    const g = { id: uid(), name: st.name.trim(), icon: st.icon, color: st.color, target: st.target, deadline, archived: false, contribs: [] };
    if (st.initial > 0) g.contribs.push({ id: uid(), amount: st.initial, date: new Date().toISOString(), note: 'Saldo inicial' });
    state.goals.push(g);
  }
  commit('Meta guardada');
  closeSheet();
};

A.openGoal = (d) => openSheet('goal', { id: d.id });
SHEETS.goal = {
  html: (sh) => {
    const g = state.goals.find((x) => x.id === sh.props.id);
    if (!g) return head('Meta', done);
    const saved = goalSaved(g); const mo = goalMonthly(g);
    return `${head(g.name, done, '<span></span>')}<div class="sh-body">
      <section class="card center-text">${ring(goalProgress(g), g.color, g.icon, 110)}
        <div class="big-num">${money(saved)}</div><p class="muted">de ${money(g.target)} · faltan ${money(Math.max(g.target - saved, 0))}</p>
        ${mo ? `<span class="chip sm" style="background:${g.color}22">Para llegar a tiempo: ${money(mo)} al mes</span>` : ''}
        <div class="two"><button class="primary" data-act="openContrib" data-w="0">＋ Aportar</button><button class="secondary" data-act="openContrib" data-w="1" ${saved <= 0 ? 'disabled' : ''}>− Retirar</button></div></section>
      <small class="muted b pad-x">Historial</small>
      <section class="card list">${g.contribs.length ? [...g.contribs].sort((a, b) => new Date(b.date) - new Date(a.date)).map((c) => `<div class="row">
        <span class="grow"><b>${esc(c.note || (c.amount >= 0 ? 'Aporte' : 'Retiro'))}</b><small>${longDate(new Date(c.date))}</small></span>
        <b class="${c.amount >= 0 ? 'green' : 'red'}">${money(c.amount, { signed: true })}</b>
        <button class="icon-btn sm" data-act="delContrib" data-id="${c.id}" aria-label="Eliminar">${icon('trash')}</button></div>`).join('') : '<p class="muted">Aún no hay aportes.</p>'}</section>
      <section class="card list"><button class="row link" data-act="openGoalEditor" data-id="${g.id}">Editar meta</button>
        <button class="row link" data-act="archiveGoal">${g.archived ? 'Reactivar meta' : 'Archivar meta'}</button>
        <button class="row red" data-act="deleteGoal">Eliminar meta</button></section></div>`;
  },
};
A.openContrib = (d) => openSheet('contrib', { goalId: topSheet().props.id, w: d.w === '1' });
SHEETS.contrib = {
  init: () => ({ amount: 0, date: toInputDate(new Date()), note: '' }),
  html: (sh) => `${head(sh.props.w ? 'Retirar' : 'Aportar', '<button class="link bold" data-act="saveContrib">Guardar</button>')}
    <div class="sh-body"><section class="card form">
      <label class="frow"><span class="grow">${sh.props.w ? 'Retiro' : 'Aporte'}</span>${amountInput('amount', 0, cur(), 'inline-amount')}</label>
      <label class="frow"><span class="grow">Fecha</span><input type="date" value="${sh.st.date}" data-ch="field" data-in="field" data-f="date"></label>
      <label class="frow"><input placeholder="Nota (opcional)" data-in="field" data-f="note"></label></section></div>`,
};
A.saveContrib = () => {
  const sh = topSheet(); const st = sh.st;
  if (!(st.amount > 0)) return;
  const g = state.goals.find((x) => x.id === sh.props.goalId);
  g.contribs.push({ id: uid(), amount: sh.props.w ? -st.amount : st.amount, date: fromInputDate(st.date).toISOString(), note: st.note.trim() });
  commit(!sh.props.w && goalSaved(g) >= g.target ? `¡Cumpliste tu meta ${g.name}! 🎉` : 'Guardado');
  closeSheet();
};
A.delContrib = (d) => { const g = state.goals.find((x) => x.id === topSheet().props.id); g.contribs = g.contribs.filter((c) => c.id !== d.id); commit(); refreshSheet(); };
A.archiveGoal = () => { const g = state.goals.find((x) => x.id === topSheet().props.id); g.archived = !g.archived; commit(); closeSheet(); };
A.deleteGoal = () => { if (!confirm('¿Eliminar la meta y su historial?')) return; state.goals = state.goals.filter((g) => g.id !== topSheet().props.id); commit(); closeSheet(); };

// ---------------------------------------------------------------- Recurrentes

A.openRuleEditor = () => openSheet('rule', {});
A.openRule = (d) => openSheet('rule', { id: d.id });
A.ruleFromSuggestion = (d) => openSheet('rule', { sug: L.suggestions()[Number(d.i)] });
SHEETS.rule = {
  init: ({ id, sug }) => {
    const r = id && state.rules.find((x) => x.id === id);
    if (r) return { title: r.title, amount: r.amount, kind: r.kind, catId: r.catId, freq: r.freq, start: toInputDate(new Date(r.start)), auto: r.auto, active: r.active };
    if (sug) {
      const next = M.occurrence(sug.freq, 1, sug.last);
      return { title: sug.title, amount: sug.amount, kind: 'expense', catId: sug.catId, freq: sug.freq, start: toInputDate(next), auto: true, active: true };
    }
    return { title: '', amount: 0, kind: 'expense', catId: '', freq: 'monthly', start: toInputDate(new Date()), auto: true, active: true };
  },
  html: (sh) => {
    const st = sh.st; const edit = !!sh.props.id;
    return `${head(edit ? 'Editar recurrente' : 'Nuevo recurrente', '<button class="link bold" data-act="saveRule">Guardar</button>')}
    <div class="sh-body">
      <div class="seg">${['expense', 'income'].map((k) => `<button class="${st.kind === k ? 'on' : ''}" data-act="ruleKind" data-k="${k}">${k === 'expense' ? 'Gasto' : 'Ingreso'}</button>`).join('')}</div>
      <section class="card form">
        <label class="frow"><input placeholder="Nombre (ej: Arriendo, Netflix)" value="${esc(st.title)}" data-in="field" data-f="title"></label>
        <label class="frow"><span class="grow">Monto</span>${amountInput('amount', st.amount, cur(), 'inline-amount')}</label>
        <label class="frow"><span class="grow">Categoría</span><select data-ch="field" data-f="catId"><option value="">Sin categoría</option>
          ${L.activeCats(st.kind).map((c) => `<option value="${c.id}" ${c.id === st.catId ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select></label></section>
      <section class="card form">
        <label class="frow"><span class="grow">Frecuencia</span><select data-ch="field" data-f="freq">${Object.entries(M.FREQUENCIES).map(([k, f]) => `<option value="${k}" ${k === st.freq ? 'selected' : ''}>${f.title}</option>`).join('')}</select></label>
        <label class="frow"><span class="grow">${edit ? 'Desde' : 'Primer pago'}</span><input type="date" value="${st.start}" data-ch="field" data-in="field" data-f="start"></label></section>
      <section class="card form">
        <label class="frow"><span class="grow">Registrar automáticamente</span><input type="checkbox" class="switch" ${st.auto ? 'checked' : ''} data-ch="field" data-f="auto"></label>
        ${edit ? `<label class="frow"><span class="grow">Activo</span><input type="checkbox" class="switch" ${st.active ? 'checked' : ''} data-ch="field" data-f="active"></label>` : ''}</section>
      <p class="foot-note">${st.auto ? 'Se anotará solo cada vez que toque. Ideal para arriendo, suscripciones o cuotas fijas.' : 'Quedará pendiente el día del pago para que lo confirmes (útil si el valor cambia, como los servicios).'}</p>
      ${edit ? '<button class="card danger-btn" data-act="deleteRule">Eliminar pago recurrente</button>' : ''}</div>`;
  },
  changed: (sh, f) => { if (f === 'auto') refreshSheet(sh); },
};
A.ruleKind = (d) => { const st = topSheet().st; st.kind = d.k; st.catId = ''; refreshSheet(); };
A.saveRule = () => {
  const sh = topSheet(); const st = sh.st;
  if (!st.title.trim() || !(st.amount > 0)) { toast('Ponle nombre y monto.', true); return; }
  const start = fromInputDate(st.start, new Date(new Date().setHours(9, 0, 0, 0)));
  if (sh.props.id) {
    const r = state.rules.find((x) => x.id === sh.props.id);
    const changed = r.freq !== st.freq || toInputDate(new Date(r.start)) !== st.start;
    Object.assign(r, { title: st.title.trim(), amount: st.amount, kind: st.kind, catId: st.catId || null, auto: st.auto, active: st.active });
    if (changed) {
      Object.assign(r, { freq: st.freq, start: start.toISOString(), count: 0 });
      const today = new Date(); today.setHours(0, 0, 0, 0);
      while (L.nextDate(r) < today) r.count++;
    }
  } else {
    state.rules.push({ id: uid(), title: st.title.trim(), amount: st.amount, kind: st.kind, catId: st.catId || null, freq: st.freq,
      start: start.toISOString(), count: 0, active: true, auto: st.auto });
  }
  const n = L.processRecurring();
  commit(n ? `Guardado · se registraron ${n} pagos` : 'Pago recurrente guardado');
  closeSheet();
};
A.deleteRule = () => {
  if (!confirm('¿Eliminar este pago recurrente? Los movimientos ya registrados se conservan.')) return;
  state.rules = state.rules.filter((r) => r.id !== topSheet().props.id);
  commit(); closeSheet();
};

A.openPending = () => openSheet('pending');
SHEETS.pending = {
  html: () => {
    const pend = L.pendingRules();
    return `${head('Pagos por revisar', pend.length > 1 ? '<button class="link bold" data-act="confirmAll">Registrar todos</button>' : '', '<button class="link" data-act="closeSheet">Cerrar</button>')}
    <div class="sh-body">${!pend.length ? `<div class="empty">${icon('check', 'big')}<b>Todo al día</b><small>No hay pagos por revisar.</small></div>` : ''}
      ${pend.map((r) => `<section class="card"><div class="row">${catIcon(L.catById(r.catId), 36)}<span class="grow"><b>${esc(r.title)}</b><small>${esc(dayLabel(L.nextDate(r)))}</small></span><b>${money(r.amount)}</b></div>
        <div class="two"><button class="primary sm" data-act="confirmRule" data-id="${r.id}">Registrar</button><button class="secondary sm" data-act="skipRule" data-id="${r.id}">Omitir</button></div></section>`).join('')}</div>`;
  },
};
A.confirmRule = (d) => { L.confirmRule(state.rules.find((r) => r.id === d.id)); commit('Registrado'); refreshSheet(); render(); };
A.skipRule = (d) => { state.rules.find((r) => r.id === d.id).count++; commit(); refreshSheet(); render(); };
A.confirmAll = () => { L.pendingRules().forEach((r) => L.confirmRule(r)); commit('Pagos registrados'); refreshSheet(); render(); };

// ---------------------------------------------------------------- Detalle de categoría (análisis)

A.openCatDetail = (d) => openSheet('catDetail', { id: d.id || null, off: Number(d.off) });
SHEETS.catDetail = {
  html: (sh) => {
    const p = M.shiftPeriod(L.currentPeriod(), sh.props.off);
    const c = L.catById(sh.props.id);
    const items = L.sortedMovements().filter((m) => M.inPeriod(p, L.md(m)) && (m.catId || null) === sh.props.id);
    const t = items.reduce((a, m) => a + m.main, 0);
    return `${head(c?.name || 'Sin categoría', done, '<span></span>')}<div class="sh-body">
      <section class="card"><div class="row">${catIcon(c, 44)}<span class="grow"><b>${esc(c?.name || 'Sin categoría')}</b><small>${items.length} movimientos · ${esc(M.periodTitle(p))}</small></span><b>${money(t)}</b></div></section>
      <section class="card list">${items.map((m) => movementRow(m, true)).join('')}</section></div>`;
  },
};

// ---------------------------------------------------------------- Ajustes

A.openSettings = () => openSheet('settings');
SHEETS.settings = {
  html: () => {
    const s = S();
    const last = s.lastBackup ? longDate(new Date(s.lastBackup)) : 'nunca';
    return `${head('Ajustes', done, '<span></span>')}<div class="sh-body">
      <small class="muted b pad-x">General</small>
      <section class="card form">
        <label class="frow"><span class="grow">Tu nombre</span><input class="right" placeholder="Opcional" value="${esc(s.name)}" data-in="setName"></label>
        <label class="frow"><span class="grow">Moneda principal</span><select data-ch="setCurrency">${M.CURRENCIES.map((c) => `<option value="${c}" ${c === s.currency ? 'selected' : ''}>${M.currencyFlag(c)} ${c}</option>`).join('')}</select></label>
        <label class="frow"><span class="grow">El mes empieza el día</span><select data-ch="setCycle">${Array.from({ length: 28 }, (_, i) => `<option ${i + 1 === s.cycleDay ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
        <label class="frow"><span class="grow">Apariencia</span><select data-ch="setTheme">${[['auto', 'Automática'], ['light', 'Clara'], ['dark', 'Oscura']].map(([k, l]) => `<option value="${k}" ${k === s.theme ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <button class="frow" data-act="openCategories"><span class="grow">Categorías</span>${icon('right', 'muted')}</button>
      </section>
      <small class="muted b pad-x">Privacidad</small>
      <section class="card form">
        <label class="frow"><span class="grow">Ocultar montos</span><input type="checkbox" class="switch" ${s.hide ? 'checked' : ''} data-ch="setHide"></label>
        <label class="frow"><span class="grow">Alertas de presupuesto</span><input type="checkbox" class="switch" ${s.alerts ? 'checked' : ''} data-ch="setAlerts"></label>
      </section>
      <p class="foot-note">Tus datos se guardan solo en este teléfono. Rinde no tiene servidores, no usa cuentas y no muestra publicidad.</p>
      <small class="muted b pad-x">Tus datos</small>
      <section class="card form">
        <button class="frow" data-act="exportCSV"><span class="grow">Exportar movimientos (CSV)</span>${icon('share', 'muted')}</button>
        <button class="frow" data-act="exportBackup"><span class="grow">Crear copia de seguridad<small class="muted block">Última: ${last}</small></span>${icon('download', 'muted')}</button>
        <label class="frow"><span class="grow">Restaurar desde una copia</span>${icon('upload', 'muted')}<input type="file" accept="application/json,.json" hidden data-ch="restore"></label>
        <button class="frow red" data-act="deleteAll"><span class="grow">Borrar todos mis datos</span></button>
      </section>
      <p class="foot-note">Como Rinde vive en este navegador, guarda una copia de seguridad de vez en cuando (en Archivos o iCloud Drive). Si borras los datos de Safari o cambias de iPhone, la necesitarás para recuperar todo.</p>
      <small class="muted b pad-x">Ayuda</small>
      <section class="card form">
        <button class="frow" data-act="openInstall"><span class="grow">Instalar en el iPhone</span>${icon('right', 'muted')}</button>
        <a class="frow" href="soporte.html" target="_blank"><span class="grow">Soporte y sugerencias</span>${icon('right', 'muted')}</a>
        <a class="frow" href="privacidad.html" target="_blank"><span class="grow">Política de privacidad</span>${icon('right', 'muted')}</a>
        <button class="frow" data-act="shareApp"><span class="grow">Recomendar a un amigo</span>${icon('share', 'muted')}</button>
      </section>
      <p class="center-text muted small">Rinde Web 1.0 · Hecho en Colombia 🇨🇴</p></div>`;
  },
};
IN.setName = (el) => { S().name = el.value.trim(); save(); };
CH.setCurrency = (el) => {
  if (state.movements.length && !confirm('Los montos que ya registraste no se convierten. ¿Cambiar la moneda principal?')) { el.value = S().currency; return; }
  S().currency = el.value; commit(); render();
};
CH.setCycle = (el) => { S().cycleDay = Number(el.value); commit(); render(); };
CH.setTheme = (el) => { S().theme = el.value; commit(); applyTheme(); };
CH.setHide = (el) => { S().hide = el.checked; commit(); render(); };
CH.setAlerts = (el) => { S().alerts = el.checked; commit(); };
A.exportCSV = () => shareFile(`Rinde-movimientos-${toInputDate(new Date())}.csv`, L.csv(), 'text/csv');
A.exportBackup = async () => {
  await shareFile(`Rinde-copia-${toInputDate(new Date())}.json`, L.backupJSON(), 'application/json');
  S().lastBackup = new Date().toISOString(); commit(); refreshSheet();
};
CH.restore = async (input) => {
  const file = input.files?.[0]; input.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'Rinde' || !Array.isArray(data.movements)) throw new Error('invalid');
    if (!confirm(`¿Restaurar la copia? Se reemplazarán los datos actuales por ${data.movements.length} movimientos.`)) return;
    const { app, version, exportedAt, ...rest } = data;
    replaceAll(rest);
    toast(`Listo: se restauraron ${data.movements.length} movimientos.`);
    closeSheet();
  } catch {
    toast('El archivo no es una copia de seguridad de Rinde.', true);
  }
};
A.deleteAll = () => {
  if (!confirm('¿Borrar todos tus datos? Te recomendamos crear una copia de seguridad antes. No se puede deshacer.')) return;
  resetAll(); toast('Se borraron tus datos.'); closeSheet();
};
A.shareApp = async () => {
  const data = { title: 'Rinde', text: 'Estoy usando Rinde para controlar mis gastos. Te la recomiendo:', url: location.href.split('#')[0] };
  try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(data.url); toast('Link copiado'); } } catch { /* cancelado */ }
};

A.openInstall = () => openSheet('install');
SHEETS.install = {
  html: () => `${head('Instalar en el iPhone', done, '<span></span>')}<div class="sh-body">
    <section class="card center-text">${logo(72)}<h3>Rinde como una app</h3><p class="muted">Con ícono en tu pantalla de inicio, a pantalla completa y funcionando sin internet.</p></section>
    <section class="card steps-list">
      <p><b>1.</b> Abre esta página en <b>Safari</b>.</p>
      <p><b>2.</b> Toca el botón <b>Compartir</b> ${icon('share', 'inline')} (abajo o arriba, según tu iPhone).</p>
      <p><b>3.</b> Desliza y toca <b>Agregar a pantalla de inicio</b>.</p>
      <p><b>4.</b> Toca <b>Agregar</b>. ¡Listo! Abre Rinde desde su ícono.</p></section>
    <p class="foot-note">En Android: menú ⋮ de Chrome → <b>Instalar app</b>.</p></div>`,
};

// ---------------------------------------------------------------- Categorías

A.openCategories = () => openSheet('categories');
SHEETS.categories = {
  html: () => {
    const sec = (kind, title) => `<small class="muted b pad-x">${title}</small><section class="card list">
      ${L.activeCats(kind).map((c) => `<button class="row" data-act="editCat" data-id="${c.id}">${catIcon(c, 32)}<b class="grow">${esc(c.name)}</b>${c.budget ? `<small class="muted">${money(c.budget)}</small>` : ''}${icon('right', 'muted')}</button>`).join('')}
      <button class="row link" data-act="newCat" data-k="${kind}">＋ Nueva categoría</button></section>`;
    const archived = state.categories.filter((c) => c.archived);
    return `${head('Categorías', done, '<span></span>')}<div class="sh-body">${sec('expense', 'Gastos')}${sec('income', 'Ingresos')}
      ${archived.length ? `<small class="muted b pad-x">Archivadas</small><section class="card list">${archived.map((c) => `<button class="row dim" data-act="editCat" data-id="${c.id}">${catIcon(c, 32)}<b class="grow">${esc(c.name)}</b></button>`).join('')}</section>` : ''}</div>`;
  },
};
A.editCat = (d) => openSheet('catEdit', { id: d.id });
A.newCat = (d) => openSheet('catEdit', { kind: d.k });
SHEETS.catEdit = {
  init: ({ id, kind }) => {
    const c = id && L.catById(id);
    return c ? { name: c.name, icon: c.icon, color: c.color, budget: c.budget, kind: c.kind }
      : { name: '', icon: '📦', color: COLORS[Math.floor(Math.random() * COLORS.length)], budget: 0, kind };
  },
  html: (sh) => {
    const st = sh.st; const c = sh.props.id && L.catById(sh.props.id);
    return `${head(c ? 'Editar categoría' : 'Nueva categoría', '<button class="link bold" data-act="saveCat">Guardar</button>')}<div class="sh-body">
      <section class="card form"><label class="frow">${catIcon(st, 48)}<input placeholder="Nombre" value="${esc(st.name)}" data-in="field" data-f="name"></label>
        ${st.kind === 'expense' ? `<label class="frow"><span class="grow">Presupuesto mensual</span>${amountInput('budget', st.budget, cur(), 'inline-amount')}</label>` : ''}</section>
      <small class="muted b pad-x">Ícono</small><section class="card"><div class="emoji-grid">${EMOJIS.map((e) => `<button class="${e === st.icon ? 'on' : ''}" data-act="catIcon" data-e="${e}">${e}</button>`).join('')}</div></section>
      <small class="muted b pad-x">Color</small><section class="card"><div class="color-grid">${COLORS.map((x) => `<button style="background:${x}" class="${x === st.color ? 'on' : ''}" data-act="catColor" data-c="${x}"></button>`).join('')}</div></section>
      ${c ? `<section class="card list"><button class="row link" data-act="archiveCat">${c.archived ? 'Reactivar categoría' : 'Archivar categoría'}</button>
        <button class="row red" data-act="deleteCat">Eliminar categoría</button></section>
        <p class="foot-note">Archivar la oculta sin tocar tus movimientos. Si la eliminas, sus movimientos quedan “Sin categoría”.</p>` : ''}</div>`;
  },
};
A.catIcon = (d) => { topSheet().st.icon = d.e; refreshSheet(); };
A.catColor = (d) => { topSheet().st.color = d.c; refreshSheet(); };
A.saveCat = () => {
  const sh = topSheet(); const st = sh.st;
  if (!st.name.trim()) { toast('Ponle un nombre.', true); return; }
  if (sh.props.id) Object.assign(L.catById(sh.props.id), { name: st.name.trim(), icon: st.icon, color: st.color, budget: st.budget || 0 });
  else state.categories.push({ id: uid(), name: st.name.trim(), icon: st.icon, color: st.color, kind: st.kind, key: '',
    order: Math.max(0, ...state.categories.map((c) => c.order)) + 1, budget: st.budget || 0, archived: false });
  commit('Categoría guardada'); closeSheet();
};
A.archiveCat = () => { const c = L.catById(topSheet().props.id); c.archived = !c.archived; commit(); closeSheet(); };
A.deleteCat = () => {
  if (!confirm('¿Eliminar la categoría?')) return;
  const id = topSheet().props.id;
  state.categories = state.categories.filter((c) => c.id !== id);
  state.movements.forEach((m) => { if (m.catId === id) m.catId = null; });
  for (const [k, v] of Object.entries(state.learned)) if (v === id) delete state.learned[k];
  commit(); closeSheet();
};

A.openData = () => openSheet('settings');

boot();
