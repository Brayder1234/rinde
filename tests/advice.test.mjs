// Pruebas de las recomendaciones del mes. Ejecutar: node tests/advice.test.mjs
import { monthReport } from '../js/advice.js';
import { periodContaining } from '../js/money.js';

let passed = 0; let failed = 0;
const check = (cond, msg) => { if (cond) passed++; else { failed++; console.log('✗', msg); } };

process.env.TZ = 'America/Bogota';
const cats = ['food', 'groceries', 'transport', 'home', 'fun', 'subscriptions', 'health', 'salary'].map((k) => ({ id: k, key: k, name: k, budget: 0 }));
let n = 0;
const mv = (kind, catId, main, y, m, d) => ({ id: String(n++), kind, catId, main, date: new Date(y, m - 1, d, 12).toISOString() });
const sep = periodContaining(new Date(2026, 8, 15), 1);
const afterSep = new Date(2026, 9, 3); // el mes ya cerró
const titles = (r) => r.tips.map((t) => t.title);

// Mes con restaurantes altos y ahorro bajo
const movs = [
  mv('income', 'salary', 3000000, 2026, 9, 1),
  mv('expense', 'home', 900000, 2026, 9, 2),
  mv('expense', 'groceries', 400000, 2026, 9, 5),
  mv('expense', 'food', 650000, 2026, 9, 10),
  mv('expense', 'fun', 200000, 2026, 9, 12),
  mv('expense', 'transport', 250000, 2026, 9, 20),
  mv('expense', 'health', 450000, 2026, 9, 21),
  // agosto: restaurantes mucho más bajos
  mv('income', 'salary', 3000000, 2026, 8, 1),
  mv('expense', 'food', 250000, 2026, 8, 10),
  mv('expense', 'fun', 400000, 2026, 8, 12),
];
let r = monthReport({ movements: movs, categories: cats, p: sep, now: afterSep });
check(r.base === 3000000 && r.spent === 2850000 && r.saving === 150000, `cifras ${r.base} ${r.spent} ${r.saving}`);
check(titles(r).includes('Gastaste mucho en food'), `restaurantes altos: ${titles(r)}`);
const food = r.tips.find((t) => t.title === 'Gastaste mucho en food');
check(food && food.text.includes('22\u00a0%') && food.text.includes('10\u00a0%') && food.catId === 'food', `texto restaurantes: ${food?.text}`);
check(titles(r).includes('Ahorraste poco'), `ahorro bajo: ${titles(r)}`);
check(!titles(r).some((t) => t.includes('health')), 'salud no se critica');
check(titles(r).includes('Bien: bajaste fun'), `bajó entretenimiento: ${titles(r)}`);
check(r.suggestedBudget === 2400000, `presupuesto sugerido ${r.suggestedBudget}`);
check(r.tips[0].level !== 'good', 'lo importante va primero');

// Déficit
r = monthReport({ movements: [mv('income', 'salary', 1000000, 2026, 9, 1), mv('expense', 'home', 1200000, 2026, 9, 2)], categories: cats, p: sep, now: afterSep });
check(r.tips[0].level === 'bad' && r.tips[0].title === 'Gastaste más de lo que ganaste', `déficit: ${titles(r)}`);

// Buen mes
r = monthReport({ movements: [mv('income', 'salary', 4000000, 2026, 9, 1), mv('expense', 'home', 1000000, 2026, 9, 2), mv('expense', 'groceries', 500000, 2026, 9, 3)], categories: cats, p: sep, now: afterSep });
check(titles(r).includes('¡Excelente mes!') && r.tips.length === 1, `buen mes: ${titles(r)}`);

// Sin ingresos este mes → usa el promedio anterior
r = monthReport({ movements: [mv('income', 'salary', 2000000, 2026, 8, 1), mv('expense', 'food', 300000, 2026, 9, 5)], categories: cats, p: sep, now: new Date(2026, 8, 20) });
check(r.base === 2000000 && r.incomeNote && r.partial, `promedio: ${r.base} ${r.incomeNote}`);
check(titles(r).includes('Vas gastando mucho en food'), `mes en curso: ${titles(r)}`);

// Sin ingresos nunca → pide registrarlos
r = monthReport({ movements: [mv('expense', 'food', 300000, 2026, 9, 5)], categories: cats, p: sep, now: afterSep });
check(r.tips.length === 1 && r.tips[0].title === 'Registra tus ingresos', `sin ingresos: ${titles(r)}`);

// Gastos hormiga
const ants = [mv('income', 'salary', 3000000, 2026, 9, 1)];
for (let i = 0; i < 15; i++) ants.push(mv('expense', 'food', 12000, 2026, 9, 2 + i));
r = monthReport({ movements: ants, categories: cats, p: sep, now: afterSep });
check(titles(r).includes('Gastos hormiga'), `hormiga: ${titles(r)}`);

// Meta con lo ahorrado
r = monthReport({ movements: [mv('income', 'salary', 3000000, 2026, 9, 1), mv('expense', 'home', 900000, 2026, 9, 2)], categories: cats,
  goals: [{ id: 'g', name: 'Viaje', target: 2000000, archived: false, contribs: [] }], p: sep, now: afterSep });
check(r.tips.some((t) => t.goalId === 'g'), `meta: ${titles(r)}`);

console.log(`\n${passed} pruebas OK, ${failed} fallas`);
process.exit(failed ? 1 : 0);
