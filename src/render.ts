import type { GridData } from './heatmap.js';
import { getColors, emptyColor, noDataColor, type ThemeName } from './colors.js';
import type { Metric } from './data.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatTooltip(date: string, value: number, metric: string): string {
  const label = metric === 'tool-calls' ? 'tool calls' : metric;
  return `${date} · ${formatValue(value)} ${label}`;
}

function metricLabel(metric: Metric): string {
  if (metric === 'tool-calls') return 'tool calls';
  return metric;
}

export function renderHtml(grid: GridData, metric: Metric, theme: ThemeName): string {
  const colors = getColors(theme);
  const label = esc(metric);
  const mLabel = esc(metricLabel(metric));
  const totalCols = grid.weeks.length + 1;

  // Build month labels (row 1), placed at the column for that week
  let monthLabelsHtml = '';
  for (const [weekIdx, week] of grid.weeks.entries()) {
    if (week.monthLabel) {
      monthLabelsHtml +=
        `<div style="grid-column:${weekIdx + 2};grid-row:1" class="month-label">${esc(week.monthLabel)}</div>`;
    }
  }

  // Build day labels (Mon, Wed, Fri) in column 1
  let dayLabelsHtml = '';
  for (let i = 0; i < 7; i++) {
    if (i % 2 === 1) {
      dayLabelsHtml +=
        `<div class="day-label" style="grid-column:1;grid-row:${i + 2}">${esc(grid.dayLabels[i])}</div>`;
    }
  }

  // Build cells: each cell at (weekIdx+2, dayOfWeek+2) using explicit grid positioning
  let allCells = '';
  for (const [weekIdx, week] of grid.weeks.entries()) {
    const col = weekIdx + 2;

    for (const cell of week.cells) {
      if (cell.date === '') continue;

      const d = new Date(cell.date + 'T00:00:00');
      const row = d.getDay() + 2; // 0=Sun → row 2

      let bg: string;
      let tooltip: string;
      if (cell.level === -1) {
        bg = noDataColor;
        tooltip = `${esc(cell.date)} · No data`;
      } else if (cell.level === 0) {
        bg = colors[0];
        tooltip = formatTooltip(cell.date, 0, label);
      } else {
        bg = colors[cell.level - 1];
        tooltip = formatTooltip(cell.date, cell.value, label);
      }
      allCells +=
        `<div class="cell" style="grid-column:${col};grid-row:${row};background:${bg}" title="${esc(tooltip)}" data-level="${cell.level}"></div>`;
    }
  }

  // Legend boxes
  const legendBoxes = colors
    .map((c) => `<div class="legend-box" style="background:${c}"></div>`)
    .join('');

  const totalStr = formatValue(grid.totalValue);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude Code Heatmap — ${label}</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0d1117;
  color: #c9d1d9;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 2rem;
}
.container {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 2rem;
  overflow-x: auto;
  max-width: 100%;
}
h1 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: #f0f6fc;
}
.grid-wrapper { display: flex; gap: 0; }
.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(${totalCols}, 13px);
  grid-template-rows: 20px repeat(7, 13px);
  gap: 3px;
}
.month-label {
  font-size: 10px;
  color: #6e7681;
  line-height: 20px;
}
.cell {
  width: 13px;
  height: 13px;
  border-radius: 2px;
}
.day-label {
  font-size: 10px;
  line-height: 13px;
  color: #6e7681;
  display: flex;
  align-items: center;
}
.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  font-size: 11px;
  color: #6e7681;
}
.legend {
  display: flex;
  align-items: center;
  gap: 4px;
}
.legend-box {
  width: 13px;
  height: 13px;
  border-radius: 2px;
}
.total {
  text-align: right;
}
</style>
</head>
<body>
<div class="container">
  <h1>Claude Code · ${label}</h1>
  <div class="grid-wrapper">
    <div class="heatmap-grid">
      ${monthLabelsHtml}
      ${dayLabelsHtml}
      ${allCells}
    </div>
  </div>
  <div class="footer">
    <div class="legend">
      <span>Less</span>
      ${legendBoxes}
      <span>More</span>
    </div>
    <div class="total">${totalStr} ${mLabel}</div>
  </div>
</div>
</body>
</html>`;
}
