/**
 * Monthly Deep Dive — Server-Side SVG Chart Renderer
 * Pure SVG generation, no DOM/browser dependency
 * Brand colors: LG Red #A50034, Dark Blue #1B2A4A
 */

const fs = require('fs');
const path = require('path');

// ── Brand Colors ──────────────────────────────────────────
const COLORS = {
  lgRed: '#A50034',
  darkBlue: '#1B2A4A',
  accentBlue: '#2E75B6',
  green: '#16A34A',
  orange: '#EA580C',
  purple: '#7C3AED',
  teal: '#0D9488',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  white: '#FFFFFF',
  text: '#1F2937',
  muted: '#9CA3AF',
  palette: ['#A50034', '#2E75B6', '#16A34A', '#EA580C', '#7C3AED', '#0D9488', '#F59E0B', '#EC4899']
};

// ── SVG Helpers ───────────────────────────────────────────
function svgWrap(content, width = 800, height = 500, title = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="Arial, sans-serif">
  <title>${title}</title>
  <rect width="${width}" height="${height}" fill="${COLORS.white}" rx="8"/>
  ${content}
</svg>`;
}

function text(x, y, content, opts = {}) {
  const anchor = opts.anchor || 'start';
  const size = opts.size || 14;
  const color = opts.color || COLORS.text;
  const weight = opts.bold ? 'bold' : 'normal';
  const italic = opts.italic ? 'italic' : 'normal';
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${color}" font-weight="${weight}" font-style="${italic}">${content}</text>`;
}

function rect(x, y, w, h, color, opts = {}) {
  const rx = opts.rx || 0;
  const opacity = opts.opacity || 1;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" rx="${rx}" opacity="${opacity}"/>`;
}

function line(x1, y1, x2, y2, color = COLORS.muted, width = 1, dash = '') {
  const da = dash ? ` stroke-dasharray="${dash}"` : '';
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"${da}/>`;
}

// ── Chart 1: Radar / Bar Chart for Theme Importance ───────
function renderThemeImportanceChart(chartData, outputPath) {
  const data = chartData.radar_chart;
  if (!data || !data.labels || data.labels.length === 0) return null;

  const W = 800, H = 460;
  const PAD = { top: 70, right: 20, bottom: 100, left: 50 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const labels = data.labels || [];
  const scores = data.importance_scores || [];
  const n = labels.length;
  const barW = Math.min(80, (chartW / n) * 0.6);
  const gap = chartW / n;

  let bars = '';
  let xLabels = '';
  let valueLabels = '';

  scores.forEach((score, i) => {
    const x = PAD.left + gap * i + gap / 2 - barW / 2;
    const barH = (score / 10) * chartH;
    const y = PAD.top + chartH - barH;
    const color = COLORS.palette[i % COLORS.palette.length];
    const labelX = PAD.left + gap * i + gap / 2;

    bars += rect(x, y, barW, barH, color, { rx: 4 });
    valueLabels += text(labelX, y - 8, score.toFixed(1), { anchor: 'middle', size: 13, bold: true, color });

    // Wrap label text
    const label = labels[i] || '';
    const words = label.split(' ');
    if (words.length <= 2) {
      xLabels += text(labelX, PAD.top + chartH + 20, label, { anchor: 'middle', size: 12, color: COLORS.text });
    } else {
      const mid = Math.ceil(words.length / 2);
      xLabels += text(labelX, PAD.top + chartH + 18, words.slice(0, mid).join(' '), { anchor: 'middle', size: 11, color: COLORS.text });
      xLabels += text(labelX, PAD.top + chartH + 32, words.slice(mid).join(' '), { anchor: 'middle', size: 11, color: COLORS.text });
    }
  });

  // Y-axis grid lines
  let grid = '';
  for (let v = 0; v <= 10; v += 2) {
    const y = PAD.top + chartH - (v / 10) * chartH;
    grid += line(PAD.left, y, W - PAD.right, y, COLORS.lightGray, 1);
    grid += text(PAD.left - 8, y + 4, v, { anchor: 'end', size: 11, color: COLORS.muted });
  }

  const svg = svgWrap(`
  ${rect(0, 0, W, H, COLORS.white, { rx: 8 })}
  ${rect(0, 0, W, 52, COLORS.darkBlue, { rx: 8 })}
  ${rect(0, 44, W, 8, COLORS.darkBlue)}
  ${text(W/2, 32, data.title_en || 'Strategic Importance by Theme', { anchor: 'middle', size: 18, bold: true, color: COLORS.white })}
  ${grid}
  ${bars}
  ${valueLabels}
  ${xLabels}
  ${line(PAD.left, PAD.top, PAD.left, PAD.top + chartH, COLORS.gray, 1)}
  ${line(PAD.left, PAD.top + chartH, W - PAD.right, PAD.top + chartH, COLORS.gray, 1)}
  `, W, H, data.title_en || 'Theme Importance');

  fs.writeFileSync(outputPath, svg);
  return outputPath;
}

// ── Chart 2: Horizontal Bar — Category Distribution ───────
function renderCategoryChart(chartData, outputPath) {
  const data = chartData.category_bar;
  if (!data || !data.labels || data.labels.length === 0) return null;

  const W = 800, H = 420;
  const PAD = { top: 60, right: 120, bottom: 40, left: 220 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const labels = data.labels || [];
  const values = data.values || [];
  const maxVal = Math.max(...values, 1);
  const n = labels.length;
  const rowH = chartH / n;
  const barH = Math.min(28, rowH * 0.65);

  let bars = '', yLabels = '', valLabels = '';

  values.forEach((val, i) => {
    const barW = (val / maxVal) * chartW;
    const y = PAD.top + i * rowH + (rowH - barH) / 2;
    const color = COLORS.palette[i % COLORS.palette.length];

    bars += rect(PAD.left, y, barW, barH, color, { rx: 3 });
    yLabels += text(PAD.left - 10, y + barH / 2 + 4, labels[i], { anchor: 'end', size: 12, color: COLORS.text });
    valLabels += text(PAD.left + barW + 8, y + barH / 2 + 4, val, { anchor: 'start', size: 12, bold: true, color });
  });

  // Grid
  let grid = '';
  const steps = 4;
  for (let s = 0; s <= steps; s++) {
    const x = PAD.left + (s / steps) * chartW;
    grid += line(x, PAD.top, x, PAD.top + chartH, COLORS.lightGray, 1);
    grid += text(x, PAD.top + chartH + 16, Math.round((s / steps) * maxVal), { anchor: 'middle', size: 11, color: COLORS.muted });
  }

  const svg = svgWrap(`
  ${rect(0, 0, W, H, COLORS.white, { rx: 8 })}
  ${rect(0, 0, W, 48, COLORS.darkBlue, { rx: 8 })}
  ${rect(0, 40, W, 8, COLORS.darkBlue)}
  ${text(W/2, 30, data.title_en || 'Article Distribution by Category', { anchor: 'middle', size: 16, bold: true, color: COLORS.white })}
  ${grid}
  ${bars}
  ${yLabels}
  ${valLabels}
  `, W, H, data.title_en || 'Category Distribution');

  fs.writeFileSync(outputPath, svg);
  return outputPath;
}

// ── Chart 3: Confidence Distribution (Donut) ──────────────
function renderConfidenceChart(chartData, outputPath) {
  const data = chartData.confidence_histogram;
  if (!data || !data.values) return null;

  const W = 500, H = 380;
  const cx = 180, cy = 190, r = 120, innerR = 65;

  const values = data.values || [0, 0, 0];
  const labels = data.buckets || ['High (0.8+)', 'Medium (0.5-0.8)', 'Low (<0.5)'];
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const colors = [COLORS.green, COLORS.accentBlue, COLORS.orange];

  // Generate pie slices
  let slices = '';
  let startAngle = -Math.PI / 2;
  const segments = values.map((v, i) => {
    const angle = (v / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(startAngle);
    const iy1 = cy + innerR * Math.sin(startAngle);
    const ix2 = cx + innerR * Math.cos(endAngle);
    const iy2 = cy + innerR * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const seg = { startAngle, endAngle, x1, y1, x2, y2, ix1, iy1, ix2, iy2, largeArc, color: colors[i], value: v };
    startAngle = endAngle;
    return seg;
  });

  segments.forEach(s => {
    if (s.value === 0) return;
    slices += `<path d="M ${s.ix1} ${s.iy1} L ${s.x1} ${s.y1} A ${r} ${r} 0 ${s.largeArc} 1 ${s.x2} ${s.y2} L ${s.ix2} ${s.iy2} A ${innerR} ${innerR} 0 ${s.largeArc} 0 ${s.ix1} ${s.iy1} Z" fill="${s.color}"/>`;
  });

  // Legend
  let legend = '';
  values.forEach((v, i) => {
    const ly = 120 + i * 40;
    const pct = total > 0 ? ((v / total) * 100).toFixed(0) : 0;
    legend += rect(330, ly - 12, 16, 16, colors[i], { rx: 3 });
    legend += text(354, ly + 1, labels[i], { size: 12, color: COLORS.text });
    legend += text(490, ly + 1, `${v} (${pct}%)`, { anchor: 'end', size: 12, bold: true, color: colors[i] });
  });

  const svg = svgWrap(`
  ${rect(0, 0, W, H, COLORS.white, { rx: 8 })}
  ${rect(0, 0, W, 48, COLORS.darkBlue, { rx: 8 })}
  ${rect(0, 40, W, 8, COLORS.darkBlue)}
  ${text(W/2, 30, data.title_en || 'Confidence Distribution', { anchor: 'middle', size: 16, bold: true, color: COLORS.white })}
  ${slices}
  ${text(cx, cy - 8, total, { anchor: 'middle', size: 28, bold: true, color: COLORS.darkBlue })}
  ${text(cx, cy + 14, 'articles', { anchor: 'middle', size: 13, color: COLORS.muted })}
  ${legend}
  `, W, H, 'Confidence Distribution');

  fs.writeFileSync(outputPath, svg);
  return outputPath;
}

// ── Chart 4: Regional Bar Chart ───────────────────────────
function renderRegionalChart(chartData, outputPath) {
  const data = chartData.regional_bar;
  if (!data || !data.regions) return null;

  const W = 600, H = 380;
  const PAD = { top: 60, right: 30, bottom: 80, left: 60 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const regions = data.regions || [];
  const values = data.values || [];
  const maxVal = Math.max(...values, 1);
  const n = regions.length;
  const barW = (chartW / n) * 0.55;
  const gap = chartW / n;

  const regionColors = { GLOBAL: COLORS.darkBlue, AMER: COLORS.lgRed, EMEA: COLORS.accentBlue, APAC: COLORS.green };

  let bars = '', xLabels = '', valLabels = '', grid = '';

  for (let v = 0; v <= maxVal; v += Math.ceil(maxVal / 4)) {
    const y = PAD.top + chartH - (v / maxVal) * chartH;
    grid += line(PAD.left, y, W - PAD.right, y, COLORS.lightGray, 1);
    grid += text(PAD.left - 8, y + 4, v, { anchor: 'end', size: 11, color: COLORS.muted });
  }

  values.forEach((val, i) => {
    const x = PAD.left + gap * i + gap / 2 - barW / 2;
    const barH = (val / maxVal) * chartH;
    const y = PAD.top + chartH - barH;
    const color = regionColors[regions[i]] || COLORS.palette[i];
    const labelX = PAD.left + gap * i + gap / 2;

    bars += rect(x, y, barW, barH, color, { rx: 4 });
    valLabels += text(labelX, y - 8, val, { anchor: 'middle', size: 13, bold: true, color });
    xLabels += text(labelX, PAD.top + chartH + 20, regions[i], { anchor: 'middle', size: 13, color: COLORS.text, bold: true });
  });

  const svg = svgWrap(`
  ${rect(0, 0, W, H, COLORS.white, { rx: 8 })}
  ${rect(0, 0, W, 48, COLORS.darkBlue, { rx: 8 })}
  ${rect(0, 40, W, 8, COLORS.darkBlue)}
  ${text(W/2, 30, data.title_en || 'Regional Trend Distribution', { anchor: 'middle', size: 16, bold: true, color: COLORS.white })}
  ${grid}
  ${bars}
  ${valLabels}
  ${xLabels}
  ${line(PAD.left, PAD.top, PAD.left, PAD.top + chartH, COLORS.gray, 1)}
  ${line(PAD.left, PAD.top + chartH, W - PAD.right, PAD.top + chartH, COLORS.gray, 1)}
  `, W, H, 'Regional Distribution');

  fs.writeFileSync(outputPath, svg);
  return outputPath;
}

// ── Chart 5: Impact-Urgency Matrix (2x2) ─────────────────
function renderImpactMatrix(chartData, outputPath) {
  const data = chartData.impact_matrix_data;
  if (!data || !data.points) return null;

  const W = 700, H = 500;
  const PAD = { top: 60, right: 40, bottom: 80, left: 80 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const points = data.points || [];
  const midX = PAD.left + chartW / 2;
  const midY = PAD.top + chartH / 2;

  // Quadrant backgrounds
  const quadrants = `
  ${rect(PAD.left, PAD.top, chartW/2, chartH/2, '#FEF2F2', {})}
  ${rect(midX, PAD.top, chartW/2, chartH/2, '#EFF6FF', {})}
  ${rect(PAD.left, midY, chartW/2, chartH/2, '#F9FAFB', {})}
  ${rect(midX, midY, chartW/2, chartH/2, '#F0FDF4', {})}`;

  // Quadrant labels
  const qLabels = `
  ${text(PAD.left + chartW/4, PAD.top + 20, 'Monitor', { anchor: 'middle', size: 12, color: '#EF4444', italic: true })}
  ${text(midX + chartW/4, PAD.top + 20, 'Act Now', { anchor: 'middle', size: 12, color: COLORS.lgRed, bold: true, italic: true })}
  ${text(PAD.left + chartW/4, midY + 20, 'Watch', { anchor: 'middle', size: 12, color: COLORS.muted, italic: true })}
  ${text(midX + chartW/4, midY + 20, 'Invest', { anchor: 'middle', size: 12, color: COLORS.green, italic: true })}`;

  // Grid lines (center cross)
  const gridLines = `
  ${line(midX, PAD.top, midX, PAD.top + chartH, COLORS.gray, 1.5, '5,3')}
  ${line(PAD.left, midY, PAD.left + chartW, midY, COLORS.gray, 1.5, '5,3')}`;

  // Plot points
  let plotPoints = '';
  points.forEach((p, i) => {
    const importance = Math.min(Math.max(p.importance || 5, 0), 10);
    const urgency = Math.min(Math.max(p.urgency_score || 5, 0), 10);
    const px = PAD.left + (urgency / 10) * chartW;
    const py = PAD.top + chartH - (importance / 10) * chartH;
    const color = COLORS.palette[i % COLORS.palette.length];

    plotPoints += `<circle cx="${px}" cy="${py}" r="18" fill="${color}" opacity="0.85"/>`;
    plotPoints += text(px, py + 4, `T${i+1}`, { anchor: 'middle', size: 11, bold: true, color: COLORS.white });

    // Label below or above
    const labelY = py > midY ? py - 26 : py + 30;
    const label = (p.label || '').split(' ').slice(0, 2).join(' ');
    plotPoints += text(px, labelY, label, { anchor: 'middle', size: 10, color });
  });

  // Axis labels
  const axisLabels = `
  ${text(W/2, H - 10, 'Urgency →', { anchor: 'middle', size: 13, bold: true, color: COLORS.darkBlue })}
  <text x="${20}" y="${PAD.top + chartH/2}" text-anchor="middle" font-size="13" fill="${COLORS.darkBlue}" font-weight="bold" transform="rotate(-90, 20, ${PAD.top + chartH/2})">Impact ↑</text>`;

  const svg = svgWrap(`
  ${rect(0, 0, W, H, COLORS.white, { rx: 8 })}
  ${rect(0, 0, W, 48, COLORS.darkBlue, { rx: 8 })}
  ${rect(0, 40, W, 8, COLORS.darkBlue)}
  ${text(W/2, 30, data.title_en || 'Impact-Urgency Matrix', { anchor: 'middle', size: 16, bold: true, color: COLORS.white })}
  ${quadrants}
  ${gridLines}
  ${qLabels}
  ${plotPoints}
  ${axisLabels}
  `, W, H, 'Impact-Urgency Matrix');

  fs.writeFileSync(outputPath, svg);
  return outputPath;
}

// ── Chart 6: Source Diversity Pie ─────────────────────────
function renderSourceDiversityChart(chartData, outputPath) {
  const data = chartData.source_diversity;
  if (!data || !data.values) return null;

  const W = 560, H = 380;
  const cx = 160, cy = 195, r = 120;
  const values = data.values || [];
  const labels = data.labels || [];
  const total = values.reduce((a, b) => a + b, 0) || 1;

  let slices = '';
  let startAngle = -Math.PI / 2;

  values.forEach((v, i) => {
    if (v === 0) return;
    const angle = (v / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const color = COLORS.palette[i % COLORS.palette.length];
    slices += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}" stroke="white" stroke-width="2"/>`;
    startAngle = endAngle;
  });

  // Legend
  let legend = '';
  values.forEach((v, i) => {
    if (v === 0) return;
    const ly = 100 + i * 38;
    const pct = ((v / total) * 100).toFixed(0);
    const color = COLORS.palette[i % COLORS.palette.length];
    legend += rect(310, ly - 10, 14, 14, color, { rx: 2 });
    legend += text(332, ly + 2, labels[i] || `Type ${i+1}`, { size: 12, color: COLORS.text });
    legend += text(545, ly + 2, `${pct}%`, { anchor: 'end', size: 12, bold: true, color });
  });

  const svg = svgWrap(`
  ${rect(0, 0, W, H, COLORS.white, { rx: 8 })}
  ${rect(0, 0, W, 48, COLORS.darkBlue, { rx: 8 })}
  ${rect(0, 40, W, 8, COLORS.darkBlue)}
  ${text(W/2, 30, data.title_en || 'Source Type Distribution', { anchor: 'middle', size: 16, bold: true, color: COLORS.white })}
  ${slices}
  ${legend}
  `, W, H, 'Source Diversity');

  fs.writeFileSync(outputPath, svg);
  return outputPath;
}

// ── Main: Render All Charts ───────────────────────────────
function renderAllCharts(chartData, chartDir) {
  fs.mkdirSync(chartDir, { recursive: true });
  const generated = {};

  const renderers = [
    ['theme-importance', renderThemeImportanceChart],
    ['category-distribution', renderCategoryChart],
    ['confidence-distribution', renderConfidenceChart],
    ['regional-comparison', renderRegionalChart],
    ['impact-urgency-matrix', renderImpactMatrix],
    ['source-diversity', renderSourceDiversityChart],
  ];

  for (const [name, fn] of renderers) {
    try {
      const outPath = path.join(chartDir, `${name}.svg`);
      const result = fn(chartData, outPath);
      if (result) {
        generated[name] = outPath;
        console.log(`    ✅ Chart: ${name}.svg`);
      }
    } catch (err) {
      console.warn(`    ⚠️  Chart ${name} failed: ${err.message}`);
    }
  }

  return generated;
}

module.exports = { renderAllCharts };
