// Rinde · control de gastos (versión web instalable). Diseño monocromo.
import { state, save, uid, replaceAll, resetAll, askPersistence } from './store.js';
import * as L from './logic.js';
import * as M from './money.js';
import * as C from './charts.js';
import * as P from './parser.js';
import { $, $$, esc, cur, money, compactMoney, icon, glyph, catIcon, CAT_ICONS, toInputDate, fromInputDate, dayLabel, shortDate, longDate, toast, shareFile } from './ui.js';

const S = () => state.settings;
const ui = {
  tab: 'home', sheets: [], mvOffset: 0, anOffset: 0,
  filter: { kind: null, cat: null, tag: null, q: '' },
  anKind: 'expense', evoCat: null, plans: 'budgets', onb: { step: 0, q: '' },
};
const A = {};   // botones (data-act)
const IN = {};  // al escribir (data-in)
const CH = {};  // al cambiar (data-ch)

const GOAL_ICONS = ['star', 'palm', 'plane', 'home', 'car', 'laptop', 'phone', 'cap', 'heart', 'gift', 'shield', 'bank', 'trend', 'bike', 'umbrella', 'smile', 'music', 'key'];

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
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (S().theme === 'auto') render(); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  askPersistence();
}

const isLight = () => S().theme === 'light' || (S().theme === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
function applyTheme() {
  const light = isLight();
  document.documentElement.classList.toggle('light', light);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#FAFAF8' : '#000000');
}

// Escala de grises para las gráficas: el color queda solo para ingresos y gastos.
const GRAYS_D = ['#F4F4F2', '#B8B8B5', '#8A8A8D', '#66666A', '#4A4A4E', '#37373B', '#2A2A2E'];
const GRAYS_L = ['#0B0B0C', '#3C3C3F', '#66666A', '#8E8E92', '#B1B1B4', '#CDCDCF', '#E0E0E2'];
const shade = (i) => (isLight() ? GRAYS_L : GRAYS_D)[Math.min(i, 6)];

function commit(msg, warn = false) {
  save();
  if (msg) toast(msg, warn ? 'warn' : 'ok');
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
  const t = (id, label, ic) => `<button class="tab ${ui.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">${icon(ic)}<span>${label}</span><i></i></button>`;
  return `${t('home', 'Inicio', 'home')}${t('movements', 'Movimientos', 'list')}
    <button class="tab add" data-act="tab" data-tab="add" aria-label="Registrar movimiento"><span class="fab">${icon('plus')}</span></button>
    ${t('analysis', 'Análisis', 'chart')}${t('plans', 'Planes', 'target')}`;
}

// ================================================================ Bienvenida

function viewOnboarding() {
  const st = ui.onb;
  const progress = `<div class="progress">${[0, 1, 2].map((i) => `<i class="${i <= st.step ? 'on' : ''}"></i>`).join('')}</div>`;
  const top = `<div class="onb-top"><span class="wordmark">Rinde</span>${progress}</div>`;
  if (st.step === 0) {
    return `<div class="onb fade-in">${top}
      <h1>Que tu plata<br><em>rinda.</em></h1>
      <p class="lead">Registra tus gastos escribiendo como en un chat. Sin bancos, sin cuentas y totalmente privado.</p>
      <ol class="points">
        <li><span>01</span><div><b>Escribe “almuerzo 18 mil”</b><small>Entiende el monto, la categoría y la fecha.</small></div></li>
        <li><span>02</span><div><b>Sabe cuánto puedes gastar hoy</b><small>Presupuestos, metas de ahorro y pagos fijos.</small></div></li>
        <li><span>03</span><div><b>Tus datos no salen del teléfono</b><small>Sin servidores ni publicidad. Funciona sin internet.</small></div></li>
      </ol>
      <button class="btn primary" data-act="onbNext">Comenzar</button></div>`;
  }
  if (st.step === 1) {
    return `<div class="onb fade-in">${top}
      <h2>¿En qué moneda manejas tu plata?</h2>
      <label class="search mt">${icon('search', 'sm')}<input placeholder="Buscar moneda" value="${esc(st.q)}" data-in="onbSearch"></label>
      <div class="scroll-list" id="onbList">${currencyRows(filterCurrencies(st.q))}</div>
      <button class="btn primary" data-act="onbNext" id="onbCont">Continuar con ${esc(S().currency)}</button></div>`;
  }
  return `<div class="onb fade-in">${top}
    <h2>Últimos detalles</h2>
    <label class="uline"><span class="label">Tu nombre</span><input placeholder="Opcional" value="${esc(S().name)}" data-in="onbName" autocomplete="given-name"></label>
    <div class="uline"><span class="label">¿Cuánto quieres gastar al mes?</span>
      <div class="uline money"><span>${esc(M.symbol(cur()))}</span><input inputmode="decimal" placeholder="0" data-in="onbBudget"
        value="${S().budget ? M.groupDigits(M.rawFromValue(S().budget, cur())) : ''}"></div></div>
    <p class="form-note mt">Con esto calculamos cuánto puedes gastar cada día. Puedes cambiarlo cuando quieras.</p>
    <div style="flex:1"></div>
    <button class="btn primary" data-act="onbFinish">Entrar a Rinde</button></div>`;
}
const filterCurrencies = (q) => { const k = P.key(q || ''); return M.CURRENCIES.filter((c) => !k || P.key(`${c} ${M.currencyName(c)}`).includes(k)); };
const currencyRows = (list) => list.map((c) => `<button class="item" data-act="onbCurrency" data-code="${c}">
  <span class="code">${c}</span><span class="grow"><span class="t">${esc(M.currencyName(c))}</span></span>
  ${c === S().currency ? `<span class="check">${icon('check')}</span>` : ''}</button>`).join('');

A.onbNext = () => { ui.onb.step++; render(); scrollTo(0, 0); };
A.onbCurrency = (d) => { S().currency = d.code; $('#onbList').innerHTML = currencyRows(filterCurrencies(ui.onb.q)); $('#onbCont').textContent = `Continuar con ${d.code}`; };
IN.onbSearch = (el) => { ui.onb.q = el.value; $('#onbList').innerHTML = currencyRows(filterCurrencies(el.value)); };
IN.onbName = (el) => { S().name = el.value.trim(); };
IN.onbBudget = (el) => { const raw = M.sanitizeAmount(el.value, cur()); el.value = M.groupDigits(raw); S().budget = M.amountValue(raw); };
A.onbFinish = () => { S().onboarded = true; commit(); render(); };

// ================================================================ Piezas comunes

function movementRow(m, showDate = false) {
  const c = L.catById(m.catId);
  const title = m.note || c?.name || (m.kind === 'expense' ? 'Gasto' : 'Ingreso');
  const parts = [];
  if (m.note && c) parts.push(c.name);
  if (showDate) parts.push(shortDate(L.md(m)));
  if (m.source === 'recurring') parts.push('Fijo');
  const tags = (m.tags || []).length ? ` <em>${esc(m.tags.map((t) => '#' + t).join(' '))}</em>` : '';
  const sign = m.kind === 'expense' ? -1 : 1;
  return `<button class="item" data-act="editMovement" data-id="${m.id}">${catIcon(c, 40)}
    <span class="grow"><span class="t">${esc(title)}</span><span class="s">${esc(parts.join(' · ') || (m.kind === 'expense' ? 'Gasto' : 'Ingreso'))}${tags}</span></span>
    <span class="amt"><span class="amt-v"><span class="dot ${m.kind === 'expense' ? 'neg' : 'pos'}"></span>${money(sign * m.main, { signed: true })}</span>
    ${m.currency !== cur() ? `<small>${money(m.amount, { code: m.currency })}</small>` : ''}</span></button>`;
}

const meter = (pr) => `<div class="meter"><i class="${pr >= 1 ? 'warn' : ''}" style="width:${Math.min(Math.max(pr, 0), 1) * 100}%"></i></div>`;

function budgetRow(c, spent) {
  const pr = c.budget > 0 ? spent / c.budget : 0;
  const warn = pr >= 1 ? `Te pasaste por ${money(spent - c.budget)}` : pr >= 0.8 ? `Llevas el ${Math.round(pr * 100)}%` : '';
  return `<button class="budget" data-act="openCatBudget" data-id="${c.id}">
    <div class="budget-top">${catIcon(c, 34)}<span class="t grow">${esc(c.name)}</span><small><b>${money(spent)}</b> / ${money(c.budget)}</small></div>
    ${meter(pr)}${warn ? `<div class="warn-text"><span class="dot neg"></span>${warn}</div>` : ''}</button>`;
}
const spentIn = (ms, catId) => ms.reduce((a, m) => (m.kind === 'expense' && m.catId === catId ? a + m.main : a), 0);

const goalSaved = (g) => g.contribs.reduce((a, c) => a + c.amount, 0);
const goalProgress = (g) => (g.target > 0 ? Math.min(goalSaved(g) / g.target, 1) : 0);
function goalMonthly(g) {
  if (!g.deadline) return null;
  const rem = g.target - goalSaved(g);
  if (rem <= 0) return null;
  const d = new Date(g.deadline); const n = new Date();
  return rem / Math.max((d.getFullYear() - n.getFullYear()) * 12 + d.getMonth() - n.getMonth(), 1);
}
function ring(pr, iconName, size = 52) {
  const r = size / 2 - 2; const c = 2 * Math.PI * r; const h = size / 2;
  return `<span class="ring" style="width:${size}px;height:${size}px"><svg class="r" viewBox="0 0 ${size} ${size}">
    <circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="var(--line-2)" stroke-width="1.5"/>
    <circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-linecap="round"
      stroke-dasharray="${(c * pr).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${h} ${h})"/></svg>
    <span style="width:${Math.round(size * 0.4)}px;height:${Math.round(size * 0.4)}px;display:grid;place-items:center">${glyph(iconName)}</span></span>`;
}
function goalRow(g) {
  const mo = goalMonthly(g);
  const reached = goalSaved(g) >= g.target;
  return `<button class="goal" data-act="openGoal" data-id="${g.id}">${ring(goalProgress(g), g.icon, 54)}
    <span class="grow"><span class="t" style="display:block;font-weight:500">${esc(g.name)}</span>
      <span class="pct">${money(goalSaved(g))} de ${money(g.target)}</span>
      ${reached ? '<span class="warn-text" style="color:var(--pos)"><span class="dot pos"></span>Meta cumplida</span>'
        : mo ? `<span class="pct" style="display:block">${money(mo)} al mes · ${longDate(new Date(g.deadline))}</span>` : ''}</span>
    <span class="pctv">${Math.round(goalProgress(g) * 100)}%</span></button>`;
}

function periodNav(offset, act) {
  const p = M.shiftPeriod(L.currentPeriod(), offset);
  return `<div class="pnav"><button class="circle-btn sm" data-act="${act}" data-d="-1" aria-label="Periodo anterior">${icon('left', 'sm')}</button>
    <div><div class="t">${esc(M.periodTitle(p))}</div>${offset ? `<button class="today" data-act="${act}" data-d="0">Volver a hoy</button>` : ''}</div>
    <button class="circle-btn sm" data-act="${act}" data-d="1" ${offset >= 0 ? 'disabled' : ''} aria-label="Periodo siguiente">${icon('right', 'sm')}</button></div>`;
}

function stats(items) {
  const texts = items.map(([, v]) => money(v));
  const n = Math.max(...texts.map((t) => t.length));
  const cls = n > 12 ? 'xl' : n > 9 ? 'long' : '';
  return `<div class="stats">${items.map(([label, , dot], i) =>
    `<div class="stat"><span class="label">${dot ? `<span class="dot ${dot}"></span>` : ''}${label}</span><b class="${cls}">${texts[i]}</b></div>`).join('')}</div>`;
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
  return `<div class="fade-in">
    <header class="bar"><span class="wordmark">Rinde</span><div class="bar-actions">
      <button class="circle-btn" data-act="toggleHide" aria-label="${S().hide ? 'Mostrar montos' : 'Ocultar montos'}">${icon(S().hide ? 'eyeOff' : 'eye', 'sm')}</button>
      <button class="circle-btn" data-act="openSettings" aria-label="Ajustes">${icon('settings', 'sm')}</button></div></header>
    <p class="hello">${esc(name ? `${greet}, ${name}.` : `${greet}.`)} ${esc(M.periodTitle(s.p))}</p>
    ${!standalone && !S().installDismissed ? `<div class="notice">${icon('install')}<div><b>Instala Rinde en tu iPhone</b>
      <p>En Safari toca Compartir ${icon('share', 'sm')} y luego “Agregar a pantalla de inicio”.</p></div>
      <button class="close" data-act="dismissInstall" aria-label="Cerrar">${icon('x', 'sm')}</button></div>` : ''}
    ${hero(s)}
    <button class="command" data-act="openAdd"><span class="plus">${icon('plus')}</span><span class="grow">Anota algo… “almuerzo 18 mil”</span></button>
    ${stats([['Gastos', s.spent, 'neg'], ['Ingresos', s.income, 'pos'], ['Hoy', s.today, null]])}
    ${pending.length ? `<button class="notice mt" data-act="openPending">${icon('clock')}<div class="grow"><b>${pending.length === 1 ? '1 pago por revisar' : `${pending.length} pagos por revisar`}</b>
      <p>${esc(pending.slice(0, 3).map((r) => r.title).join(', '))}</p></div>${icon('right', 'sm')}</button>` : ''}
    ${!state.movements.length ? welcome() : `
      ${s.spent > 0 ? distribution(ms) : ''}
      ${budgetWatch(ms)}
      ${goalsPreview()}
      <section class="block"><div class="block-h"><span class="label">Recientes</span><button class="link" data-act="tab" data-tab="movements">Ver todo ${icon('arrow')}</button></div>
        <div class="rows">${recent.map((m) => movementRow(m, true)).join('')}</div></section>
      ${backupReminder()}`}
  </div>`;
}

function hero(s) {
  const mode = S().safeMode || 0;
  const hasModes = (s.hasBudget || s.income > 0) && !s.isOver;
  let value = s.remaining; let label;
  if (s.isOver) label = 'Excedido';
  else if (!s.hasBudget) label = s.income > 0 ? 'Disponible' : 'Balance del mes';
  else label = ['Disponible hoy', 'Disponible esta semana', 'Disponible en el mes'][mode];
  if (hasModes) value = mode === 0 ? s.dayBudget - s.today : mode === 1 ? Math.min(s.perDay * 7, Math.max(s.remaining, 0)) : s.remaining;
  const days = s.days === 1 ? 'último día del periodo' : `${s.days} días restantes`;
  let sub;
  if (s.isOver) sub = `Vas ${money(-s.remaining)} por encima de tu presupuesto · ${days}`;
  else if (!s.hasBudget && s.income <= 0) sub = 'Define un presupuesto o registra tus ingresos para saber cuánto puedes gastar.';
  else if (s.hasBudget && mode === 0) sub = `Cupo diario ${money(s.dayBudget)} · ${days}`;
  else sub = `≈ ${money(s.perDay)} por día · ${days}`;
  const red = s.isOver || value < 0;
  return `<section class="hero">
    <div class="hero-top"><span class="label">${label}</span>
      ${hasModes ? `<div class="switch-text">${['Hoy', 'Semana', 'Mes'].map((l, i) => `<button class="${i === mode ? 'on' : ''}" data-act="safeMode" data-mode="${i}">${l}</button>`).join('')}</div>` : ''}</div>
    <div class="hero-amount ${red ? 'neg' : ''}">${money(s.isOver ? -value : value)}</div>
    <p class="hero-sub">${sub}</p>
    ${s.hasBudget ? `${meter(s.progress)}<div class="meter-legend"><span>Gastado <b>${money(s.spent)}</b></span><span>de <b>${money(s.budget)}</b></span></div>`
      : `<button class="ghost-btn" data-act="openBudget">${icon('plus', 'sm')} Definir presupuesto mensual</button>`}
  </section>`;
}

function welcome() {
  const ex = ['almuerzo 18 mil', 'uber 12.500 ayer', 'me pagaron 2 millones', 'mercado 120 mil #casa'];
  return `<section class="block"><span class="label">Primer paso</span>
    <p class="serif" style="font-size:30px;line-height:1.12;margin:14px 0 8px">Escríbelo como se lo dirías a un amigo.</p>
    <p class="dim" style="font-size:14.5px">Rinde entiende el monto, la categoría y la fecha. Prueba con uno:</p>
    <div class="chips wrap">${ex.map((t) => `<button class="chip" data-act="openAdd" data-prefill="${esc(t)}">“${esc(t)}”</button>`).join('')}</div></section>`;
}

function distribution(ms) {
  const sl = L.byCategory(ms);
  const t = sl.reduce((a, x) => a + x.total, 0);
  return `<section class="block"><div class="block-h"><span class="label">Distribución</span><button class="link" data-act="tab" data-tab="analysis">Análisis ${icon('arrow')}</button></div>
    <div class="dist">${C.donut(sl.map((x, i) => ({ value: x.total, color: shade(i) })), { size: 124, center: compactMoney(t) })}
    <ul class="legend">${sl.slice(0, 5).map((x, i) => `<li><span class="swatch" style="background:${shade(i)}"></span><span>${esc(x.name)}</span><small>${Math.round((x.total / t) * 100)}%</small></li>`).join('')}</ul></div></section>`;
}

function budgetWatch(ms) {
  const rows = L.activeCats('expense').filter((c) => c.budget > 0)
    .map((c) => ({ c, spent: spentIn(ms, c.id) })).sort((a, b) => b.spent / b.c.budget - a.spent / a.c.budget);
  if (!rows.length) return '';
  return `<section class="block"><div class="block-h"><span class="label">Presupuestos</span><button class="link" data-act="goPlans" data-p="budgets">Ver todo ${icon('arrow')}</button></div>
    ${rows.slice(0, 3).map((r) => budgetRow(r.c, r.spent)).join('')}</section>`;
}

function goalsPreview() {
  const gs = state.goals.filter((g) => !g.archived).slice(0, 2);
  if (!gs.length) return '';
  return `<section class="block"><div class="block-h"><span class="label">Metas</span><button class="link" data-act="goPlans" data-p="goals">Ver todo ${icon('arrow')}</button></div>
    ${gs.map(goalRow).join('')}</section>`;
}

function backupReminder() {
  const last = S().lastBackup ? new Date(S().lastBackup) : null;
  if (state.movements.length < 15 || (last && Date.now() - last < 30 * 864e5)) return '';
  return `<button class="notice mt" data-act="openSettings">${icon('download')}<div class="grow"><b>Haz una copia de seguridad</b>
    <p>Tus datos viven solo en este teléfono. Guárdalos en Archivos o iCloud.</p></div>${icon('right', 'sm')}</button>`;
}

A.toggleHide = () => { S().hide = !S().hide; commit(); render(); };
A.safeMode = (d) => { S().safeMode = Number(d.mode); commit(); render(); };
A.dismissInstall = () => { S().installDismissed = true; commit(); render(); };
A.goPlans = (d) => { ui.plans = d.p; ui.tab = 'plans'; render(); scrollTo(0, 0); };

// ================================================================ Movimientos

function filteredMovements() {
  const f = ui.filter;
  const q = P.key(f.q);
  const p = M.shiftPeriod(L.currentPeriod(), ui.mvOffset);
  return L.sortedMovements().filter((m) => {
    if (!q && !M.inPeriod(p, L.md(m))) return false;
    if (f.kind && m.kind !== f.kind) return false;
    if (f.cat && m.catId !== f.cat) return false;
    if (f.tag && !(m.tags || []).includes(f.tag)) return false;
    if (q) return P.key(`${m.note} ${L.catById(m.catId)?.name ?? ''} ${(m.tags || []).join(' ')} ${m.amount}`).includes(q);
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
  return `${stats([['Gastos', spent, 'neg'], ['Ingresos', income, 'pos'], ['Balance', income - spent, null]])}
    ${!ms.length ? `<div class="empty">${icon(ui.filter.q ? 'search' : 'list')}<p class="serif">${ui.filter.q ? 'Sin resultados' : 'Nada por aquí'}</p>
      <p>${ui.filter.q ? 'Prueba con otra palabra.' : 'Toca + para anotar tu primer movimiento del periodo.'}</p></div>` : ''}
    ${[...groups.entries()].map(([k, items]) => {
      const dt = items.reduce((a, m) => a + (m.kind === 'expense' ? -m.main : m.main), 0);
      return `<div class="day-h"><span class="label">${esc(dayLabel(new Date(Number(k))))}</span><span>${money(dt, { signed: true })}</span></div>
        <div class="rows">${items.map((m) => movementRow(m)).join('')}</div>`;
    }).join('')}`;
}

function viewMovements() {
  const f = ui.filter;
  const tags = [...new Set(state.movements.flatMap((m) => m.tags || []))].sort();
  const chip = (label, on, extra) => `<button class="chip ${on ? 'on' : ''}" data-act="mvFilter" ${extra}>${label}</button>`;
  return `<div class="fade-in"><h1 class="page-title">Movimientos</h1>
    <label class="search">${icon('search', 'sm')}<input type="search" placeholder="Buscar nota, categoría o #etiqueta" value="${esc(f.q)}" data-in="mvSearch"></label>
    ${f.q ? '' : periodNav(ui.mvOffset, 'mvPeriod')}
    <div class="chips">
      ${chip('Todo', !f.kind && !f.cat && !f.tag, 'data-k="all"')}
      ${chip('Gastos', f.kind === 'expense', 'data-k="expense"')}
      ${chip('Ingresos', f.kind === 'income', 'data-k="income"')}
      <select class="chip ${f.cat ? 'on' : ''}" data-ch="mvCat" aria-label="Categoría"><option value="">Categoría</option>${L.activeCats().map((c) => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      ${tags.length ? `<select class="chip ${f.tag ? 'on' : ''}" data-ch="mvTag" aria-label="Etiqueta"><option value="">Etiqueta</option>${tags.map((t) => `<option value="${esc(t)}" ${f.tag === t ? 'selected' : ''}>#${esc(t)}</option>`).join('')}</select>` : ''}
    </div>
    <div id="mvList">${movementsList()}</div></div>`;
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
  const evo = L.periodTotals(state.movements.filter((m) => m.catId === evoId), p, 6);
  const tags = L.tagTotals(ms);
  const axis = (v) => (S().hide ? '•' : M.compact(v, cur()));
  return `<div class="fade-in"><h1 class="page-title">Análisis</h1>
    ${periodNav(ui.anOffset, 'anPeriod')}
    <section class="block" style="padding-top:4px">
      <div class="between"><span class="label">Gastaste</span>
        ${change != null ? `<span class="delta"><span class="dot ${change > 0 ? 'neg' : 'pos'}"></span>${change > 0 ? '+' : ''}${Math.round(change * 100)}% vs. anterior</span>` : ''}</div>
      <div class="kpi mt-s">${money(spent)}</div>
      <div class="kpi-row"><div><span class="label" style="display:flex;gap:7px;align-items:center"><span class="dot pos"></span>Ingresos</span><b>${money(income)}</b></div>
        <div style="text-align:right"><span class="label" style="display:flex;justify-content:flex-end">${saving >= 0 ? 'Ahorro' : 'Déficit'}</span><b class="${saving >= 0 ? 'pos' : 'neg'}">${money(saving)}</b></div></div>
      ${income > 0 ? `<p class="hero-sub mt">${saving >= 0 ? `Ahorraste el ${Math.round((saving / income) * 100)}% de tus ingresos.` : 'Gastaste más de lo que ganaste este periodo.'}</p>` : ''}
    </section>
    <section class="block"><div class="block-h"><span class="label">Por categoría</span>
      <div class="switch-text">${['expense', 'income'].map((k) => `<button class="${ui.anKind === k ? 'on' : ''}" data-act="anKind" data-k="${k}">${k === 'expense' ? 'Gastos' : 'Ingresos'}</button>`).join('')}</div></div>
      ${!slices.length ? `<div class="empty">${icon('chart')}<p class="serif">Sin datos</p><p>No hay ${ui.anKind === 'expense' ? 'gastos' : 'ingresos'} en este periodo.</p></div>` : `
      <div style="display:flex;justify-content:center;margin:6px 0 18px">${C.donut(slices.map((x, i) => ({ value: x.total, color: shade(i) })), { size: 200, center: compactMoney(sliceTotal) })}</div>
      ${slices.map((x, i) => `<button class="slice" data-act="openCatDetail" data-id="${x.id ?? ''}" data-off="${ui.anOffset}">${catIcon(x, 38)}
        <span class="grow"><span class="between"><span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.name)}</span><span class="num">${money(x.total)}</span></span>
        <span class="between" style="gap:10px"><span class="slice-meter grow"><i style="width:${(x.total / sliceTotal) * 100}%;background:${shade(i)}"></i></span><span class="pct">${Math.round((x.total / sliceTotal) * 100)}%</span></span></span></button>`).join('')}`}
    </section>
    <section class="block"><span class="label">Últimos 6 periodos</span>
      <div class="mt">${C.bars(trend.map((t) => ({ label: M.periodShort(t.p), values: [t.spent, t.income] })), ['var(--neg)', 'var(--pos)'], axis)}</div>
      <div class="legend-inline"><span><span class="dot neg"></span>Gastos</span><span><span class="dot pos"></span>Ingresos</span></div></section>
    <section class="block"><div class="between"><span class="label">Gasto por día</span><span class="pct">Promedio ${money(avg)}</span></div>
      <div class="mt">${C.daily(days.map((d) => d.total), days.map((d, i) => (i % 7 === 0 ? String(d.day.getDate()) : '')), avg, axis, 'var(--ink-3)')}</div></section>
    <section class="block"><div class="between"><span class="label">Evolución</span>
      <select class="chip sm" data-ch="evoCat" aria-label="Categoría">${expCats.map((c) => `<option value="${c.id}" ${c.id === evoId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="mt">${C.line(evo.map((t) => ({ label: M.periodShort(t.p), value: t.spent })), 'var(--ink)', axis)}</div>
      ${evo[0].spent > 0 ? `<p class="hero-sub mt">${evo[5].spent >= evo[0].spent ? `Subió ${Math.round(((evo[5].spent - evo[0].spent) / evo[0].spent) * 100)}%` : `Bajó ${Math.round(((evo[0].spent - evo[5].spent) / evo[0].spent) * 100)}%`} en 6 periodos.</p>` : ''}</section>
    ${tags.length ? `<section class="block"><span class="label">Etiquetas</span><div class="rows mt">${tags.slice(0, 8).map((t) => `<div class="between" style="padding:12px 0"><span>#${esc(t.tag)} <span class="pct">· ${t.count}</span></span><span class="num">${money(t.total)}</span></div>`).join('')}</div></section>` : ''}
  </div>`;
}
A.anPeriod = (d) => { ui.anOffset = d.d === '0' ? 0 : Math.min(ui.anOffset + Number(d.d), 0); render(); };
A.anKind = (d) => { ui.anKind = d.k; render(); };
CH.evoCat = (el) => { ui.evoCat = el.value; render(); };

// ================================================================ Planes

function viewPlans() {
  const tabs = [['budgets', 'Presupuestos'], ['goals', 'Metas'], ['recurring', 'Pagos fijos']]
    .map(([k, l]) => `<button class="${ui.plans === k ? 'on' : ''}" data-act="plansSeg" data-k="${k}">${l}</button>`).join('');
  const body = ui.plans === 'budgets' ? plansBudgets() : ui.plans === 'goals' ? plansGoals() : plansRecurring();
  return `<div class="fade-in"><h1 class="page-title">Planes</h1><div class="tabs-line">${tabs}</div>${body}</div>`;
}
A.plansSeg = (d) => { ui.plans = d.k; render(); };

function plansBudgets() {
  const s = L.safeToSpend();
  const ms = L.inPeriod(state.movements, s.p);
  const withBudget = L.activeCats('expense').filter((c) => c.budget > 0);
  return `<button class="block" style="width:100%;text-align:left" data-act="openBudget">
      <div class="block-h"><span class="label">Presupuesto del mes</span>${icon('pencil', 'sm')}</div>
      ${s.hasBudget ? `<div class="kpi">${money(s.spent)}</div><p class="hero-sub mt-s">de ${money(s.budget)}</p>${meter(s.progress)}
        <p class="pct" style="padding-bottom:18px;${s.isOver ? 'color:var(--neg)' : ''}">${s.isOver ? `Te pasaste por ${money(-s.remaining)}.` : `Te quedan ${money(s.remaining)} · ≈ ${money(s.perDay)} por día.`}${!S().budget ? ' Suma de los presupuestos por categoría.' : ''}</p>`
      : '<p class="hero-sub" style="padding-bottom:18px">Define cuánto quieres gastar al mes y Rinde te dirá cuánto puedes gastar cada día.</p>'}</button>
    <section class="block"><div class="block-h"><span class="label">Por categoría</span><button class="link" data-act="pickCatBudget">${icon('plus')} Agregar</button></div>
      ${withBudget.length ? withBudget.map((c) => budgetRow(c, spentIn(ms, c.id))).join('')
        : '<p class="hero-sub" style="padding-bottom:20px">Pon un límite a las categorías donde más gastas y recibe avisos al 80% y al 100%.</p>'}</section>`;
}

function plansGoals() {
  const gs = state.goals.filter((g) => !g.archived);
  return `${!gs.length ? `<div class="empty">${icon('star')}<p class="serif">Ahorra para lo que quieres</p><p>Un viaje, un celular, el fondo de emergencia. Crea una meta y ve sumando.</p></div>` : `<div>${gs.map(goalRow).join('')}</div>`}
    <button class="btn outline mt" data-act="openGoalEditor">${icon('plus', 'sm')} Nueva meta</button>`;
}

function plansRecurring() {
  const active = state.rules.filter((r) => r.active); const paused = state.rules.filter((r) => !r.active);
  const monthly = active.filter((r) => r.kind === 'expense').reduce((a, r) => a + r.amount * (M.FREQUENCIES[r.freq]?.perMonth ?? 1), 0);
  const sug = L.suggestions(); const pend = L.pendingRules();
  const list = (title, rs) => `<section class="block"><span class="label">${title}</span><div class="rows mt-s">${rs.map((r) => `<button class="item" data-act="openRule" data-id="${r.id}">
      ${catIcon(L.catById(r.catId), 40)}<span class="grow"><span class="t">${esc(r.title)}</span><span class="s">${M.FREQUENCIES[r.freq]?.title} · ${r.active ? `próximo ${shortDate(L.nextDate(r))}` : 'en pausa'}${r.auto ? '' : ' · con aviso'}</span></span>
      <span class="amt"><span class="amt-v"><span class="dot ${r.kind === 'expense' ? 'neg' : 'pos'}"></span>${money(r.amount)}</span></span></button>`).join('')}</div></section>`;
  return `<section class="block" style="padding-top:20px"><span class="label">Pagos fijos al mes</span><div class="kpi mt-s">${money(monthly)}</div>
      <p class="hero-sub mt-s" style="padding-bottom:18px">Arriendo, servicios, suscripciones y cuotas. Se registran solos o quedan pendientes para que los confirmes.</p></section>
    ${pend.length ? `<button class="notice mt" data-act="openPending">${icon('clock')}<div class="grow"><b>${pend.length} por revisar</b><p>Confírmalos u omítelos.</p></div>${icon('right', 'sm')}</button>` : ''}
    ${sug.length ? `<section class="block"><span class="label">Detectamos pagos que se repiten</span><div class="rows mt-s">${sug.slice(0, 4).map((s, i) => `<div class="item">
      <span class="grow"><span class="t">${esc(s.title)}</span><span class="s">${M.FREQUENCIES[s.freq].title} · ${s.count} veces · ${money(s.amount)}</span></span>
      <button class="mini" data-act="ruleFromSuggestion" data-i="${i}">Crear</button></div>`).join('')}</div></section>` : ''}
    ${active.length ? list('Activos', active) : ''}${paused.length ? list('En pausa', paused) : ''}
    ${!state.rules.length && !sug.length ? `<div class="empty">${icon('clock')}<p class="serif">Sin pagos fijos</p><p>Agrega tu arriendo, servicios o suscripciones.</p></div>` : ''}
    <button class="btn outline mt" data-act="openRuleEditor">${icon('plus', 'sm')} Nuevo pago fijo</button>`;
}

const VIEWS = { home: viewHome, movements: viewMovements, analysis: viewAnalysis, plans: viewPlans };

// ================================================================ Hojas

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
  const scroll = el.querySelector('.sh-body')?.scrollTop ?? 0;
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
  setTimeout(() => el.remove(), 320);
  if (!ui.sheets.length) document.body.classList.remove('noscroll');
  else refreshSheet(topSheet());
  render();
}
A.closeSheet = () => closeSheet();

const head = (title, right = '', left = '<button class="sh-btn" data-act="closeSheet">Cancelar</button>') =>
  `<header class="sh-head">${left}<h3>${esc(title)}</h3>${right || '<span></span>'}</header>`;
const done = '<button class="sh-btn strong" data-act="closeSheet">Listo</button>';
const saveBtn = (act) => `<button class="sh-btn strong" data-act="${act}">Guardar</button>`;

function amountInput(field, value, code = cur()) {
  return `<span class="inline-amount"><span>${esc(M.symbol(code))}</span><input inputmode="decimal" placeholder="0" data-in="amount" data-f="${field}"
    value="${value ? M.groupDigits(M.rawFromValue(value, code)) : ''}"></span>`;
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

// ---------------------------------------------------------------- Registrar / editar

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
    return `${head(st.editId ? 'Editar' : 'Registrar')}
    <div class="sh-body">
      <div class="seg">${['expense', 'income'].map((k) => `<button class="${st.kind === k ? 'on' : ''}" data-act="addKind" data-k="${k}">${k === 'expense' ? 'Gasto' : 'Ingreso'}</button>`).join('')}</div>
      ${st.editId ? '' : `<section class="composer">
        <div class="between"><span class="label" id="smartHint">Escribe o dicta</span><span class="pct" id="ocrStatus"></span></div>
        <textarea id="smart" rows="1" enterkeyhint="done" placeholder="almuerzo 18 mil ayer #trabajo" data-in="smart">${esc(st.smart)}</textarea>
        <div class="composer-actions">
          ${SR ? `<button class="tool" data-act="dictate" id="dictBtn">${icon('mic')}<span>Dictar</span></button>` : ''}
          <label class="tool">${icon('camera')}<span>Recibo</span><input type="file" accept="image/*" hidden data-ch="receipt"></label>
          <span class="grow"></span>
          <button class="circle-btn sm" data-act="clearSmart" aria-label="Borrar texto">${icon('x', 'sm')}</button>
        </div>
        ${SR ? '' : '<p class="pct mt-s">Tip: usa el micrófono del teclado para dictar.</p>'}
        <div id="understood"></div></section>`}
      <div id="multi" ${multi ? '' : 'hidden'}></div>
      <div id="single" ${multi ? 'hidden' : ''}>
        <section class="panel">
          <div class="between"><span class="label">Monto</span>
            <select class="chip sm" data-ch="addCurrency" aria-label="Moneda">${M.CURRENCIES.map((c) => `<option value="${c}" ${c === st.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
          <div class="amount-entry"><span id="amtSym">${esc(M.symbol(st.currency, st.currency === cur()))}</span>
            <input id="amount" inputmode="decimal" placeholder="0" data-in="addAmount" value="${st.amount ? M.groupDigits(M.rawFromValue(st.amount, st.currency)) : ''}"></div>
          <div class="kind-line"><span class="dot" id="kindDot"></span><span id="kindText"></span></div>
          <div id="rateRow"></div>
        </section>
        <section class="panel"><span class="label">Categoría</span><div class="cat-grid mt" id="catGrid"></div></section>
        <div class="form">
          <label class="frow"><span class="label" style="width:78px">Nota</span><input id="note" placeholder="Opcional" value="${esc(st.note)}" data-in="field" data-f="note"></label>
          <label class="frow"><span class="label" style="width:78px">Fecha</span><input id="date" type="date" value="${st.date}" max="${toInputDate(new Date(Date.now() + 366 * 864e5))}" data-ch="field" data-in="field" data-f="date"></label>
          <label class="frow"><span class="label" style="width:78px">Etiquetas</span><input id="tags" placeholder="#viaje #trabajo" value="${esc(st.tags)}" autocapitalize="off" data-in="field" data-f="tags"></label>
        </div>
        <div id="frequent"></div>
        ${st.editId ? `<button class="btn danger mt" data-act="deleteMovement">${icon('trash', 'sm')} Eliminar movimiento</button>` : ''}
      </div>
    </div>
    <footer class="sh-foot"><button class="btn primary" id="saveBtn" data-act="saveAdd">Guardar</button></footer>`;
  },
  mounted(sh, el) {
    SHEETS.add.update(sh);
    const ta = el.querySelector('#smart');
    if (ta) {
      autoGrow(ta);
      if (sh.st.smart) SHEETS.add.parse(sh);
      else setTimeout(() => ta.focus({ preventScroll: true }), 380);
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
    el.querySelector('#amtSym').textContent = M.symbol(st.currency, st.currency === cur());
    el.querySelector('#kindDot').className = `dot ${st.kind === 'expense' ? 'neg' : 'pos'}`;
    el.querySelector('#kindText').textContent = st.kind === 'expense' ? 'Gasto' : 'Ingreso';
    // Lo que entendió
    const u = el.querySelector('#understood');
    if (u) {
      const f = st.parsed[0];
      if (f && !multi && (f.amount != null || f.categoryId)) {
        const c = L.catById(f.categoryId);
        const chips = [];
        if (f.amount != null) chips.push(money(f.amount, { code: f.currency || st.currency, force: true }));
        if (c) chips.push(esc(c.name));
        if (f.date) chips.push(esc(dayLabel(f.date)));
        if (f.kind === 'income') chips.push('Ingreso');
        f.tags.forEach((t) => chips.push(`#${esc(t)}`));
        u.innerHTML = `<div class="understood"><span class="label" style="margin-right:4px">Entendí</span>${chips.map((x) => `<span class="chip sm">${x}</span>`).join('')}</div>`;
      } else u.innerHTML = '';
    }
    // Varios movimientos en un solo texto
    if (multi) {
      const list = st.parsed.filter((e) => e.amount != null);
      el.querySelector('#multi').innerHTML = `<section class="panel"><span class="label">${list.length} movimientos detectados</span><div class="rows mt-s">
        ${list.map((e) => {
          const k = e.kind || st.kind; const c = L.catById(e.categoryId) || L.fallbackCategory(k);
          return `<div class="item">${catIcon(c, 38)}<span class="grow"><span class="t">${esc(e.note || c?.name || 'Movimiento')}</span><span class="s">${esc([c?.name, e.date ? dayLabel(e.date) : null].filter(Boolean).join(' · '))}</span></span>
          <span class="amt"><span class="amt-v"><span class="dot ${k === 'expense' ? 'neg' : 'pos'}"></span>${money(e.amount, { code: e.currency || cur(), force: true })}</span></span></div>`;
        }).join('')}</div>
        <p class="pct mt-s">Puedes editarlos luego desde Movimientos.</p></section>`;
    }
    // Tasa de cambio
    el.querySelector('#rateRow').innerHTML = st.currency !== cur()
      ? `<div class="rate">1 ${st.currency} = <input inputmode="decimal" value="${st.rate}" data-in="addRate"> ${cur()}
         ${st.amount ? `<span>≈ ${money(st.amount * st.rate, { force: true })}</span>` : ''}</div>` : '';
    // Categorías
    const cats = L.activeCats(st.kind);
    let visible = cats;
    if (!st.showAll && cats.length > 8) {
      visible = cats.slice(0, 7);
      const sel = cats.find((c) => c.id === st.catId);
      if (sel && !visible.includes(sel)) visible[6] = sel;
    }
    el.querySelector('#catGrid').innerHTML = visible.map((c) => `<button class="cat ${c.id === st.catId ? 'on' : ''}" data-act="addCat" data-id="${c.id}">
        <span class="cat-ic">${glyph(c.icon)}</span><small>${esc(c.name)}</small></button>`).join('') +
      (!st.showAll && cats.length > 8 ? `<button class="cat" data-act="addShowAll"><span class="cat-ic">${icon('dotsH')}</span><small>Ver todas</small></button>` : '');
    // Frecuentes
    const fr = !st.editId && !st.amount && !st.smart ? L.frequent(st.kind) : [];
    el.querySelector('#frequent').innerHTML = fr.length ? `<span class="label" style="display:block;margin:20px 6px 10px">Frecuentes</span><div class="chips">${fr.map((f, i) =>
      `<button class="chip freq" data-act="addFrequent" data-i="${i}">${catIcon(L.catById(f.catId), 30)}<span><b>${esc(f.title)}</b><small>${money(f.amount, { force: true })}</small></span></button>`).join('')}</div>` : '';
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
IN.addRate = (el) => { topSheet().st.rate = Number(el.value.replace(',', '.')) || 0; };
A.addKind = (d) => { const sh = topSheet(); sh.st.kind = d.k; SHEETS.add.update(sh); };
A.addCat = (d) => { const sh = topSheet(); sh.st.catId = d.id; SHEETS.add.update(sh); navigator.vibrate?.(6); };
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
  if (r) { sh.st.rate = Math.round(r * 10000) / 10000; SHEETS.add.update(sh); } else toast('Sin internet: escribe la tasa de cambio a mano.', 'warn');
}

A.dictate = (d, btn) => {
  const sh = topSheet();
  if (sh.recognition) { sh.recognition.stop(); return; }
  const rec = new SR();
  rec.lang = 'es-CO'; rec.interimResults = true; rec.continuous = false;
  sh.recognition = rec;
  btn.classList.add('rec'); btn.querySelector('span').textContent = 'Escuchando';
  $('#smartHint').textContent = 'Te escucho…';
  rec.onresult = (ev) => {
    const text = [...ev.results].map((r) => r[0].transcript).join(' ');
    const ta = $('#smart'); ta.value = text; sh.st.smart = text; sh.st.source = 'voice'; autoGrow(ta); SHEETS.add.parse(sh);
  };
  rec.onerror = () => toast('No se pudo usar el micrófono. Revisa los permisos.', 'warn');
  rec.onend = () => { sh.recognition = null; btn.classList.remove('rec'); btn.querySelector('span').textContent = 'Dictar'; $('#smartHint').textContent = 'Escribe o dicta'; };
  try { rec.start(); } catch { rec.onend(); }
};

CH.receipt = async (input) => {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const sh = topSheet();
  const status = $('#ocrStatus');
  status.textContent = 'Leyendo recibo…';
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
    status.textContent = r.total ? 'Recibo leído' : 'No encontré el total';
  } catch {
    status.textContent = '';
    toast('No se pudo leer el recibo. La primera vez necesitas internet.', 'warn');
  }
};

const tagsFrom = (text) => [...new Set(text.split(/[\s,#]+/).map((t) => t.toLowerCase().replace(/[^\p{L}\p{N}_]/gu, '')).filter(Boolean))];

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
  if (!confirm('¿Eliminar este movimiento?')) return;
  L.deleteMovement(topSheet().st.editId);
  commit('Movimiento eliminado');
  closeSheet();
};

// ---------------------------------------------------------------- Presupuestos

A.openBudget = () => openSheet('budget');
SHEETS.budget = {
  init: () => ({ budget: S().budget, cycleDay: S().cycleDay }),
  html: (sh) => `${head('Presupuesto', saveBtn('saveBudget'))}
    <div class="sh-body"><div class="form"><label class="frow"><span class="grow">Presupuesto mensual</span>${amountInput('budget', sh.st.budget)}</label></div>
      <p class="form-note">Lo máximo que quieres gastar en el periodo. Déjalo en 0 para usar la suma de los presupuestos por categoría.</p>
      <div class="form"><label class="frow"><span class="grow">El mes empieza el día</span>
        <select data-ch="field" data-f="cycleDay">${Array.from({ length: 28 }, (_, i) => `<option ${i + 1 === Number(sh.st.cycleDay) ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label></div>
      <p class="form-note">Útil si te pagan el 15 o el 30: tu “mes” irá de ese día al mismo día del mes siguiente.</p></div>`,
};
A.saveBudget = () => { const st = topSheet().st; S().budget = st.budget || 0; S().cycleDay = Number(st.cycleDay) || 1; commit('Presupuesto guardado'); closeSheet(); };

A.pickCatBudget = () => openSheet('pickCat');
SHEETS.pickCat = {
  html: () => `${head('Elige una categoría')}<div class="sh-body"><div class="rows">
    ${L.activeCats('expense').filter((c) => !c.budget).map((c) => `<button class="item" data-act="pickedCat" data-id="${c.id}">${catIcon(c, 38)}<span class="grow"><span class="t">${esc(c.name)}</span></span>${icon('right', 'sm')}</button>`).join('')}</div></div>`,
};
A.pickedCat = (d) => { closeSheet(); setTimeout(() => openSheet('catBudget', { id: d.id }), 340); };
A.openCatBudget = (d) => openSheet('catBudget', { id: d.id });
SHEETS.catBudget = {
  init: ({ id }) => ({ budget: L.catById(id)?.budget || 0 }),
  html: (sh) => {
    const c = L.catById(sh.props.id);
    return `${head('Presupuesto', saveBtn('saveCatBudget'))}
    <div class="sh-body"><div class="sheet-hero">${catIcon(c, 64)}<p class="serif" style="font-size:30px;margin-top:14px">${esc(c.name)}</p></div>
      <div class="form"><label class="frow"><span class="grow">Límite mensual</span>${amountInput('budget', sh.st.budget)}</label></div>
      <p class="form-note">Te avisamos cuando llegues al 80% y al 100%.</p>
      ${c.budget ? '<button class="btn danger" data-act="removeCatBudget">Quitar presupuesto</button>' : ''}</div>`;
  },
};
A.saveCatBudget = () => { const sh = topSheet(); L.catById(sh.props.id).budget = sh.st.budget || 0; commit('Presupuesto guardado'); closeSheet(); };
A.removeCatBudget = () => { L.catById(topSheet().props.id).budget = 0; commit(); closeSheet(); };

// ---------------------------------------------------------------- Metas

A.openGoalEditor = (d) => openSheet('goalEdit', { id: d?.id });
SHEETS.goalEdit = {
  init: ({ id }) => {
    const g = id && state.goals.find((x) => x.id === id);
    const six = new Date(); six.setMonth(six.getMonth() + 6);
    return g ? { name: g.name, icon: g.icon, target: g.target, hasDeadline: !!g.deadline, deadline: toInputDate(new Date(g.deadline || six)) }
      : { name: '', icon: 'star', target: 0, initial: 0, hasDeadline: false, deadline: toInputDate(six) };
  },
  html: (sh) => {
    const st = sh.st;
    return `${head(sh.props.id ? 'Editar meta' : 'Nueva meta', saveBtn('saveGoal'))}
    <div class="sh-body"><div class="form">
      <label class="frow"><input placeholder="Nombre de la meta" value="${esc(st.name)}" data-in="field" data-f="name"></label>
      <label class="frow"><span class="grow">Meta</span>${amountInput('target', st.target)}</label>
      ${sh.props.id ? '' : `<label class="frow"><span class="grow">Ya tengo ahorrado</span>${amountInput('initial', st.initial)}</label>`}
      <label class="frow"><span class="grow">Fecha límite</span><input type="checkbox" class="switch" ${st.hasDeadline ? 'checked' : ''} data-ch="goalDeadline"></label>
      ${st.hasDeadline ? `<label class="frow"><span class="grow">Para el</span><input type="date" style="flex:none;width:auto" value="${st.deadline}" min="${toInputDate(new Date())}" data-ch="field" data-in="field" data-f="deadline"></label>` : ''}
    </div>
    <span class="label form-label">Ícono</span>
    <div class="icon-grid">${GOAL_ICONS.map((k) => `<button class="${k === st.icon ? 'on' : ''}" data-act="goalIcon" data-e="${k}" aria-label="${k}">${glyph(k)}</button>`).join('')}</div></div>`;
  },
};
CH.goalDeadline = (el) => { topSheet().st.hasDeadline = el.checked; refreshSheet(); };
A.goalIcon = (d) => { topSheet().st.icon = d.e; refreshSheet(); };
A.saveGoal = () => {
  const sh = topSheet(); const st = sh.st;
  if (!st.name.trim() || !(st.target > 0)) { toast('Ponle nombre y monto a la meta.', 'warn'); return; }
  const deadline = st.hasDeadline ? fromInputDate(st.deadline).toISOString() : null;
  if (sh.props.id) {
    Object.assign(state.goals.find((g) => g.id === sh.props.id), { name: st.name.trim(), icon: st.icon, target: st.target, deadline });
  } else {
    const g = { id: uid(), name: st.name.trim(), icon: st.icon, color: '#FFFFFF', target: st.target, deadline, archived: false, contribs: [] };
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
      <div class="sheet-hero"><div style="display:flex;justify-content:center">${ring(goalProgress(g), g.icon, 120)}</div>
        <div class="kpi">${money(saved)}</div><p class="hero-sub mt-s">de ${money(g.target)} · faltan ${money(Math.max(g.target - saved, 0))}</p>
        ${mo ? `<p class="pct mt-s">Para llegar a tiempo: ${money(mo)} al mes</p>` : ''}
        <div class="two"><button class="btn primary sm" data-act="openContrib" data-w="0">${icon('plus', 'sm')} Aportar</button>
          <button class="btn outline sm" data-act="openContrib" data-w="1" ${saved <= 0 ? 'disabled' : ''}>Retirar</button></div></div>
      <span class="label">Historial</span>
      <div class="rows mt-s">${g.contribs.length ? [...g.contribs].sort((a, b) => new Date(b.date) - new Date(a.date)).map((c) => `<div class="item">
        <span class="grow"><span class="t">${esc(c.note || (c.amount >= 0 ? 'Aporte' : 'Retiro'))}</span><span class="s">${longDate(new Date(c.date))}</span></span>
        <span class="amt-v"><span class="dot ${c.amount >= 0 ? 'pos' : 'neg'}"></span>${money(c.amount, { signed: true })}</span>
        <button class="circle-btn sm" data-act="delContrib" data-id="${c.id}" aria-label="Eliminar aporte">${icon('trash', 'sm')}</button></div>`).join('') : '<p class="hero-sub" style="padding:12px 0">Aún no hay aportes.</p>'}</div>
      <div class="form mt-l"><button class="frow" data-act="openGoalEditor" data-id="${g.id}">Editar meta</button>
        <button class="frow" data-act="archiveGoal">${g.archived ? 'Reactivar meta' : 'Archivar meta'}</button>
        <button class="frow neg" data-act="deleteGoal">Eliminar meta</button></div></div>`;
  },
};
A.openContrib = (d) => openSheet('contrib', { goalId: topSheet().props.id, w: d.w === '1' });
SHEETS.contrib = {
  init: () => ({ amount: 0, date: toInputDate(new Date()), note: '' }),
  html: (sh) => `${head(sh.props.w ? 'Retirar' : 'Aportar', saveBtn('saveContrib'))}
    <div class="sh-body"><div class="form">
      <label class="frow"><span class="grow">${sh.props.w ? 'Retiro' : 'Aporte'}</span>${amountInput('amount', 0)}</label>
      <label class="frow"><span class="grow">Fecha</span><input type="date" style="flex:none;width:auto" value="${sh.st.date}" data-ch="field" data-in="field" data-f="date"></label>
      <label class="frow"><input placeholder="Nota (opcional)" data-in="field" data-f="note"></label></div></div>`,
};
A.saveContrib = () => {
  const sh = topSheet(); const st = sh.st;
  if (!(st.amount > 0)) return;
  const g = state.goals.find((x) => x.id === sh.props.goalId);
  g.contribs.push({ id: uid(), amount: sh.props.w ? -st.amount : st.amount, date: fromInputDate(st.date).toISOString(), note: st.note.trim() });
  commit(!sh.props.w && goalSaved(g) >= g.target ? `Cumpliste tu meta “${g.name}”` : 'Guardado');
  closeSheet();
};
A.delContrib = (d) => { const g = state.goals.find((x) => x.id === topSheet().props.id); g.contribs = g.contribs.filter((c) => c.id !== d.id); commit(); refreshSheet(); };
A.archiveGoal = () => { const g = state.goals.find((x) => x.id === topSheet().props.id); g.archived = !g.archived; commit(); closeSheet(); };
A.deleteGoal = () => { if (!confirm('¿Eliminar la meta y su historial?')) return; state.goals = state.goals.filter((g) => g.id !== topSheet().props.id); commit(); closeSheet(); };

// ---------------------------------------------------------------- Pagos fijos (recurrentes)

A.openRuleEditor = () => openSheet('rule', {});
A.openRule = (d) => openSheet('rule', { id: d.id });
A.ruleFromSuggestion = (d) => openSheet('rule', { sug: L.suggestions()[Number(d.i)] });
SHEETS.rule = {
  init: ({ id, sug }) => {
    const r = id && state.rules.find((x) => x.id === id);
    if (r) return { title: r.title, amount: r.amount, kind: r.kind, catId: r.catId, freq: r.freq, start: toInputDate(new Date(r.start)), auto: r.auto, active: r.active };
    if (sug) return { title: sug.title, amount: sug.amount, kind: 'expense', catId: sug.catId, freq: sug.freq, start: toInputDate(M.occurrence(sug.freq, 1, sug.last)), auto: true, active: true };
    return { title: '', amount: 0, kind: 'expense', catId: '', freq: 'monthly', start: toInputDate(new Date()), auto: true, active: true };
  },
  html: (sh) => {
    const st = sh.st; const edit = !!sh.props.id;
    return `${head(edit ? 'Editar pago fijo' : 'Nuevo pago fijo', saveBtn('saveRule'))}
    <div class="sh-body">
      <div class="seg">${['expense', 'income'].map((k) => `<button class="${st.kind === k ? 'on' : ''}" data-act="ruleKind" data-k="${k}">${k === 'expense' ? 'Gasto' : 'Ingreso'}</button>`).join('')}</div>
      <div class="form">
        <label class="frow"><input placeholder="Nombre (ej. Arriendo, Netflix)" value="${esc(st.title)}" data-in="field" data-f="title"></label>
        <label class="frow"><span class="grow">Monto</span>${amountInput('amount', st.amount)}</label>
        <label class="frow"><span class="grow">Categoría</span><select data-ch="field" data-f="catId"><option value="">Sin categoría</option>
          ${L.activeCats(st.kind).map((c) => `<option value="${c.id}" ${c.id === st.catId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label></div>
      <div class="form">
        <label class="frow"><span class="grow">Frecuencia</span><select data-ch="field" data-f="freq">${Object.entries(M.FREQUENCIES).map(([k, f]) => `<option value="${k}" ${k === st.freq ? 'selected' : ''}>${f.title}</option>`).join('')}</select></label>
        <label class="frow"><span class="grow">${edit ? 'Desde' : 'Primer pago'}</span><input type="date" style="flex:none;width:auto" value="${st.start}" data-ch="field" data-in="field" data-f="start"></label></div>
      <div class="form">
        <label class="frow"><span class="grow">Registrar automáticamente</span><input type="checkbox" class="switch" ${st.auto ? 'checked' : ''} data-ch="field" data-f="auto"></label>
        ${edit ? `<label class="frow"><span class="grow">Activo</span><input type="checkbox" class="switch" ${st.active ? 'checked' : ''} data-ch="field" data-f="active"></label>` : ''}</div>
      <p class="form-note">${st.auto ? 'Se anota solo cada vez que toca. Ideal para arriendo, suscripciones o cuotas fijas.' : 'Queda pendiente el día del pago para que lo confirmes (útil si el valor cambia, como los servicios).'}</p>
      ${edit ? '<button class="btn danger" data-act="deleteRule">Eliminar pago fijo</button>' : ''}</div>`;
  },
  changed: (sh, f) => { if (f === 'auto') refreshSheet(sh); },
};
A.ruleKind = (d) => { const st = topSheet().st; st.kind = d.k; st.catId = ''; refreshSheet(); };
A.saveRule = () => {
  const sh = topSheet(); const st = sh.st;
  if (!st.title.trim() || !(st.amount > 0)) { toast('Ponle nombre y monto.', 'warn'); return; }
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
  commit(n ? `Guardado · se registraron ${n} pagos` : 'Pago fijo guardado');
  closeSheet();
};
A.deleteRule = () => {
  if (!confirm('¿Eliminar este pago fijo? Los movimientos ya registrados se conservan.')) return;
  state.rules = state.rules.filter((r) => r.id !== topSheet().props.id);
  commit(); closeSheet();
};

A.openPending = () => openSheet('pending');
SHEETS.pending = {
  html: () => {
    const pend = L.pendingRules();
    return `${head('Por revisar', pend.length > 1 ? '<button class="sh-btn strong" data-act="confirmAll">Registrar todo</button>' : '', '<button class="sh-btn" data-act="closeSheet">Cerrar</button>')}
    <div class="sh-body">${!pend.length ? `<div class="empty">${icon('check')}<p class="serif">Todo al día</p><p>No hay pagos por revisar.</p></div>` : ''}
      ${pend.map((r) => `<div class="panel"><div class="item" style="padding-top:0">${catIcon(L.catById(r.catId), 40)}<span class="grow"><span class="t">${esc(r.title)}</span><span class="s">${esc(dayLabel(L.nextDate(r)))}</span></span>
        <span class="amt-v"><span class="dot ${r.kind === 'expense' ? 'neg' : 'pos'}"></span>${money(r.amount)}</span></div>
        <div class="two" style="margin-top:6px"><button class="btn primary sm" data-act="confirmRule" data-id="${r.id}">Registrar</button><button class="btn outline sm" data-act="skipRule" data-id="${r.id}">Omitir</button></div></div>`).join('')}</div>`;
  },
};
A.confirmRule = (d) => { L.confirmRule(state.rules.find((r) => r.id === d.id)); commit('Registrado'); refreshSheet(); render(); };
A.skipRule = (d) => { state.rules.find((r) => r.id === d.id).count++; commit(); refreshSheet(); render(); };
A.confirmAll = () => { L.pendingRules().forEach((r) => L.confirmRule(r)); commit('Pagos registrados'); refreshSheet(); render(); };

// ---------------------------------------------------------------- Detalle de categoría

A.openCatDetail = (d) => openSheet('catDetail', { id: d.id || null, off: Number(d.off) });
SHEETS.catDetail = {
  html: (sh) => {
    const p = M.shiftPeriod(L.currentPeriod(), sh.props.off);
    const c = L.catById(sh.props.id);
    const items = L.sortedMovements().filter((m) => M.inPeriod(p, L.md(m)) && (m.catId || null) === sh.props.id);
    const t = items.reduce((a, m) => a + m.main, 0);
    return `${head(c?.name || 'Sin categoría', done, '<span></span>')}<div class="sh-body">
      <div class="sheet-hero">${catIcon(c, 64)}<div class="kpi">${money(t)}</div><p class="hero-sub mt-s">${items.length} ${items.length === 1 ? 'movimiento' : 'movimientos'} · ${esc(M.periodTitle(p))}</p></div>
      <div class="rows">${items.map((m) => movementRow(m, true)).join('')}</div></div>`;
  },
};

// ---------------------------------------------------------------- Ajustes

A.openSettings = () => openSheet('settings');
SHEETS.settings = {
  html: () => {
    const s = S();
    const last = s.lastBackup ? longDate(new Date(s.lastBackup)) : 'nunca';
    return `${head('Ajustes', done, '<span></span>')}<div class="sh-body">
      <span class="label form-label">General</span>
      <div class="form">
        <label class="frow"><span class="grow">Tu nombre</span><input class="right" placeholder="Opcional" value="${esc(s.name)}" data-in="setName"></label>
        <label class="frow"><span class="grow">Moneda principal</span><select data-ch="setCurrency">${M.CURRENCIES.map((c) => `<option value="${c}" ${c === s.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label class="frow"><span class="grow">El mes empieza el día</span><select data-ch="setCycle">${Array.from({ length: 28 }, (_, i) => `<option ${i + 1 === s.cycleDay ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
        <label class="frow"><span class="grow">Apariencia</span><select data-ch="setTheme">${[['dark', 'Negro'], ['light', 'Blanco'], ['auto', 'Automática']].map(([k, l]) => `<option value="${k}" ${k === s.theme ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <button class="frow" data-act="openCategories"><span class="grow">Categorías</span>${icon('right', 'sm')}</button>
      </div>
      <span class="label form-label">Privacidad</span>
      <div class="form">
        <label class="frow"><span class="grow">Ocultar montos</span><input type="checkbox" class="switch" ${s.hide ? 'checked' : ''} data-ch="setHide"></label>
        <label class="frow"><span class="grow">Avisos de presupuesto</span><input type="checkbox" class="switch" ${s.alerts ? 'checked' : ''} data-ch="setAlerts"></label>
      </div>
      <p class="form-note">Tus datos se guardan solo en este teléfono. Sin servidores, sin cuentas y sin publicidad.</p>
      <span class="label form-label">Tus datos</span>
      <div class="form">
        <button class="frow" data-act="exportCSV"><span class="grow">Exportar movimientos (CSV)</span>${icon('share', 'sm')}</button>
        <button class="frow" data-act="exportBackup"><span class="grow">Crear copia de seguridad<span class="sub">Última: ${last}</span></span>${icon('download', 'sm')}</button>
        <label class="frow"><span class="grow">Restaurar desde una copia</span>${icon('upload', 'sm')}<input type="file" accept="application/json,.json" hidden data-ch="restore"></label>
        <button class="frow neg" data-act="deleteAll"><span class="grow">Borrar todos mis datos</span></button>
      </div>
      <p class="form-note">Guarda una copia de vez en cuando en Archivos o iCloud Drive. Si borras los datos de Safari o cambias de teléfono, la necesitarás.</p>
      <span class="label form-label">Ayuda</span>
      <div class="form">
        <button class="frow" data-act="openInstall"><span class="grow">Instalar en el iPhone</span>${icon('right', 'sm')}</button>
        <a class="frow" href="soporte.html" target="_blank"><span class="grow">Soporte y sugerencias</span>${icon('right', 'sm')}</a>
        <a class="frow" href="privacidad.html" target="_blank"><span class="grow">Política de privacidad</span>${icon('right', 'sm')}</a>
        <button class="frow" data-act="shareApp"><span class="grow">Recomendar a un amigo</span>${icon('share', 'sm')}</button>
      </div>
      <p class="center mt-l"><span class="wordmark">Rinde</span></p>
      <p class="center pct">Versión 2.0 · Hecho en Colombia</p></div>`;
  },
};
IN.setName = (el) => { S().name = el.value.trim(); save(); };
CH.setCurrency = (el) => {
  if (state.movements.length && !confirm('Los montos que ya registraste no se convierten. ¿Cambiar la moneda principal?')) { el.value = S().currency; return; }
  S().currency = el.value; commit(); render();
};
CH.setCycle = (el) => { S().cycleDay = Number(el.value); commit(); render(); };
CH.setTheme = (el) => { S().theme = el.value; commit(); render(); };
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
    toast(`Se restauraron ${data.movements.length} movimientos`);
    closeSheet();
  } catch {
    toast('El archivo no es una copia de seguridad de Rinde.', 'warn');
  }
};
A.deleteAll = () => {
  if (!confirm('¿Borrar todos tus datos? Te recomendamos crear una copia antes. No se puede deshacer.')) return;
  resetAll(); toast('Se borraron tus datos'); closeSheet();
};
A.shareApp = async () => {
  const data = { title: 'Rinde', text: 'Estoy usando Rinde para controlar mis gastos. Te la recomiendo:', url: location.href.split('#')[0] };
  try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(data.url); toast('Link copiado'); } } catch { /* cancelado */ }
};

A.openInstall = () => openSheet('install');
SHEETS.install = {
  html: () => `${head('Instalar', done, '<span></span>')}<div class="sh-body">
    <div class="sheet-hero"><p class="serif" style="font-size:36px;line-height:1.05">Rinde en tu<br><em>pantalla de inicio.</em></p>
      <p class="hero-sub mt">Con su ícono, a pantalla completa y funcionando sin internet.</p></div>
    <ol class="steps-list">
      <li><b>01</b>&nbsp;&nbsp;Abre esta página en <b>Safari</b>.</li>
      <li><b>02</b>&nbsp;&nbsp;Toca <b>Compartir</b> ${icon('share', 'sm')}</li>
      <li><b>03</b>&nbsp;&nbsp;Elige <b>Agregar a pantalla de inicio</b>.</li>
      <li><b>04</b>&nbsp;&nbsp;Toca <b>Agregar</b> y abre Rinde desde su ícono.</li></ol>
    <p class="form-note mt">En Android: menú ⋮ de Chrome → Instalar app.</p></div>`,
};

// ---------------------------------------------------------------- Categorías

A.openCategories = () => openSheet('categories');
SHEETS.categories = {
  html: () => {
    const sec = (kind, title) => `<span class="label form-label">${title}</span><div class="rows">
      ${L.activeCats(kind).map((c) => `<button class="item" data-act="editCat" data-id="${c.id}">${catIcon(c, 38)}<span class="grow"><span class="t">${esc(c.name)}</span></span>${c.budget ? `<span class="pct">${money(c.budget)}</span>` : ''}${icon('right', 'sm')}</button>`).join('')}
      <button class="item" data-act="newCat" data-k="${kind}"><span class="cat-ic" style="width:38px;height:38px;border-style:dashed">${icon('plus', 'sm')}</span><span class="grow"><span class="t">Nueva categoría</span></span></button></div>`;
    const archived = state.categories.filter((c) => c.archived);
    return `${head('Categorías', done, '<span></span>')}<div class="sh-body">${sec('expense', 'Gastos')}${sec('income', 'Ingresos')}
      ${archived.length ? `<span class="label form-label">Archivadas</span><div class="rows">${archived.map((c) => `<button class="item" style="opacity:.5" data-act="editCat" data-id="${c.id}">${catIcon(c, 38)}<span class="grow"><span class="t">${esc(c.name)}</span></span></button>`).join('')}</div>` : ''}</div>`;
  },
};
A.editCat = (d) => openSheet('catEdit', { id: d.id });
A.newCat = (d) => openSheet('catEdit', { kind: d.k });
SHEETS.catEdit = {
  init: ({ id, kind }) => {
    const c = id && L.catById(id);
    return c ? { name: c.name, icon: c.icon, budget: c.budget, kind: c.kind } : { name: '', icon: 'tag', budget: 0, kind };
  },
  html: (sh) => {
    const st = sh.st; const c = sh.props.id && L.catById(sh.props.id);
    return `${head(c ? 'Editar categoría' : 'Nueva categoría', saveBtn('saveCat'))}<div class="sh-body">
      <div class="sheet-hero" style="display:flex;justify-content:center">${catIcon(st, 72)}</div>
      <div class="form"><label class="frow"><input placeholder="Nombre" value="${esc(st.name)}" data-in="field" data-f="name"></label>
        ${st.kind === 'expense' ? `<label class="frow"><span class="grow">Presupuesto mensual</span>${amountInput('budget', st.budget)}</label>` : ''}</div>
      <span class="label form-label">Ícono</span>
      <div class="icon-grid">${Object.keys(CAT_ICONS).map((k) => `<button class="${k === st.icon ? 'on' : ''}" data-act="catIcon" data-e="${k}" aria-label="${k}">${glyph(k)}</button>`).join('')}</div>
      ${c ? `<div class="form mt-l"><button class="frow" data-act="archiveCat">${c.archived ? 'Reactivar categoría' : 'Archivar categoría'}</button>
        <button class="frow neg" data-act="deleteCat">Eliminar categoría</button></div>
        <p class="form-note">Archivar la oculta sin tocar tus movimientos. Si la eliminas, sus movimientos quedan “Sin categoría”.</p>` : ''}</div>`;
  },
};
A.catIcon = (d) => { topSheet().st.icon = d.e; refreshSheet(); };
A.saveCat = () => {
  const sh = topSheet(); const st = sh.st;
  if (!st.name.trim()) { toast('Ponle un nombre.', 'warn'); return; }
  if (sh.props.id) Object.assign(L.catById(sh.props.id), { name: st.name.trim(), icon: st.icon, budget: st.budget || 0 });
  else state.categories.push({ id: uid(), name: st.name.trim(), icon: st.icon, color: '#FFFFFF', kind: st.kind, key: '',
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

boot();
