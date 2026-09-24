// Formato de dinero, monedas y periodos de presupuesto.

export const LOCALE = 'es-CO';

const ZERO_DEC = new Set(['COP', 'CLP', 'PYG', 'JPY', 'KRW', 'VND', 'IDR', 'HUF', 'ISK', 'UGX', 'XAF', 'XOF',
  'KMF', 'RWF', 'GNF', 'BIF', 'DJF', 'VUV', 'TWD', 'CRC', 'ARS']);
const SYMBOLS = { COP: '$', MXN: '$', ARS: '$', CLP: '$', UYU: '$', USD: 'US$', CAD: 'CA$', EUR: '€', GBP: '£',
  PEN: 'S/', BRL: 'R$', PYG: '₲', BOB: 'Bs', VES: 'Bs.', CRC: '₡', GTQ: 'Q', HNL: 'L', NIO: 'C$', PAB: 'B/.',
  DOP: 'RD$', JPY: '¥', CNY: '¥', KRW: '₩', INR: '₹', TRY: '₺', ILS: '₪', PHP: '₱', THB: '฿', VND: '₫', UAH: '₴', NGN: '₦' };

export const CURRENCIES = ['COP', 'MXN', 'ARS', 'CLP', 'PEN', 'USD', 'EUR', 'BRL', 'UYU', 'PYG', 'BOB', 'VES', 'CRC',
  'GTQ', 'HNL', 'NIO', 'PAB', 'DOP', 'CUP', 'CAD', 'GBP', 'CHF', 'JPY', 'CNY', 'KRW', 'INR', 'AUD', 'NZD', 'SEK',
  'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'ILS', 'AED', 'SAR', 'QAR', 'KWD', 'EGP', 'MAD', 'ZAR', 'NGN',
  'KES', 'SGD', 'HKD', 'TWD', 'THB', 'MYR', 'IDR', 'PHP', 'VND', 'PKR', 'BDT', 'ISK', 'GEL', 'KZT', 'JMD', 'TTD'];

let names = null;
export function currencyName(code) {
  try {
    names ??= new Intl.DisplayNames(['es'], { type: 'currency' });
    const n = names.of(code);
    return n ? n[0].toUpperCase() + n.slice(1) : code;
  } catch { return code; }
}

export function currencyFlag(code) {
  if (code === 'EUR') return '🇪🇺';
  return [...code.slice(0, 2)].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join('');
}

export const fractionDigits = (code) => (ZERO_DEC.has(code) ? 0 : 2);

export function symbol(code, isMain = true) {
  const s = SYMBOLS[code];
  if (s) return isMain && code === 'USD' ? '$' : s;
  return code;
}

const nfCache = {};
function nf(decimals) {
  return (nfCache[decimals] ??= new Intl.NumberFormat(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
}

/** "$ 25.000" · "US$ 12,50" */
export function fmt(value, code, { isMain = true, signed = false } = {}) {
  const text = `${symbol(code, isMain)} ${nf(fractionDigits(code)).format(Math.abs(value))}`;
  if (signed && value > 0) return '+' + text;
  if (value < 0) return '−' + text;
  return text;
}

/** "$ 1,2 M", "$ 850 mil" */
export function compact(value, code) {
  const a = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (a < 10000) return sign + fmt(a, code);
  const short = (v) => new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(v);
  const text = a >= 999500 ? `${short(a / 1e6)} M` : `${short(Math.round(a / 1000))} mil`;
  return `${sign}${symbol(code)} ${text}`;
}

/** Números del campo de monto: "2400000" → "2.400.000" */
export function groupDigits(raw) {
  const [i, f] = raw.split(',');
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return f != null ? `${g},${f}` : g;
}

export function sanitizeAmount(text, code) {
  const decimals = fractionDigits(code);
  let int = ''; let frac = ''; let dec = false;
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') {
      if (dec) { if (frac.length < decimals) frac += ch; } else if (int.length < 12) int += ch;
    } else if (decimals > 0 && !dec && (ch === ',' || ch === '.')) dec = true;
  }
  int = int.replace(/^0+(?=\d)/, '');
  if (dec && !int) int = '0';
  return dec ? `${int},${frac}` : int;
}

export const amountValue = (raw) => (raw ? Number(raw.replace(',', '.')) : 0);

export function rawFromValue(v, code) {
  const d = fractionDigits(code);
  const r = d === 0 ? Math.round(v) : Math.round(v * 100) / 100;
  const i = Math.trunc(r);
  const f = Math.round(Math.abs(r - i) * 100);
  if (d === 0 || f === 0) return String(i);
  return `${i},${String(f).padStart(2, '0').replace(/0$/, '')}`;
}

// ---------------------------------------------------------------- Periodos

/** Periodo de presupuesto que contiene la fecha (el mes puede empezar otro día). */
export function periodContaining(date, startDay = 1) {
  const sd = Math.min(Math.max(startDay, 1), 28);
  let y = date.getFullYear(); let m = date.getMonth();
  if (date.getDate() < sd) { m -= 1; if (m < 0) { m = 11; y -= 1; } }
  const start = new Date(y, m, sd);
  const end = new Date(y, m + 1, sd);
  return { start, end, startDay: sd };
}

export const shiftPeriod = (p, n) => periodContaining(new Date(p.start.getFullYear(), p.start.getMonth() + n, p.startDay), p.startDay);
export const inPeriod = (p, d) => d >= p.start && d < p.end;
export const isCurrentPeriod = (p, now = new Date()) => inPeriod(p, now);

export function daysLeft(p, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today < p.start) return Math.round((p.end - p.start) / 864e5);
  return Math.max(Math.round((p.end - today) / 864e5), 1);
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function periodTitle(p) {
  if (p.startDay === 1) return cap(p.start.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' }));
  const last = new Date(p.end.getTime() - 1);
  const f = (d) => d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }).replace('.', '');
  return `${f(p.start)} – ${f(last)}`;
}

export function periodShort(p) {
  const opts = p.startDay === 1 ? { month: 'short' } : { day: 'numeric', month: 'short' };
  return p.start.toLocaleDateString(LOCALE, opts).replace('.', '');
}

// ---------------------------------------------------------------- Recurrentes

export const FREQUENCIES = {
  weekly: { title: 'Semanal', unit: 'day', n: 7, perMonth: 52 / 12 },
  biweekly: { title: 'Quincenal', unit: 'day', n: 14, perMonth: 26 / 12 },
  monthly: { title: 'Mensual', unit: 'month', n: 1, perMonth: 1 },
  bimonthly: { title: 'Bimestral', unit: 'month', n: 2, perMonth: 0.5 },
  quarterly: { title: 'Trimestral', unit: 'month', n: 3, perMonth: 1 / 3 },
  semiannual: { title: 'Semestral', unit: 'month', n: 6, perMonth: 1 / 6 },
  yearly: { title: 'Anual', unit: 'month', n: 12, perMonth: 1 / 12 },
};

/** Fecha de la ocurrencia número `i` desde el inicio (sin que el 31 se corra). */
export function occurrence(freq, i, start) {
  const f = FREQUENCIES[freq] || FREQUENCIES.monthly;
  const s = new Date(start);
  if (f.unit === 'day') return new Date(s.getFullYear(), s.getMonth(), s.getDate() + f.n * i, s.getHours(), s.getMinutes());
  const target = new Date(s.getFullYear(), s.getMonth() + f.n * i, 1, s.getHours(), s.getMinutes());
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(s.getDate(), lastDay));
  return target;
}
