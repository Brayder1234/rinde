// Pruebas del analizador (mismas de la app nativa). Ejecutar: node tests/parser.test.mjs
import { parse, parseNumberLiteral, parseReceipt, key } from '../js/parser.js';
import { SEED } from '../js/catalog.js';
import { periodContaining, shiftPeriod, daysLeft, occurrence, fmt, compact } from '../js/money.js';

let passed = 0; let failed = 0;
const check = (cond, msg) => { if (cond) passed++; else { failed++; console.log('✗', msg); } };

process.env.TZ = 'America/Bogota';
const now = new Date(2026, 8, 24, 15, 30); // miércoles 24 sep 2026
const matchers = SEED.map((s) => ({ id: s.key, kind: s.kind, keywords: [...s.keywords, key(s.name)] }));
const k = (e) => e?.categoryId ?? 'nil';
const day = (d) => (d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : 'nil');
const p = (s, learned = {}) => parse(s, matchers, learned, now);
const one = (s) => p(s)[0] || {};

check(parseNumberLiteral('25.000') === 25000, '25.000');
check(parseNumberLiteral('25,000') === 25000, '25,000');
check(parseNumberLiteral('12,50') === 12.5, '12,50');
check(parseNumberLiteral('12.5') === 12.5, '12.5');
check(parseNumberLiteral('1.500.000') === 1500000, '1.500.000');
check(parseNumberLiteral('45.900,50') === 45900.5, '45.900,50');
check(parseNumberLiteral('45,900.50') === 45900.5, '45,900.50');

let e = one('almuerzo 25 mil');
check(e.amount === 25000 && k(e) === 'food' && e.note === 'Almuerzo', `almuerzo 25 mil ${JSON.stringify(e)}`);
e = one('Uber 12.500'); check(e.amount === 12500 && k(e) === 'transport' && e.note === 'Uber', 'uber');
e = one('gasté 20 lucas en el mercado'); check(e.amount === 20000 && k(e) === 'groceries' && e.note === 'Mercado', `lucas ${JSON.stringify(e)}`);
e = one('me pagaron 2 palos'); check(e.amount === 2e6 && e.kind === 'income' && k(e) === 'salary', 'palos');
e = one('medio millón de arriendo'); check(e.amount === 500000 && k(e) === 'home', 'medio millón');
e = one('veinte mil de taxi'); check(e.amount === 20000 && k(e) === 'transport', 'veinte mil');
e = one('treinta y cinco mil en cine'); check(e.amount === 35000 && k(e) === 'fun', `35 mil ${JSON.stringify(e)}`);
e = one('1,5 millones de salario'); check(e.amount === 1.5e6 && e.kind === 'income', '1,5 millones');
e = one('1 millón 200 mil de arriendo'); check(e.amount === 1.2e6, `1 millón 200 mil ${e.amount}`);
e = one('$45.900 Éxito'); check(e.amount === 45900 && k(e) === 'groceries' && e.note === 'Éxito', `éxito ${JSON.stringify(e)}`);
e = one('2 empanadas 5 mil'); check(e.amount === 5000 && k(e) === 'food', 'empanadas');
e = one('netflix 12 dólares'); check(e.amount === 12 && e.currency === 'USD' && k(e) === 'subscriptions', 'netflix usd');
e = one('15k tinto y pandebono'); check(e.amount === 15000 && k(e) === 'food', `15k ${JSON.stringify(e)}`);

e = one('almuerzo 18 mil ayer'); check(day(e.date) === '2026-9-23' && e.note === 'Almuerzo', `ayer ${day(e.date)}`);
e = one('antier gasolina 80 mil'); check(day(e.date) === '2026-9-22' && k(e) === 'fuel', 'antier');
e = one('el lunes mercado 120 mil'); check(day(e.date) === '2026-9-21', `lunes ${day(e.date)}`);
e = one('hace 3 días farmacia 30 mil'); check(day(e.date) === '2026-9-21' && k(e) === 'health', 'hace 3 días');
e = one('luz 95 mil el 5'); check(day(e.date) === '2026-9-5' && e.amount === 95000 && k(e) === 'utilities', `el 5 ${day(e.date)} ${e.amount}`);
e = one('el 20 mil de propina'); check(e.date == null && e.amount === 20000, 'el 20 mil no es fecha');
e = one('arriendo 900 mil 01/09'); check(day(e.date) === '2026-9-1' && e.amount === 900000, '01/09');
e = one('regalo 50 mil 15 de diciembre'); check(day(e.date) === '2025-12-15', `15 dic ${day(e.date)}`);
e = one('taxi 10 mil'); check(e.date == null, 'sin fecha');

let list = p('almuerzo 20 mil y taxi 12 mil');
check(list.length === 2 && list[0].amount === 20000 && k(list[0]) === 'food' && list[1].amount === 12000 && k(list[1]) === 'transport', 'dos movimientos');
list = p('ayer pagué 50 mil de luz y 80 de agua');
check(list.length === 2 && list[1].amount === 80000 && day(list[1].date) === '2026-9-23', 'hereda mil y fecha');
list = p('almuerzo y cena 40 mil'); check(list.length === 1 && list[0].amount === 40000, 'almuerzo y cena');
list = p('uber 12.500, tinto 3 mil, pan 4 mil'); check(list.length === 3, `tres ${list.length}`);

e = one('hotel 300 mil #viaje #Cartagena');
check(e.tags.join() === 'viaje,cartagena' && k(e) === 'travel' && e.note === 'Hotel', `tags ${JSON.stringify(e)}`);
e = one('vendí 3 camisetas por 90 mil'); check(e.kind === 'income' && e.amount === 90000 && k(e) === 'business', 'venta');
e = one('me consignaron 150 mil'); check(e.kind === 'income', 'consignaron');
e = one('quincena 1.800.000'); check(e.kind === 'income' && k(e) === 'salary', 'quincena');
e = one('me consignaron la quincena 1.200.000'); check(e.kind === 'income' && k(e) === 'salary', 'consignaron quincena');
list = p('taxi al aeropuerto 45 mil y propina 5 mil'); check(list.length === 2 && k(list[1]) === 'food', 'propina');
e = one('comida del perro 60 mil'); check(k(e) === 'pets', 'mascotas');
e = p('donas 10 mil', { donas: 'gifts' })[0]; check(k(e) === 'gifts', 'aprendido');

const receipt = `SUPERMERCADOS OLIMPICA S.A.
NIT 890.107.487-3
FACTURA ELECTRONICA DE VENTA
Fecha: 22/09/2026 18:42
ARROZ DIANA 1KG        4.590
LECHE ALQUERIA         5.200
HUEVOS AA X30         18.900
SUBTOTAL              28.690
IVA                    1.000
TOTAL A PAGAR         29.690
EFECTIVO              50.000
CAMBIO                20.310`;
const r = parseReceipt(receipt, matchers, {}, now);
check(r.total === 29690 && r.merchant === 'Supermercados Olimpica S.A.' && day(r.date) === '2026-9-22' && r.categoryId === 'groceries', `recibo ${JSON.stringify(r)}`);
const r2 = parseReceipt('Crepes & Waffles\nMesa 12\nCrepe pollo 32.900\nLimonada 9.800\nTotal $ 46.970', matchers, {}, now);
check(r2.total === 46970 && r2.categoryId === 'food', `recibo 2 ${JSON.stringify(r2)}`);

const per = periodContaining(now, 1);
check(day(per.start) === '2026-9-1' && day(per.end) === '2026-10-1', 'periodo mes');
const p25 = periodContaining(now, 25);
check(day(p25.start) === '2026-8-25' && day(p25.end) === '2026-9-25' && daysLeft(p25, now) === 1, 'periodo desde el 25');
check(day(shiftPeriod(per, -1).start) === '2026-8-1', 'periodo anterior');
const jan31 = new Date(2026, 0, 31);
check(day(occurrence('monthly', 1, jan31)) === '2026-2-28' && day(occurrence('monthly', 2, jan31)) === '2026-3-31', '31 de enero');

console.log('Formato:', fmt(25000, 'COP'), '|', fmt(12.5, 'USD', { isMain: false }), '|', compact(1250000, 'COP'), '|', compact(850000, 'COP'));
console.log(`\n${passed} pruebas OK, ${failed} fallas`);
process.exit(failed ? 1 : 0);
