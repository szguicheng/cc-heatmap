import type { GridData } from './heatmap.js';
import { getColors, getModeColors, type ThemeName, type ModeName } from './colors.js';
import type { Metric } from './data.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatValue(value: number): string {
  return value.toLocaleString('en-US');
}

function formatTooltip(date: string, value: number, metric: string): string {
  const label = metric === 'tool-calls' ? 'tool calls' : metric;
  return `${date} · ${formatValue(value)} ${label}`;
}

function metricLabel(metric: Metric): string {
  if (metric === 'tool-calls') return 'tool calls';
  return metric;
}

export function renderHtml(
  grid: GridData,
  metric: Metric,
  theme: ThemeName,
  mode: ModeName,
): string {
  const colors = getColors(theme);
  const mc = getModeColors(mode);
  const label = esc(metric);
  const mLabel = esc(metricLabel(metric));
  const totalCols = grid.weeks.length + 1;

  // Month labels
  let monthLabelsHtml = '';
  for (const [weekIdx, week] of grid.weeks.entries()) {
    if (week.monthLabel) {
      monthLabelsHtml +=
        `<div style="grid-column:${weekIdx + 2};grid-row:1" class="ml">${esc(week.monthLabel)}</div>`;
    }
  }

  // Day labels
  let dayLabelsHtml = '';
  for (let i = 0; i < 7; i++) {
    if (i % 2 === 1) {
      dayLabelsHtml +=
        `<div class="dl" style="grid-column:1;grid-row:${i + 2}">${esc(grid.dayLabels[i])}</div>`;
    }
  }

  // Cells
  let allCells = '';
  for (const [weekIdx, week] of grid.weeks.entries()) {
    const col = weekIdx + 2;

    for (const cell of week.cells) {
      if (!cell || cell.date === '') continue;

      const d = new Date(cell.date + 'T00:00:00');
      const row = d.getDay() + 2;

      let bg: string;
      let tooltip: string;
      if (cell.level === -1) {
        bg = mc.noDataCell;
        tooltip = `${esc(cell.date)} · No data`;
      } else if (cell.level === 0) {
        bg = colors[0];
        tooltip = formatTooltip(cell.date, 0, label);
      } else {
        bg = colors[cell.level - 1];
        tooltip = formatTooltip(cell.date, cell.value, label);
      }
      allCells +=
        `<div class="c" style="grid-column:${col};grid-row:${row};background:${bg}" title="${esc(tooltip)}" data-lv="${cell.level}"></div>`;
    }
  }

  // Legend
  const legendBoxes = colors
    .map((c) => `<div class="lb" style="background:${c}"></div>`)
    .join('');

  const totalStr = formatValue(grid.totalValue);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude Code Heatmap — ${label}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  background:${mc.bodyBg};
  color:${mc.textColor};
  display:flex;justify-content:center;align-items:center;
  min-height:100vh;padding:2rem
}
.wrap{
  background:${mc.containerBg};
  border:1px solid ${mc.containerBorder};
  border-radius:8px;padding:2rem;overflow-x:auto;max-width:100%
}
h1{font-size:1.25rem;font-weight:600;margin-bottom:1.5rem;color:${mc.headingColor}}
h1 .n{font-size:2rem;font-weight:800;margin-right:.35em}
h1 .u{font-size:.85rem;font-weight:400;color:${mc.mutedColor}}
.g{display:flex;gap:0}
.h{
  display:grid;
  grid-template-columns:28px repeat(${totalCols - 1},13px);
  grid-template-rows:20px repeat(7,13px);
  gap:3px
}
.ml{font-size:10px;color:${mc.mutedColor};line-height:20px}
.c{width:13px;height:13px;border-radius:2px}
.dl{font-size:10px;line-height:13px;color:${mc.mutedColor};display:flex;align-items:center;justify-content:flex-end;padding-right:6px}
.f{display:flex;justify-content:space-between;align-items:center;margin-top:1rem;font-size:11px;color:${mc.mutedColor}}
.lg{display:flex;align-items:center;gap:4px}
.lb{width:13px;height:13px;border-radius:2px}
.rt{text-align:right}
</style>
</head>
<body>
<div class="wrap">
  <h1><span class="n">${totalStr}</span><span class="u">${mLabel}</span></h1>
  <div class="g">
    <div class="h">
      ${monthLabelsHtml}
      ${dayLabelsHtml}
      ${allCells}
    </div>
  </div>
  <div class="f">
    <div class="lg">
      <span>Less</span>
      ${legendBoxes}
      <span>More</span>
    </div>
    <div class="rt">Claude Code</div>
  </div>
</div>
</body>
</html>`;
}
