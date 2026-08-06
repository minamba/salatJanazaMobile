const SHORT_MONTHS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
const LONG_MONTHS  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function getPeriodLabel(period, d) {
  if (period === 'jour') return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (period === 'semaine') {
    const dow   = (d.getDay() + 6) % 7;
    const start = new Date(d); start.setDate(d.getDate() - dow);
    const end   = new Date(start); end.setDate(start.getDate() + 6);
    return `Semaine du ${start.getDate()} ${SHORT_MONTHS[start.getMonth()]} au ${end.getDate()} ${SHORT_MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  }
  if (period === 'mois') return `${LONG_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return `Année ${d.getFullYear()}`;
}

function buildSeriesSvg(series, color) {
  if (!series?.length) return '<p class="empty">Aucune donnée</p>';
  const VW = 500, chartH = 130, padL = 36, padB = 36;
  const VH = chartH + padB;
  const chartW = VW - padL;
  const max = Math.max(...series.map(s => s.value), 1);
  const count = series.length;
  const slotW = chartW / count;
  const barW  = Math.max(5, slotW * 0.6);
  const skipN = count > 20 ? Math.ceil(count / 8) : count > 12 ? 2 : 1;

  const gridLines = [0, 0.5, 1].map(pct => {
    const y = chartH - Math.round(pct * chartH);
    return `<line x1="${padL}" y1="${y}" x2="${VW}" y2="${y}" stroke="#f3f4f6" stroke-width="1.5"/>
            <text x="${padL - 5}" y="${y + 4}" text-anchor="end" font-size="12" fill="#d1d5db">${Math.round(pct * max)}</text>`;
  }).join('');

  const bars = series.map((s, i) => {
    const bh  = Math.max(Math.round((s.value / max) * chartH), s.value > 0 ? 4 : 0);
    const x   = padL + i * slotW + (slotW - barW) / 2;
    const y   = chartH - bh;
    const lbl = i % skipN === 0
      ? `<text x="${x + barW / 2}" y="${chartH + 22}" text-anchor="middle" font-size="11" fill="#9ca3af">${esc(s.label)}</text>`
      : '';
    const val = s.value > 0
      ? `<text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="12" fill="${color}" font-weight="700">${s.value}</text>`
      : '';
    return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" fill="${color}" rx="3" opacity="0.9"/>
            ${val}${lbl}`;
  }).join('');

  return `<svg viewBox="0 0 ${VW} ${VH}" width="100%" style="display:block;overflow:visible;margin:12px 0">
    ${gridLines}
    <line x1="${padL}" y1="0" x2="${padL}" y2="${chartH}" stroke="#e5e7eb" stroke-width="1.5"/>
    <line x1="${padL}" y1="${chartH}" x2="${VW}" y2="${chartH}" stroke="#e5e7eb" stroke-width="1.5"/>
    ${bars}
  </svg>`;
}

function hBarRow(label, count, maxCount, totalForPct, color) {
  const pct    = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const pctStr = totalForPct > 0 ? ` (${Math.round((count / totalForPct) * 100)}%)` : '';
  return `<div class="bar-row">
    <span class="bar-label">${esc(label)}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.max(pct, pct > 0 ? 1 : 0).toFixed(1)}%;background:${color}"></div></div>
    <span class="bar-count">${count}<span class="bar-pct">${pctStr}</span></span>
  </div>`;
}

export function buildReportHtml({ decl, period, refDate, genreFilter, resolveCountry }) {
  const DECL  = '#10B981';
  const GREEN = '#3A6B4A';
  const BLUE  = '#3B82F6';
  const PINK  = '#EC4899';
  const AMBER = '#F59E0B';
  const GREY  = '#94A3B8';

  const periodLabel = getPeriodLabel(period, refDate);
  const now    = new Date();
  const nowStr = `${now.getDate()} ${SHORT_MONTHS[now.getMonth()]} ${now.getFullYear()} à ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const h2 = 'class="section-title"';

  // Genre
  const gTotal = decl ? (decl.byGenre.homme + decl.byGenre.femme + decl.byGenre.enfant + (decl.byGenre.inconnu ?? 0)) : 0;
  const gMax   = Math.max(decl?.byGenre?.homme ?? 0, decl?.byGenre?.femme ?? 0, decl?.byGenre?.enfant ?? 0, decl?.byGenre?.inconnu ?? 0, 1);
  const genreSection = decl ? `
    <h2 ${h2}>Par genre</h2>
    ${hBarRow('Homme',  decl.byGenre.homme,  gMax, gTotal, BLUE)}
    ${hBarRow('Femme',  decl.byGenre.femme,  gMax, gTotal, PINK)}
    ${hBarRow('Enfant', decl.byGenre.enfant, gMax, gTotal, AMBER)}
    ${(decl.byGenre.inconnu ?? 0) > 0 ? hBarRow('Inconnu', decl.byGenre.inconnu, gMax, gTotal, GREY) : ''}` : '';

  // Pays
  const paysMap = (decl?.byPays ?? []).reduce((acc, p) => {
    const name = resolveCountry ? (resolveCountry(p.pays) ?? p.pays) : p.pays;
    acc[name] = (acc[name] ?? 0) + p.count;
    return acc;
  }, {});
  const paysItems  = Object.entries(paysMap).sort((a, b) => b[1] - a[1]);
  const paysInconnu = decl?.paysInconnu ?? 0;
  if (paysInconnu > 0) paysItems.push(['Inconnu', paysInconnu]);
  const paysMax   = paysItems.length ? Math.max(...paysItems.map(p => p[1]), 1) : 1;
  const paysTotal = paysItems.reduce((s, p) => s + p[1], 0);
  const paysSection = `
    <h2 ${h2}>Par pays</h2>
    ${paysItems.length
      ? paysItems.map(([n, c]) => hBarRow(n, c, paysMax, paysTotal, n === 'Inconnu' ? GREY : DECL)).join('')
      : '<p class="empty">Aucune donnée</p>'}`;

  // Mosquée
  const mosqueeItems = decl?.byMosquee ?? [];
  const mosqueeMax   = mosqueeItems.length ? Math.max(...mosqueeItems.map(m => m.count), 1) : 1;
  const mosqueeTotal = mosqueeItems.reduce((s, m) => s + m.count, 0);
  const mosqueeSection = `
    <h2 ${h2}>Par mosquée</h2>
    ${mosqueeItems.length
      ? mosqueeItems.map(m => hBarRow(m.nom, m.count, mosqueeMax, mosqueeTotal, GREEN)).join('')
      : '<p class="empty">Aucune donnée</p>'}`;

  const filterBadge = genreFilter
    ? `<span class="badge">${esc(genreFilter)}</span>`
    : '';

  const total = decl?.total ?? 0;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rapport Janazas — ${esc(periodLabel)}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body {
    font-family: -apple-system, Arial, Helvetica, sans-serif;
    color: #1f2937;
    padding: 28px 24px;
    max-width: 600px;
    font-size: 16px;
    line-height: 1.5;
  }
  .eyebrow { font-size:11px; font-weight:700; color:${DECL}; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:6px; }
  h1 { font-size:26px; font-weight:800; color:#111827; margin-bottom:4px; }
  .subtitle { font-size:15px; color:#6b7280; margin-bottom:2px; }
  .meta { font-size:11px; color:#d1d5db; margin-top:12px; }
  .divider { height:3px; background:linear-gradient(to right,${DECL},#e5e7eb); margin:16px 0 22px; border-radius:2px; }
  .total-num { font-size:64px; font-weight:800; color:${DECL}; line-height:1; }
  .total-lbl { font-size:17px; color:#9ca3af; margin-left:10px; }
  .section-title {
    font-size:11px; font-weight:700; color:#6b7280;
    letter-spacing:0.1em; text-transform:uppercase;
    border-bottom:1px solid #f3f4f6; padding-bottom:8px;
    margin-top:26px; margin-bottom:14px;
  }
  .bar-row { display:flex; align-items:center; gap:10px; margin-bottom:13px; }
  .bar-label { flex:0 0 130px; font-size:14px; color:#374151; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .bar-track { flex:1; height:18px; background:#f3f4f6; border-radius:9px; overflow:hidden; }
  .bar-fill  { height:100%; border-radius:9px; }
  .bar-count { flex:0 0 65px; font-size:14px; font-weight:700; color:#374151; text-align:right; }
  .bar-pct   { font-size:12px; font-weight:400; color:#9ca3af; }
  .badge { display:inline-block; background:#ecfdf5; color:#10b981; border:1px solid #6ee7b7; border-radius:4px; padding:1px 8px; font-size:12px; margin-left:8px; vertical-align:middle; }
  .empty { color:#d1d5db; font-size:14px; margin-bottom:10px; }
  .footer { margin-top:36px; padding-top:12px; border-top:1px solid #f3f4f6; font-size:11px; color:#d1d5db; text-align:center; }
  @media print {
    body { padding:12px 16px; }
    .bar-label { flex:0 0 110px; }
  }
</style>
</head>
<body>
  <div class="eyebrow">Qabr · Rapport statistique</div>
  <h1>Janazas déclarées</h1>
  <div class="subtitle">${esc(periodLabel)}${filterBadge}</div>
  <div class="meta">Généré le ${nowStr}</div>

  <div class="divider"></div>

  <div style="display:flex;align-items:baseline">
    <span class="total-num">${total}</span>
    <span class="total-lbl">janaza${total > 1 ? 's' : ''} déclarée${total > 1 ? 's' : ''}</span>
  </div>

  <h2 class="section-title">Évolution</h2>
  ${buildSeriesSvg(decl?.series, DECL)}

  ${genreSection}
  ${paysSection}
  ${mosqueeSection}

  <div class="footer">Qabr · Application de notification Salat al-Janaza · salat-janaza.com</div>
</body>
</html>`;
}
