// Gráficas en SVG (sin librerías, funcionan sin internet).

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Dona: slices [{value, color}] */
export function donut(slices, { size = 220, thickness = 0.14, center = '', sub = 'Total' } = {}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const r = size / 2;
  const inner = r * (1 - thickness);
  let paths = '';
  if (total <= 0) {
    paths = `<circle cx="${r}" cy="${r}" r="${(r + inner) / 2}" fill="none" stroke="var(--line-2)" stroke-width="${r - inner}"/>`;
  } else if (slices.length === 1) {
    paths = `<circle cx="${r}" cy="${r}" r="${(r + inner) / 2}" fill="none" stroke="${slices[0].color}" stroke-width="${r - inner}"/>`;
  } else {
    let a0 = -Math.PI / 2;
    const gap = Math.min(0.045, 0.6 / slices.length);
    for (const s of slices) {
      const ang = (s.value / total) * Math.PI * 2;
      const a1 = a0 + ang;
      const g = ang > gap * 3 ? gap : 0;
      const s0 = a0 + g / 2; const s1 = a1 - g / 2;
      const large = s1 - s0 > Math.PI ? 1 : 0;
      const p = (rad, a) => `${(r + rad * Math.cos(a)).toFixed(2)} ${(r + rad * Math.sin(a)).toFixed(2)}`;
      paths += `<path fill="${s.color}" d="M${p(r, s0)} A${r} ${r} 0 ${large} 1 ${p(r, s1)} L${p(inner, s1)} A${inner} ${inner} 0 ${large} 0 ${p(inner, s0)}Z"/>`;
      a0 = a1;
    }
  }
  return `<div class="donut" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${paths}</svg>
    <div class="donut-center"><small>${esc(sub)}</small><b>${esc(center)}</b></div></div>`;
}

function axisLabels(max, fmt, h, pad, W = 340) {
  const steps = [0, 0.5, 1];
  return steps.map((t) => {
    const y = h - pad - t * (h - pad * 2);
    return `<line x1="44" x2="${W}" y1="${y}" y2="${y}" class="grid"/><text x="40" y="${y + 4}" class="ylabel" text-anchor="end">${esc(fmt(max * t))}</text>`;
  }).join('');
}

/** Barras agrupadas: groups [{label, values:[v1,v2]}], colors [c1,c2] */
export function bars(groups, colors, fmt, { height = 190 } = {}) {
  const max = Math.max(1, ...groups.flatMap((g) => g.values));
  const W = 340; const pad = 18; const left = 48; const bottom = 22;
  const innerW = W - left - 6;
  const gw = innerW / groups.length;
  const bw = Math.min(9, (gw - 14) / groups[0].values.length);
  let out = '';
  groups.forEach((g, i) => {
    const cx = left + gw * i + gw / 2;
    g.values.forEach((v, j) => {
      const hgt = ((height - bottom - pad) * v) / max;
      const x = cx - (bw * g.values.length) / 2 + j * bw;
      out += `<rect x="${x.toFixed(1)}" y="${(height - bottom - hgt).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(hgt, 0).toFixed(1)}" rx="2" fill="${colors[j]}"/>`;
    });
    out += `<text x="${cx}" y="${height - 6}" class="xlabel" text-anchor="middle">${esc(g.label)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${height}">${axisLabels(max, fmt, height - bottom + pad, pad)}${out}</svg>`;
}

/** Barras por día con línea de promedio. */
export function daily(values, labels, avg, fmt, color, { height = 160 } = {}) {
  const max = Math.max(1, ...values, avg);
  const W = 340; const pad = 14; const left = 48; const bottom = 20;
  const innerW = W - left - 4;
  const bw = innerW / Math.max(values.length, 1);
  let out = '';
  values.forEach((v, i) => {
    const hgt = ((height - bottom - pad) * v) / max;
    out += `<rect x="${(left + i * bw + 1).toFixed(1)}" y="${(height - bottom - hgt).toFixed(1)}" width="${Math.max(bw - 2, 1).toFixed(1)}" height="${hgt.toFixed(1)}" rx="2" fill="${color}"/>`;
    if (labels[i]) out += `<text x="${(left + i * bw + bw / 2).toFixed(1)}" y="${height - 5}" class="xlabel" text-anchor="middle">${esc(labels[i])}</text>`;
  });
  if (avg > 0) {
    const y = height - bottom - ((height - bottom - pad) * avg) / max;
    out += `<line x1="${left}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--ink)" stroke-opacity=".55" stroke-width="1" stroke-dasharray="3 4"/>`;
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${height}">${axisLabels(max, fmt, height - bottom + pad, pad)}${out}</svg>`;
}

/** Línea con área: points [{label, value}] */
export function line(points, color, fmt, { height = 170 } = {}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const W = 340; const pad = 16; const left = 52; const bottom = 22;
  const innerW = W - left - 16;
  const xy = points.map((p, i) => [left + (innerW * i) / Math.max(points.length - 1, 1),
    height - bottom - ((height - bottom - pad) * p.value) / max]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${d} L${xy[xy.length - 1][0].toFixed(1)} ${height - bottom} L${xy[0][0].toFixed(1)} ${height - bottom}Z`;
  let out = `<path d="${area}" fill="${color}" opacity="0.07"/><path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`;
  xy.forEach(([x, y], i) => {
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="var(--bg)" stroke="${color}" stroke-width="1.6"/>`;
    out += `<text x="${x.toFixed(1)}" y="${height - 6}" class="xlabel" text-anchor="middle">${esc(points[i].label)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${height}">${axisLabels(max, fmt, height - bottom + pad, pad)}${out}</svg>`;
}
