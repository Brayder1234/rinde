// Resumen y recomendaciones del mes, siempre comparando con tus ingresos.
// Reglas de finanzas personales (50/30/20 y topes sanos por categoría); todo corre en el teléfono.
import * as M from './money.js';

/** Lo básico (necesidades); el resto de categorías cuenta como gustos. */
const NEEDS = new Set(['groceries', 'transport', 'fuel', 'home', 'utilities', 'telecom', 'health', 'education', 'pets', 'debt']);

/** Tope sano de cada categoría como parte de tus ingresos (salud y educación no tienen tope). */
const LIMITS = { food: 0.10, groceries: 0.15, transport: 0.10, fuel: 0.08, home: 0.30, utilities: 0.08, telecom: 0.05,
  fun: 0.07, subscriptions: 0.03, clothing: 0.05, shopping: 0.07, care: 0.04, travel: 0.08, gifts: 0.04, debt: 0.25,
  other: 0.08, pets: 0.05 };

const ADVICE = {
  food: 'Cocinar en casa dos o tres días más por semana y llevar almuerzo hace una gran diferencia.',
  groceries: 'Haz lista antes de ir al mercado y compara precios en tiendas de descuento.',
  transport: 'Revisa cuántos viajes en taxi o app podrías hacer en transporte público o compartidos.',
  fuel: 'Agrupa tus vueltas en un solo recorrido y revisa la presión de las llantas.',
  home: 'Si el arriendo pasa del 30 % de tus ingresos, considera compartir gastos o negociar al renovar.',
  utilities: 'Desconecta lo que no uses, cambia a bombillos LED y revisa que no haya fugas de agua.',
  telecom: 'Compara planes: muchas veces pagas por datos o canales que no usas.',
  fun: 'Ponte un tope semanal para salidas y alterna con planes gratis.',
  subscriptions: 'Revisa tus suscripciones y cancela las que no usaste este mes.',
  clothing: 'Antes de comprar ropa espera 48 horas: si todavía la quieres, cómprala.',
  shopping: 'Evita las compras por impulso: deja el producto en el carrito un día antes de pagar.',
  care: 'Espacia un poco más los servicios de cuidado personal o busca paquetes.',
  travel: 'Planea los viajes con tiempo y ahorra para ellos cada mes con una meta.',
  gifts: 'Define al comienzo del mes cuánto vas a gastar en regalos.',
  debt: 'Tus deudas pesan mucho: prioriza pagar la de mayor interés y evita nuevas cuotas.',
  other: 'Mucho quedó en “Otros”: clasifícalo para entender mejor a dónde va tu plata.',
  pets: 'Compara precios de comida y servicios para tu mascota.',
};

const LEVEL = { bad: 0, warn: 1, info: 2, good: 3 };
const pct = (x) => Math.round(x * 100);
const sum = (ms) => ms.reduce((t, m) => t + m.main, 0);

/**
 * movements/categories/goals: datos de la app; p: periodo; fmt: formatea montos.
 * Devuelve cifras del periodo, recomendaciones ordenadas y un presupuesto sugerido.
 */
export function monthReport({ movements, categories, goals = [], p, now = new Date(), fmt = (v) => String(Math.round(v)) }) {
  const inP = (per) => movements.filter((m) => M.inPeriod(per, new Date(m.date)));
  const ms = inP(p);
  const expenses = ms.filter((m) => m.kind === 'expense');
  const spent = sum(expenses);
  const income = sum(ms.filter((m) => m.kind === 'income'));
  const partial = M.inPeriod(p, now);
  const prevP = M.shiftPeriod(p, -1);
  const prevName = M.periodTitle(prevP).toLowerCase();

  // Base: lo que ganaste en el periodo o, si aún no hay ingresos, tu promedio reciente.
  let base = income; let incomeNote = null;
  if (base <= 0) {
    const past = [1, 2, 3].map((i) => sum(inP(M.shiftPeriod(p, -i)).filter((m) => m.kind === 'income'))).filter((v) => v > 0);
    if (past.length) {
      base = past.reduce((a, b) => a + b, 0) / past.length;
      incomeNote = `Aún no registras ingresos en este periodo, así que uso tu promedio: ${fmt(base)}.`;
    }
  }

  const report = { p, partial, income, base, incomeNote, spent, saving: base - spent, hasData: spent > 0 || income > 0,
    needs: 0, wants: 0, tips: [], suggestedBudget: 0 };
  if (base <= 0) {
    if (report.hasData) {
      report.tips.push({ level: 'info', icon: '💼', title: 'Registra tus ingresos',
        text: 'Anota tu salario, ventas u otros ingresos para que pueda compararlos con tus gastos y darte recomendaciones.' });
    }
    return report;
  }

  // Gastos por categoría y por grupo
  const catOf = (id) => categories.find((c) => c.id === id);
  const byCat = new Map();
  for (const m of expenses) {
    const c = catOf(m.catId);
    const k = c?.id ?? '';
    const e = byCat.get(k) || { id: c?.id ?? null, key: c?.key || '', name: c?.name ?? 'Sin categoría', budget: c?.budget || 0, total: 0 };
    e.total += m.main;
    byCat.set(k, e);
    if (NEEDS.has(c?.key)) report.needs += m.main; else report.wants += m.main;
  }
  const prevByCat = new Map();
  for (const m of inP(prevP)) if (m.kind === 'expense') prevByCat.set(m.catId ?? '', (prevByCat.get(m.catId ?? '') || 0) + m.main);

  const tips = report.tips;
  const saving = report.saving; const rate = saving / base;

  // 1) Ahorro
  if (saving < 0) {
    tips.push({ level: 'bad', icon: '⚠️', title: partial ? 'Vas gastando más de lo que ganas' : 'Gastaste más de lo que ganaste',
      text: `Tus gastos superan tus ingresos por ${fmt(-saving)}. Revisa los gastos más grandes y evita cubrir la diferencia con tarjeta de crédito.` });
  } else if (rate < 0.1) {
    tips.push({ level: 'warn', icon: '🐷', title: partial ? 'Te está quedando poco para ahorrar' : 'Ahorraste poco',
      text: `Te ${partial ? 'queda' : 'quedó'} el ${pct(rate)} % de tus ingresos (${fmt(saving)}). Lo sano es ahorrar entre 10 % y 20 %: aparta ese dinero apenas te paguen.` });
  } else if (rate < 0.2) {
    tips.push({ level: 'info', icon: '👍', title: partial ? 'Vas bien con el ahorro' : 'Buen ahorro',
      text: `${partial ? 'Llevas' : 'Ahorraste'} el ${pct(rate)} % de tus ingresos. Si llegas al 20 % (${fmt(base * 0.2)} al mes), en un año tendrías ${fmt(base * 0.2 * 12)}.` });
  } else {
    tips.push({ level: 'good', icon: '🎉', title: partial ? '¡Vas excelente!' : '¡Excelente mes!',
      text: `${partial ? 'Llevas ahorrado' : 'Ahorraste'} el ${pct(rate)} % de tus ingresos (${fmt(saving)}). Sigue así.` });
  }

  // 2) Categorías por encima de su tope sano
  const over = [...byCat.values()]
    .map((c) => ({ ...c, limit: LIMITS[c.key], share: c.total / base }))
    .filter((c) => c.limit && c.share > c.limit + 0.01 && c.total - c.limit * base >= base * 0.01)
    .sort((a, b) => (b.total - b.limit * base) - (a.total - a.limit * base));
  const flagged = new Set();
  for (const c of over.slice(0, 3)) {
    flagged.add(c.id);
    const excess = c.total - c.limit * base;
    let text = `Se llevó el ${pct(c.share)} % de tus ingresos (${fmt(c.total)}); lo recomendable es hasta el ${pct(c.limit)} %. `
      + `Si lo bajas a ${fmt(c.limit * base)} ahorrarías ${fmt(excess)} al mes. ${ADVICE[c.key] || ''}`;
    if (c.budget > 0 && c.total > c.budget) text += ` Además te pasaste de tu presupuesto de ${fmt(c.budget)}.`;
    tips.push({ level: c.share >= c.limit * 2 ? 'bad' : 'warn', icon: '🔍',
      title: `${partial ? 'Vas gastando' : 'Gastaste'} mucho en ${c.name}`, text: text.trim(), catId: c.id,
      suggest: Math.round((c.limit * base) / 1000) * 1000 });
  }

  // 3) Presupuestos por categoría superados (que no salieron arriba)
  for (const c of byCat.values()) {
    if (c.budget > 0 && c.total > c.budget && !flagged.has(c.id)) {
      tips.push({ level: 'warn', icon: '🎯', title: `Te pasaste del presupuesto de ${c.name}`,
        text: `Tenías ${fmt(c.budget)} y ${partial ? 'llevas' : 'gastaste'} ${fmt(c.total)} (${fmt(c.total - c.budget)} de más).`, catId: c.id });
    }
  }

  // 4) Regla 50/30/20
  const wantsShare = report.wants / base; const needsShare = report.needs / base;
  if (wantsShare > 0.3) {
    tips.push({ level: 'warn', icon: '🛍️', title: 'Los gustos se llevan mucho',
      text: `Restaurantes, salidas, compras y suscripciones suman el ${pct(wantsShare)} % de tus ingresos. Lo recomendado es hasta el 30 %.` });
  }
  if (needsShare > 0.6) {
    tips.push({ level: 'info', icon: '🏠', title: 'Tus gastos básicos son altos',
      text: `Arriendo, mercado, servicios y transporte se llevan el ${pct(needsShare)} % de tus ingresos (lo ideal es cerca del 50 %). Un ahorro ahí se nota todos los meses.` });
  }

  // 5) Comparación con el periodo anterior (solo con el mes completo)
  if (!partial) {
    const changes = [...byCat.values()].map((c) => ({ ...c, prev: prevByCat.get(c.id ?? '') || 0 }));
    const up = changes.filter((c) => c.prev > 0 && c.total >= c.prev * 1.3 && c.total - c.prev >= base * 0.03 && !flagged.has(c.id))
      .sort((a, b) => (b.total - b.prev) - (a.total - a.prev))[0];
    if (up) {
      tips.push({ level: 'warn', icon: '📈', title: `${up.name} subió`,
        text: `Gastaste ${pct(up.total / up.prev - 1)} % más que en ${prevName} (${fmt(up.total - up.prev)} más).`, catId: up.id });
    }
    const down = [...prevByCat.entries()].map(([id, prev]) => ({ id, prev, total: byCat.get(id)?.total || 0,
      name: catOf(id)?.name ?? 'Sin categoría' }))
      .filter((c) => c.prev > 0 && c.total <= c.prev * 0.75 && c.prev - c.total >= base * 0.03)
      .sort((a, b) => (b.prev - b.total) - (a.prev - a.total))[0];
    if (down) {
      tips.push({ level: 'good', icon: '📉', title: `Bien: bajaste ${down.name}`,
        text: `Gastaste ${pct(1 - down.total / down.prev)} % menos que en ${prevName} (${fmt(down.prev - down.total)} menos).` });
    }
  }

  // 6) Gastos hormiga
  const small = expenses.filter((m) => m.main <= base * 0.01);
  const smallTotal = sum(small);
  if (small.length >= 12 && smallTotal >= base * 0.05) {
    tips.push({ level: 'warn', icon: '🐜', title: 'Gastos hormiga',
      text: `Hiciste ${small.length} compras pequeñas que suman ${fmt(smallTotal)} (${pct(smallTotal / base)} % de tus ingresos). Parecen poco, pero juntas pesan.` });
  }

  // 7) Metas: dale un empujón con lo ahorrado
  const open = goals.filter((g) => !g.archived && g.target > (g.contribs || []).reduce((t, c) => t + c.amount, 0));
  if (saving > 0 && open.length) {
    const g = open[0];
    const missing = g.target - (g.contribs || []).reduce((t, c) => t + c.amount, 0);
    tips.push({ level: 'info', icon: '⭐', title: `Empuja tu meta “${g.name}”`,
      text: `Con lo que ${partial ? 'llevas ahorrado' : 'ahorraste'} podrías aportarle ${fmt(Math.min(saving * 0.5, missing))}.`, goalId: g.id });
  }

  tips.sort((a, b) => LEVEL[a.level] - LEVEL[b.level]);
  report.suggestedBudget = Math.round((base * 0.8) / 1000) * 1000;
  return report;
}
