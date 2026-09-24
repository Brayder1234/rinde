// Analizador de lenguaje natural en español (versión web de Rinde).
// Entiende montos ("25 mil", "25.000", "20 lucas", "2 palos", "medio millón",
// "veinte mil"), fechas ("ayer", "el lunes", "hace 3 días", "15/09"),
// si es gasto o ingreso, la categoría y las #etiquetas.
// Todo corre en el teléfono; nada se envía a internet.

// ---------------------------------------------------------------- Texto

/** Minúsculas y sin tildes, con la misma longitud (UTF-16) que el original. */
export function aligned(text) {
  const orig = text.normalize('NFC');
  let norm = '';
  for (const ch of orig) {
    const lower = ch.toLowerCase();
    const folded = lower.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (folded.length === ch.length) norm += folded;
    else if (lower.length === ch.length) norm += lower;
    else norm += ch;
  }
  return { orig, norm };
}

/** "¡Almuerzo en el Éxito!" → "almuerzo en el exito" */
export function key(text) {
  return aligned(text).norm.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function words(text) {
  const k = key(text);
  return k ? k.split(' ') : [];
}

/** Texto sobre el que se "consumen" partes y al final queda la descripción. */
class TextCursor {
  constructor(text) {
    const { orig, norm } = aligned(text);
    this.orig = orig;
    this.norm = norm.length === orig.length ? norm : orig.toLowerCase();
    this.removed = new Array(orig.length).fill(false);
  }
  get normalized() {
    let s = '';
    for (let i = 0; i < this.norm.length; i++) s += this.removed[i] ? ' ' : this.norm[i];
    return s;
  }
  remove(start, length) {
    for (let i = start; i < Math.min(start + length, this.removed.length); i++) this.removed[i] = true;
  }
  sub(start, length) {
    return this.norm.slice(start, start + length);
  }
  get remainingOriginal() {
    let s = '';
    for (let i = 0; i < this.orig.length; i++) s += this.removed[i] ? ' ' : this.orig[i];
    return s.split(/\s+/).filter(Boolean).join(' ');
  }
}

const rx = (src, flags = 'iu') => new RegExp(src, flags);
const firstMatch = (re, s) => { re.lastIndex = 0; return re.exec(s); };
const allMatches = (src, s) => [...s.matchAll(rx(src, 'giu'))];

// ---------------------------------------------------------------- Montos

const NUMERIC =
  '(?<![\\p{L}\\p{N}#/.,])' +
  '(?:(us\\$|usd|u\\$s|\\$|€|eur|cop)\\s?)?' +
  "(\\d{1,3}(?:[.,']\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d+)?)" +
  '(?!\\s?%)' +
  '(?:\\s?(k|mil|lucas?|lukas?|millones|millon|mill|palos?|barras?|melones?|gambas?|m)(?![\\p{L}\\p{N}]))?' +
  '(?:\\s?(pesos?|dolares?|usd|euros?|eur|cop|varos)(?![\\p{L}\\p{N}]))?' +
  '(?![\\p{L}\\p{N}/])';

function multiplierValue(w) {
  switch (w) {
    case 'k': case 'mil': case 'luca': case 'lucas': case 'luka': case 'lukas': return 1e3;
    case 'millon': case 'millones': case 'mill': case 'palo': case 'palos': case 'barra': case 'barras':
    case 'melon': case 'melones': case 'm': return 1e6;
    case 'gamba': case 'gambas': return 100;
    default: return null;
  }
}

function currencyFrom(prefix, suffix) {
  let code = null;
  let marker = false;
  if (prefix) {
    marker = true;
    if (['us$', 'usd', 'u$s'].includes(prefix)) code = 'USD';
    if (['€', 'eur'].includes(prefix)) code = 'EUR';
  }
  if (suffix) {
    marker = true;
    if (suffix.startsWith('dolar') || suffix === 'usd') code = 'USD';
    if (suffix.startsWith('euro') || suffix === 'eur') code = 'EUR';
  }
  return { code, marker };
}

/** "25.000", "25,000", "12,50", "1.500.000", "45.900,50" → número */
export function parseNumberLiteral(raw) {
  let s = raw.replace(/'/g, '');
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  if (dots > 0 && commas > 0) {
    const decimalSep = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const groupSep = decimalSep === '.' ? ',' : '.';
    s = s.split(groupSep).join('').replace(decimalSep, '.');
  } else if (dots + commas > 0) {
    const sep = dots > 0 ? '.' : ',';
    const parts = s.split(sep);
    const last = parts[parts.length - 1];
    if (dots + commas > 1 || last.length === 3) s = parts.join('');
    else s = s.replace(sep, '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const WORD_UNITS = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
  noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600,
  seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
  novecientos: 900, novecientas: 900, medio: 0.5, media: 0.5,
};
const TENS = new Set(['treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']);
const isNumberWord = (w) => w in WORD_UNITS || w === 'mil' || w === 'millon' || w === 'millones';

function evaluateWords(ws) {
  let total = 0;
  let current = 0;
  for (const w of ws) {
    if (w in WORD_UNITS) current += WORD_UNITS[w];
    else if (w === 'mil') { current = (current === 0 ? 1 : current) * 1000; total += current; current = 0; }
    else if (w === 'millon' || w === 'millones') { total = (total + (current === 0 ? 1 : current)) * 1e6; current = 0; }
  }
  return total + current;
}

function wordCandidates(s) {
  const tokens = [...s.matchAll(/\p{L}+/gu)].map((m) => ({ word: m[0], start: m.index, end: m.index + m[0].length }));
  const onlySpaces = (a, b) => b >= a && s.slice(a, b).trim() === '';
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    if (!isNumberWord(tokens[i].word)) { i++; continue; }
    const ws = [tokens[i].word];
    let lastEnd = tokens[i].end;
    let j = i + 1;
    while (j < tokens.length) {
      const t = tokens[j];
      if (!onlySpaces(lastEnd, t.start)) break;
      if (isNumberWord(t.word)) { ws.push(t.word); lastEnd = t.end; j++; }
      else if (t.word === 'y' && TENS.has(ws[ws.length - 1]) && j + 1 < tokens.length &&
               WORD_UNITS[tokens[j + 1].word] < 10 && onlySpaces(t.end, tokens[j + 1].start)) {
        ws.push(tokens[j + 1].word); lastEnd = tokens[j + 1].end; j += 2;
      } else break;
    }
    let value = evaluateWords(ws);
    let hasMultiplier = ws.some((w) => w === 'mil' || w.startsWith('millon'));
    let multiplier = ws.some((w) => w.startsWith('millon')) ? 1e6 : (ws.includes('mil') ? 1e3 : 1);
    if (j < tokens.length && onlySpaces(lastEnd, tokens[j].start)) {
      const m = multiplierValue(tokens[j].word);
      if (m && tokens[j].word !== 'm' && tokens[j].word !== 'k') {
        value *= m; hasMultiplier = true; multiplier = m; lastEnd = tokens[j].end; j++;
      }
    }
    const start = tokens[i].start;
    if (value > 0 && (hasMultiplier || value >= 10)) {
      out.push({ value, ranges: [[start, lastEnd - start]], start, end: lastEnd, isDigit: false,
        hasMultiplier, multiplier, currency: null, hasCurrencyMarker: false });
    }
    i = j;
  }
  return out;
}

const score = (c) => (c.isDigit ? 2 : 1) + (c.hasMultiplier ? 1 : 0) + (c.hasCurrencyMarker ? 2 : 0);

export function amountCandidates(s) {
  const result = [];
  for (const m of allMatches(NUMERIC, s)) {
    const [, prefix, number, multWord, suffix] = m;
    let value = parseNumberLiteral(number);
    if (value == null) continue;
    let mult = 1;
    if (multWord) { const v = multiplierValue(multWord); if (v) { mult = v; value *= v; } }
    if (!(value > 0)) continue;
    const cur = currencyFrom(prefix, suffix);
    result.push({ value, ranges: [[m.index, m[0].length]], start: m.index, end: m.index + m[0].length,
      isDigit: true, hasMultiplier: !!multWord, multiplier: mult, currency: cur.code, hasCurrencyMarker: cur.marker });
  }
  result.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const c of result) {
    const prev = merged[merged.length - 1];
    if (prev && prev.multiplier >= 1e6 && c.value < prev.multiplier && (c.hasMultiplier || c.value >= 1000)) {
      const gap = s.slice(prev.end, c.start).trim();
      if (gap === '' || gap === 'y' || gap === 'con') {
        prev.value += c.value;
        prev.ranges.push([prev.end, c.end - prev.end]);
        prev.end = c.end;
        continue;
      }
    }
    merged.push(c);
  }
  const occupied = merged.flatMap((c) => c.ranges);
  for (const w of wordCandidates(s)) {
    const [ws, wl] = w.ranges[0];
    if (!occupied.some(([a, l]) => ws < a + l && a < ws + wl)) merged.push(w);
  }
  return merged;
}

function pickBest(cands) {
  let best = null;
  for (const c of cands) {
    if (!best || score(c) > score(best) || (score(c) === score(best) && c.value > best.value)) best = c;
  }
  return best;
}

// ---------------------------------------------------------------- Gasto o ingreso

const INCOME_PHRASES = ['me pagaron', 'me consignaron', 'me transfirieron', 'me depositaron', 'me enviaron', 'me mandaron',
  'me dieron', 'me devolvieron', 'me regalaron', 'me llego el pago', 'me llego la plata', 'recibi', 'cobre', 'gane',
  'vendi', 'ingreso', 'ingresaron', 'entraron', 'entro la', 'entro el', 'llego la quincena', 'llego el sueldo', 'llego la nomina'];
const EXPENSE_WORDS = ['gaste', 'pague', 'compre', 'pedi', 'tanquee', 'invite', 'done', 'gasto', 'pago', 'compra', 'costo',
  'salio', 'me cobraron', 'perdi', 'preste', 'gastamos', 'pagamos', 'compramos'];
const INCOME_NOUNS = ['salario', 'sueldo', 'nomina', 'quincena', 'prima', 'honorarios', 'freelance', 'comision', 'comisiones',
  'bono', 'bonificacion', 'reembolso', 'devolucion', 'rendimientos', 'dividendos', 'cesantias', 'venta', 'ventas',
  'ganancia', 'ganancias'];

const padded = (norm) => ' ' + words(norm).join(' ') + ' ';

export function detectKind(norm) {
  const p = padded(norm);
  if (INCOME_PHRASES.some((x) => p.includes(` ${x} `))) return 'income';
  if (EXPENSE_WORDS.some((x) => p.includes(` ${x} `))) return 'expense';
  if (INCOME_NOUNS.some((x) => p.includes(` ${x} `))) return 'income';
  return null;
}

// ---------------------------------------------------------------- Categoría

/** matchers: [{id, kind, keywords:[normalizadas]}]; learned: {"nota normalizada": id} */
export function detectCategory(norm, matchers, learned = {}, preferredKind = null) {
  const ws = words(norm);
  if (!ws.length) return null;
  const p = ' ' + ws.join(' ') + ' ';
  const set = new Set(ws);
  const hit = (k) => (k.includes(' ') ? p.includes(` ${k} `) : set.has(k) || set.has(k + 's') || set.has(k + 'es'));
  const candidates = matchers.filter((m) => !preferredKind || m.kind === preferredKind);
  let best = null;
  for (const [k, id] of Object.entries(learned)) {
    if (!k || !hit(k)) continue;
    const m = candidates.find((c) => c.id === id);
    if (m && (!best || 100 + k.length > best.score)) best = { m, score: 100 + k.length };
  }
  for (const m of candidates) {
    for (const k of m.keywords) {
      if (k && hit(k) && (!best || k.length > best.score)) best = { m, score: k.length };
    }
  }
  return best ? best.m : null;
}

// ---------------------------------------------------------------- Fechas

const RE_RELATIVE = '(?<![\\p{L}])(antes\\s+de\\s+ayer|antes\\s+de\\s+anoche|anteayer|antier|anoche|ayer|hoy|esta\\s+manana|esta\\s+tarde|esta\\s+noche)(?![\\p{L}])';
const RE_DAYS_AGO = '(?<![\\p{L}])hace\\s+(\\d{1,3}|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince)\\s+(dias?|semanas?|mes|meses)(?![\\p{L}])';
const RE_WEEKDAY = '(?<![\\p{L}])(?:el\\s+|este\\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)(\\s+pasado)?(?![\\p{L}])';
const RE_MONTH = '(?<![\\p{L}\\p{N}])(?:el\\s+)?(\\d{1,2})\\s+de\\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\\s+(?:de\\s+|del\\s+)?(\\d{4}))?(?![\\p{L}\\p{N}])';
const RE_NUMERIC_DATE = '(?<![\\p{N}/.,$])(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2,4}))?(?![\\p{N}/])';
const RE_DAY_OF_MONTH = '(?<![\\p{L}\\p{N}])el\\s+(?:dia\\s+)?(\\d{1,2})(?!\\s*(?:mil|k|lucas?|lukas?|millon|millones|palos?|%|[.,]\\d|\\d))(?![\\p{L}\\p{N}])';
const RE_LAST_WEEK = '(?<![\\p{L}])(?:la\\s+)?semana\\s+pasada(?![\\p{L}])';

const MONTHS = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9,
  setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const WEEKDAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const SMALL = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15 };

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const onDay = (day, now) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());

function makeDate(day, month, year, today) {
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  let d = new Date(year ?? today.getFullYear(), month - 1, day);
  if (d.getDate() !== day) return null;
  if (year == null && d > today) d = new Date(today.getFullYear() - 1, month - 1, day);
  return d;
}

export function detectDate(cursor, now) {
  const today = startOfDay(now);
  const s = cursor.normalized;
  let m;
  if ((m = firstMatch(rx(RE_RELATIVE), s))) {
    const w = m[1].split(/\s+/).join(' ');
    const back = ['antes de ayer', 'antes de anoche', 'anteayer', 'antier'].includes(w) ? 2 : (w === 'anoche' || w === 'ayer') ? 1 : 0;
    return { date: onDay(addDays(today, -back), now), start: m.index, length: m[0].length };
  }
  if ((m = firstMatch(rx(RE_DAYS_AGO), s))) {
    const n = Number(m[1]) || SMALL[m[1]] || 1;
    let day;
    if (m[2].startsWith('semana')) day = addDays(today, -7 * n);
    else if (m[2].startsWith('mes')) day = new Date(today.getFullYear(), today.getMonth() - n, today.getDate());
    else day = addDays(today, -n);
    return { date: onDay(day, now), start: m.index, length: m[0].length };
  }
  if ((m = firstMatch(rx(RE_WEEKDAY), s))) {
    let diff = (today.getDay() - WEEKDAYS[m[1]] + 7) % 7;
    if (m[2] && diff === 0) diff = 7;
    return { date: onDay(addDays(today, -diff), now), start: m.index, length: m[0].length };
  }
  if ((m = firstMatch(rx(RE_MONTH), s))) {
    const d = makeDate(Number(m[1]), MONTHS[m[2]], m[3] ? Number(m[3]) : null, today);
    if (d) return { date: onDay(d, now), start: m.index, length: m[0].length };
  }
  if ((m = firstMatch(rx(RE_NUMERIC_DATE), s))) {
    let year = m[3] ? Number(m[3]) : null;
    if (year != null && year < 100) year += 2000;
    const d = makeDate(Number(m[1]), Number(m[2]), year, today);
    if (d) return { date: onDay(d, now), start: m.index, length: m[0].length };
  }
  if ((m = firstMatch(rx(RE_DAY_OF_MONTH), s))) {
    const dayN = Number(m[1]);
    if (dayN >= 1 && dayN <= 31) {
      let d = new Date(today.getFullYear(), today.getMonth(), dayN);
      if (d.getDate() === dayN) {
        if (d > today) d = new Date(today.getFullYear(), today.getMonth() - 1, dayN);
        return { date: onDay(d, now), start: m.index, length: m[0].length };
      }
    }
  }
  if ((m = firstMatch(rx(RE_LAST_WEEK), s))) {
    return { date: onDay(addDays(today, -7), now), start: m.index, length: m[0].length };
  }
  return null;
}

// ---------------------------------------------------------------- Descripción

const LEADING = ['me pagaron', 'me consignaron', 'me transfirieron', 'me depositaron', 'me enviaron', 'me mandaron',
  'me dieron', 'me devolvieron', 'me regalaron', 'me cobraron', 'me llego', 'me costo', 'me salio'];
const EDGE = new Set(['gaste', 'pague', 'compre', 'pedi', 'tanquee', 'fue', 'fueron', 'costo', 'costaron', 'salio',
  'salieron', 'vale', 'valio', 'en', 'de', 'del', 'el', 'la', 'los', 'las', 'por', 'para', 'un', 'una', 'unos', 'unas',
  'me', 'mi', 'mis', 'y', 'e', 'a', 'al', 'lo', 'que', 'se', 'con', 'pesos', 'peso', 'dolares', 'dolar', 'hoy', 'valor',
  'le', 'les', 'recibi', 'cobre', 'gane', 'gastamos', 'pagamos', 'compramos', 'o']);

export function cleanNote(text) {
  const ws = text.split(/\s+/).filter(Boolean);
  let changed = true;
  while (changed && ws.length) {
    changed = false;
    const lead = ws.slice(0, 3).map(key).join(' ');
    const phrase = LEADING.find((p) => lead === p || lead.startsWith(p + ' '));
    if (phrase) { ws.splice(0, phrase.split(' ').length); changed = true; continue; }
    if (ws.length && (EDGE.has(key(ws[0])) || key(ws[0]) === '')) { ws.shift(); changed = true; continue; }
    if (ws.length && (EDGE.has(key(ws[ws.length - 1])) || key(ws[ws.length - 1]) === '')) { ws.pop(); changed = true; }
  }
  let note = ws.join(' ').replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '');
  if (note) note = note[0].toUpperCase() + note.slice(1);
  return note;
}

// ---------------------------------------------------------------- Etiquetas y separación

export function extractTags(text) {
  const src = text.normalize('NFC');
  const ms = [...src.matchAll(/#([\p{L}\p{N}_]+)/gu)];
  if (!ms.length) return { tags: [], rest: text };
  const tags = [];
  for (const m of ms) { const t = m[1].toLowerCase(); if (!tags.includes(t)) tags.push(t); }
  const cur = new TextCursor(src);
  for (const m of ms) cur.remove(m.index, m[0].length);
  return { tags, rest: cur.remainingOriginal };
}

const SEPARATOR = '\\s*[;\\n+]\\s*|\\s*,\\s+|,(?=\\s*\\p{L})|\\s+(?:y|e|tambien|ademas|luego|despues|mas aparte)\\s+';
const hasStrongAmount = (norm) => amountCandidates(norm).some((c) => c.isDigit || c.hasMultiplier);

export function split(text) {
  const { orig, norm } = aligned(text);
  if (orig.length !== norm.length) return [text];
  const seps = allMatches(SEPARATOR, norm);
  if (!seps.length) return [text];
  const pieces = [];
  let cursor = 0;
  for (const sp of seps) { pieces.push([cursor, sp.index - cursor]); cursor = sp.index + sp[0].length; }
  pieces.push([cursor, norm.length - cursor]);
  const groups = [];
  let pending = null;
  for (const [start, len] of pieces) {
    if (hasStrongAmount(norm.slice(start, start + len))) {
      const s = pending ?? start;
      groups.push([s, start + len - s]);
      pending = null;
    } else if (pending == null) pending = start;
  }
  if (pending != null) {
    const last = groups.pop();
    if (last) groups.push([last[0], norm.length - last[0]]);
    else groups.push([pending, norm.length - pending]);
  }
  if (groups.length <= 1) return [text];
  return groups.map(([s, l]) => orig.slice(s, s + l).trim()).filter(Boolean);
}

// ---------------------------------------------------------------- Cuentas

// "con nequi", "desde mi cuenta de bancolombia", "a mi nequi", "en efectivo", "tarjeta davivienda"
const ACCOUNT_LEAD = '(?:(?:con|por|desde|de|del|en|a|al|via|para)\\s+)?(?:(?:mi|la|el)\\s+)?(?:(?:cuenta|tarjeta|app)\\s+(?:de\\s+)?)?';
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** accounts: [{id, keywords:[normalizadas]}] → {id, start, length} de la cuenta mencionada. */
export function detectAccount(norm, accounts = []) {
  let best = null;
  for (const a of accounts) {
    for (const k of a.keywords) {
      if (!k) continue;
      const kw = k.split(' ').map(escapeRx).join('\\s+');
      for (const m of allMatches(`(?<![\\p{L}\\p{N}])${ACCOUNT_LEAD}${kw}(?![\\p{L}\\p{N}])`, norm)) {
        if (!best || k.length > best.klen) best = { id: a.id, klen: k.length, start: m.index, length: m[0].length };
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------- API

function parseSegment(text, matchers, learned, now, accounts) {
  const cur = new TextCursor(text);
  let fullNorm = cur.normalized;
  const e = { amount: null, kind: detectKind(fullNorm), categoryId: null, date: null, note: '', tags: [], currency: null, hadMultiplier: false, accountId: null };
  const d = detectDate(cur, now);
  if (d) { e.date = d.date; cur.remove(d.start, d.length); }
  const acc = detectAccount(cur.normalized, accounts);
  if (acc) {
    e.accountId = acc.id;
    cur.remove(acc.start, acc.length);
    fullNorm = fullNorm.slice(0, acc.start) + ' '.repeat(acc.length) + fullNorm.slice(acc.start + acc.length);
  }
  const best = pickBest(amountCandidates(cur.normalized));
  if (best) {
    e.amount = best.value;
    e.currency = best.currency;
    e.hadMultiplier = best.hasMultiplier;
    for (const [s, l] of best.ranges) cur.remove(s, l);
  }
  const cat = detectCategory(fullNorm, matchers, learned, e.kind);
  e.categoryId = cat ? cat.id : null;
  if (!e.kind && cat && cat.kind === 'income') e.kind = 'income';
  e.note = cleanNote(cur.remainingOriginal);
  return e;
}

/** Devuelve una lista de movimientos (normalmente uno). */
export function parse(text, matchers, learned = {}, now = new Date(), accounts = []) {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];
  const { tags, rest } = extractTags(trimmed);
  const entries = split(rest).map((seg) => parseSegment(seg, matchers, learned, now, accounts));
  const shared = entries.find((e) => e.date)?.date;
  if (shared) for (const e of entries) if (!e.date) e.date = shared;
  const sharedAcc = entries.find((e) => e.accountId)?.accountId;
  if (sharedAcc) for (const e of entries) if (!e.accountId) e.accountId = sharedAcc;
  let lastThousands = false;
  for (const e of entries) {
    if (e.amount != null) {
      if (!e.hadMultiplier && lastThousands && e.amount < 1000 && Number.isInteger(e.amount)) e.amount *= 1000;
      lastThousands = e.hadMultiplier && e.amount >= 1000;
    }
  }
  for (const e of entries) e.tags = tags;
  return entries.filter((e) => e.amount != null || e.note || e.categoryId || e.tags.length || e.accountId);
}

// ---------------------------------------------------------------- Pagos de Apple Pay (Atajos)

/**
 * Líneas que copia la automatización de Atajos al pagar con Apple Pay:
 *   RINDE|<importe>|<comercio>|<tarjeta>|<fecha ISO opcional>
 * Devuelve un movimiento por línea válida; `key` es la línea exacta (para no registrarla dos veces).
 */
export function parseWalletPayments(text, matchers, learned = {}, accounts = [], now = new Date()) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    const parts = line.split('|').map((x) => x.trim());
    if (parts.length < 3 || key(parts[0]) !== 'rinde') continue;
    const [, rawAmount, merchant = '', card = '', rawDate = ''] = parts;
    const best = pickBest(amountCandidates(aligned(rawAmount).norm));
    if (!best || !(best.value > 0)) continue;
    const refund = /^[^\d]*[-−]/.test(rawAmount);
    const kind = refund ? 'income' : 'expense';
    const cat = detectCategory(key(merchant), matchers, learned, kind);
    const acc = detectAccount(key(card), accounts) || detectAccount(key(merchant), accounts);
    const t = Date.parse(rawDate);
    const date = Number.isFinite(t) && t <= now.getTime() + 60e3 ? new Date(t) : now;
    const name = merchant || 'Pago con Apple Pay';
    out.push({ key: line, amount: best.value, currency: best.currency, kind, categoryId: cat ? cat.id : null,
      accountId: acc ? acc.id : null, date, note: refund ? `Devolución ${name}` : name, card });
  }
  return out;
}

// ---------------------------------------------------------------- Recibos

const RECEIPT_AMOUNT = "(?<![\\p{L}\\p{N}.,])\\$?\\s?(\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d+[.,]\\d{2}|\\d{3,})(?![\\p{N}])";
const STRONG_TOTAL = ['total a pagar', 'total pagar', 'valor total', 'gran total', 'total neto', 'total venta', 'valor a pagar', 'total factura', 'neto a pagar'];
const NOT_TOTAL = ['subtotal', 'sub total', 'total items', 'total articulos', 'total unidades', 'total iva', 'total impuesto', 'total descuento', 'total ahorro', 'total base', 'total productos'];
const NO_AMOUNT = ['nit', 'tel', 'cel', 'cufe', 'resolucion', 'autoriza', 'efectivo', 'cambio', 'recibido', 'vuelto', 'telefono', 'factura no', 'consecutivo', 'cajero', 'caja', 'mesa', 'pos'];
const NO_MERCHANT = ['factura', 'nit', 'fecha', 'direccion', 'dir', 'tel', 'cel', 'ticket', 'recibo', 'caja', 'cajero', 'mesa', 'bienvenido', 'regimen', 'iva', 'www', 'http', 'cufe', 'resolucion', 'cliente', 'hora', 'pedido', 'orden'];

export function receiptAmounts(line) {
  return allMatches(RECEIPT_AMOUNT, line).map((m) => parseNumberLiteral(m[1])).filter((v) => v > 0);
}

function prettify(line) {
  const letters = [...line].filter((c) => /\p{L}/u.test(c)).join('');
  if (!letters || letters !== letters.toUpperCase()) return line;
  return line.split(' ').map((w) => (w.includes('.') || w.length <= 2 || /\d/.test(w)) ? w : w[0] + w.slice(1).toLowerCase()).join(' ');
}

export function parseReceipt(text, matchers, learned = {}, now = new Date()) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const res = { total: null, merchant: null, date: null, categoryId: null };
  if (!lines.length) return res;
  const norms = lines.map((l) => aligned(l).norm);

  const strong = []; const weak = [];
  norms.forEach((line, i) => {
    if (!line.includes('total') || NOT_TOTAL.some((x) => line.includes(x))) return;
    let vals = receiptAmounts(line);
    if (!vals.length && i + 1 < norms.length) vals = receiptAmounts(norms[i + 1]);
    const v = vals[vals.length - 1];
    if (v == null) return;
    (STRONG_TOTAL.some((x) => line.includes(x)) ? strong : weak).push(v);
  });
  if (strong.length) res.total = Math.max(...strong);
  else if (weak.length) res.total = Math.max(...weak);
  else {
    const all = norms.filter((l) => !NO_AMOUNT.some((x) => l.includes(x))).flatMap(receiptAmounts).filter((v) => v < 1e8);
    if (all.length) res.total = Math.max(...all);
  }

  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const line = lines[i];
    const letters = [...line].filter((c) => /\p{L}/u.test(c)).length;
    if (line.length < 3 || letters / line.length <= 0.5) continue;
    const ws = new Set(words(norms[i]));
    if (NO_MERCHANT.some((x) => ws.has(x))) continue;
    res.merchant = prettify(line);
    break;
  }

  const earliest = addDays(now, -400); const latest = addDays(now, 1);
  for (const l of norms) {
    let m = /(?<!\d)(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})(?!\d)/.exec(l);
    let y, mo, d;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?!\d)/.exec(l))) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
    else continue;
    if (d < 1 || d > 31 || mo < 1 || mo > 12) continue;
    const dt = new Date(y, mo - 1, d, now.getHours(), now.getMinutes());
    if (dt >= earliest && dt <= latest) { res.date = dt; break; }
  }

  const cat = detectCategory(aligned(res.merchant || '').norm, matchers, learned, 'expense') ||
              detectCategory(norms.join(' '), matchers, learned, 'expense');
  res.categoryId = cat ? cat.id : null;
  return res;
}
