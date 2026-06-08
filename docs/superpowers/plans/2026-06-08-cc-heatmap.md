# cc-heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-dependency CLI tool that reads Claude Code's `usage.db` and outputs a self-contained HTML heatmap visualization.

**Architecture:** Four pure modules (data → heatmap → render → cli) plus a theme definitions file. Each module is independently testable. CLI is the only entry point.

**Tech Stack:** TypeScript, Node.js 24+ `node:sqlite`, zero external runtime dependencies, `tsx` for dev execution, `vitest` for testing.

**File structure:**
```
src/
  colors.ts     — Theme definitions (5-color arrays)
  data.ts       — SQLite reader, daily aggregation
  heatmap.ts    — Week-grid layout, color level calculation
  render.ts     — HTML template rendering
  cli.ts        — Argument parsing, orchestrator
bin/
  cc-heatmap    — Shebang entry point
tests/
  colors.test.ts
  data.test.ts
  heatmap.test.ts
  render.test.ts
  cli.test.ts
package.json
tsconfig.json
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create package.json**

```bash
cd /Users/guicheng/Code/helloWorld/cc-gh-heatmap
cat > package.json << 'PKGJSON'
{
  "name": "cc-heatmap",
  "version": "1.0.0",
  "description": "Visualize Claude Code usage as a GitHub-style heatmap",
  "type": "module",
  "bin": {
    "cc-heatmap": "./bin/cc-heatmap.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["claude-code", "heatmap", "visualization"],
  "license": "MIT"
}
PKGJSON
```

- [ ] **Step 2: Create tsconfig.json**

```bash
cat > tsconfig.json << 'TSCONFIG'
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["dist", "tests"]
}
TSCONFIG
```

- [ ] **Step 3: Create vitest.config.ts**

```bash
cat > vitest.config.ts << 'VITESTCONFIG'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
VITESTCONFIG
```

- [ ] **Step 4: Install dev dependencies**

Run: `npm install --save-dev typescript tsx vitest @types/node`

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts
git commit -m "chore: scaffold project with TypeScript and vitest"
```

---

### Task 2: Theme Definitions (`colors.ts`)

**Files:**
- Create: `src/colors.ts`
- Create: `tests/colors.test.ts`

- [ ] **Step 1: Write tests**

```ts
// tests/colors.test.ts
import { describe, it, expect } from 'vitest';
import { getColors, themes, type ThemeName } from '../src/colors.js';

describe('getColors', () => {
  it('returns 5 hex colors for the orange theme', () => {
    const colors = getColors('orange');
    expect(colors).toHaveLength(5);
    expect(colors[0]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('returns 5 hex colors for the green theme', () => {
    const colors = getColors('green');
    expect(colors).toHaveLength(5);
  });

  it('returns 5 hex colors for the purple theme', () => {
    const colors = getColors('purple');
    expect(colors).toHaveLength(5);
  });

  it('throws for unknown theme', () => {
    expect(() => getColors('blue' as ThemeName)).toThrow('Unknown theme');
  });

  it('all themes define exactly 5 colors', () => {
    for (const [name, colors] of Object.entries(themes)) {
      expect(colors, `${name} should have 5 colors`).toHaveLength(5);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/colors.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement colors.ts**

```ts
// src/colors.ts
export type ThemeName = 'orange' | 'green' | 'purple';

export const themes: Record<ThemeName, readonly string[]> = {
  orange: ['#fde6d2', '#f7b37a', '#f08a3d', '#e0681e', '#b8450d'],
  green: ['#d2f3d2', '#7bc96e', '#40a335', '#21731a', '#0f4d0c'],
  purple: ['#e8d5f5', '#b77dd6', '#8e4db8', '#6b2d94', '#481a6e'],
};

export const emptyColor = '#1a1a2e';

export function getColors(name: ThemeName): readonly string[] {
  const colors = themes[name];
  if (!colors) throw new Error(`Unknown theme: ${name}`);
  return colors;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/colors.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/colors.ts tests/colors.test.ts
git commit -m "feat: add color theme definitions"
```

---

### Task 3: Data Reader (`data.ts`)

**Files:**
- Create: `src/data.ts`
- Create: `tests/data.test.ts`

- [ ] **Step 1: Write tests**

```ts
// tests/data.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { queryDailyData } from '../src/data.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let db: DatabaseSync;
let dbPath: string;

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), 'cc-heatmap-test-'));
  dbPath = join(dir, 'test-usage.db');
  db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      timestamp TEXT,
      model TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0,
      tool_name TEXT,
      cwd TEXT,
      message_id TEXT
    );
    CREATE INDEX idx_turns_timestamp ON turns(timestamp);
  `);

  const insert = db.prepare(`
    INSERT INTO turns (timestamp, input_tokens, output_tokens, tool_name)
    VALUES (?, ?, ?, ?)
  `);

  insert.run('2026-06-01T10:00:00.000Z', 100, 50, null);
  insert.run('2026-06-01T11:00:00.000Z', 200, 100, 'Bash');
  insert.run('2026-06-03T10:00:00.000Z', 300, 150, 'Read');
  insert.run('2026-06-03T11:00:00.000Z', 400, 200, '');
  insert.run('2026-06-05T10:00:00.000Z', 50, 25, 'Write');
});

afterAll(() => {
  db.close();
  rmSync(dbPath);
});

describe('queryDailyData', () => {
  it('aggregates tokens per day', () => {
    const result = queryDailyData(dbPath, '2026-06-01', '2026-06-05', 'tokens');
    expect(result).toEqual([
      { date: '2026-06-01', value: 450 },
      { date: '2026-06-03', value: 1050 },
      { date: '2026-06-05', value: 75 },
    ]);
  });

  it('counts messages per day', () => {
    const result = queryDailyData(dbPath, '2026-06-01', '2026-06-05', 'messages');
    expect(result).toEqual([
      { date: '2026-06-01', value: 2 },
      { date: '2026-06-03', value: 2 },
      { date: '2026-06-05', value: 1 },
    ]);
  });

  it('counts tool calls per day', () => {
    const result = queryDailyData(dbPath, '2026-06-01', '2026-06-05', 'tool-calls');
    expect(result).toEqual([
      { date: '2026-06-01', value: 1 },
      { date: '2026-06-03', value: 1 },
      { date: '2026-06-05', value: 1 },
    ]);
  });

  it('returns empty array for range with no data', () => {
    const result = queryDailyData(dbPath, '2020-01-01', '2020-01-31', 'tokens');
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/data.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement data.ts**

```ts
// src/data.ts
import { DatabaseSync } from 'node:sqlite';

export type Metric = 'tokens' | 'messages' | 'tool-calls';

export interface DailyData {
  date: string;
  value: number;
}

const METRIC_SQL: Record<Metric, string> = {
  tokens: `SELECT date(timestamp) as date, SUM(input_tokens + output_tokens) as value
           FROM turns WHERE date(timestamp) >= ? AND date(timestamp) <= ?
           GROUP BY date(timestamp) ORDER BY date(timestamp)`,

  messages: `SELECT date(timestamp) as date, COUNT(*) as value
             FROM turns WHERE date(timestamp) >= ? AND date(timestamp) <= ?
             GROUP BY date(timestamp) ORDER BY date(timestamp)`,

  'tool-calls': `SELECT date(timestamp) as date, COUNT(*) as value
                 FROM turns
                 WHERE date(timestamp) >= ? AND date(timestamp) <= ?
                   AND tool_name IS NOT NULL AND tool_name != ''
                 GROUP BY date(timestamp) ORDER BY date(timestamp)`,
};

export function queryDailyData(
  dbPath: string,
  fromDate: string,
  toDate: string,
  metric: Metric,
): DailyData[] {
  const db = new DatabaseSync(dbPath);
  try {
    const sql = METRIC_SQL[metric];
    const stmt = db.prepare(sql);
    const rows = stmt.all(fromDate, toDate) as DailyData[];
    return rows;
  } finally {
    db.close();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/data.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/data.ts tests/data.test.ts
git commit -m "feat: add SQLite data reader with daily aggregation"
```

---

### Task 4: Heatmap Grid Builder (`heatmap.ts`)

**Files:**
- Create: `src/heatmap.ts`
- Create: `tests/heatmap.test.ts`

- [ ] **Step 1: Write tests**

```ts
// tests/heatmap.test.ts
import { describe, it, expect } from 'vitest';
import { buildGrid, computeLevel } from '../src/heatmap.js';
import type { DailyData } from '../src/data.js';

describe('computeLevel', () => {
  it('returns 0 for zero value', () => {
    expect(computeLevel(0, [10, 20, 30, 40])).toBe(0);
  });

  it('returns 1 for value at or below P25', () => {
    expect(computeLevel(5, [10, 20, 30, 40])).toBe(1);
    expect(computeLevel(10, [10, 20, 30, 40])).toBe(1);
  });

  it('returns 2 for value at or below P50', () => {
    expect(computeLevel(15, [10, 20, 30, 40])).toBe(2);
    expect(computeLevel(20, [10, 20, 30, 40])).toBe(2);
  });

  it('returns 3 for value at or below P75', () => {
    expect(computeLevel(25, [10, 20, 30, 40])).toBe(3);
    expect(computeLevel(30, [10, 20, 30, 40])).toBe(3);
  });

  it('returns 4 for value above P75', () => {
    expect(computeLevel(100, [10, 20, 30, 40])).toBe(4);
  });

  it('handles empty thresholds (all levels 0)', () => {
    const result = computeLevel(100, []);
    expect(result).toBe(4);
  });

  it('handles single value in thresholds', () => {
    expect(computeLevel(5, [10])).toBe(1);
    expect(computeLevel(15, [10])).toBe(4);
  });
});

describe('buildGrid', () => {
  it('builds a grid with correct number of rows', () => {
    const data: DailyData[] = [
      { date: '2026-06-01', value: 100 },
      { date: '2026-06-07', value: 200 },
    ];
    const grid = buildGrid(data, '2026-06-01', '2026-06-07');
    expect(grid.rows).toHaveLength(7);
  });

  it('places data on correct day of week', () => {
    // 2026-06-01 is a Monday (day 1 = Monday in JS getDay, but 1 in our Sun-Sat mapping)
    const data: DailyData[] = [{ date: '2026-06-01', value: 100 }];
    const grid = buildGrid(data, '2026-06-01', '2026-06-01');

    // 2026-06-01 Mon: getDay() = 1. Our grid: row 0 = Sun, row 1 = Mon
    const monCell = grid.rows[1].cells[0];
    expect(monCell.date).toBe('2026-06-01');
    expect(monCell.value).toBe(100);
  });

  it('fills empty cells for days with no data', () => {
    const data: DailyData[] = [{ date: '2026-06-01', value: 100 }];
    const grid = buildGrid(data, '2026-06-01', '2026-06-03');

    // 2026-06-02 has no data data — should exist as empty cell
    // 2026-06-02 is Tue, row 2
    const tueCell = grid.rows[2].cells[0];
    expect(tueCell.date).toBe('2026-06-02');
    expect(tueCell.value).toBe(0);
    expect(tueCell.level).toBe(-1); // no data at all
  });

  it('computes correct month labels', () => {
    const data: DailyData[] = [
      { date: '2026-05-31', value: 100 },
      { date: '2026-06-07', value: 200 },
    ];
    const grid = buildGrid(data, '2026-05-31', '2026-06-13');

    const monthLabels = grid.weeks.map(w => w.monthLabel);
    expect(monthLabels[0]).toBe('May');
    expect(monthLabels[1]).toBe('Jun');
    expect(monthLabels[2]).toBe('');
  });

  it('calculates color levels in cells', () => {
    const data: DailyData[] = [
      { date: '2026-06-01', value: 10 },
      { date: '2026-06-02', value: 50 },
      { date: '2026-06-03', value: 100 },
      { date: '2026-06-04', value: 200 },
      { date: '2026-06-05', value: 1000 },
    ];
    const grid = buildGrid(data, '2026-06-01', '2026-06-05');

    // levels should be: 10->1, 50->2, 100->3, 200->4, 1000->4
    const levels = grid.rows.flatMap(r => r.cells).map(c => c.level).filter(l => l >= 0);
    expect(levels).toEqual([1, 2, 3, 4, 4]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/heatmap.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement heatmap.ts**

```ts
// src/heatmap.ts
import type { DailyData } from './data.js';

export interface GridCell {
  date: string;
  value: number;
  level: number; // -1 = no record, 0 = zero value, 1-4 = color tiers
}

export interface WeekData {
  monthLabel: string; // abbreviated month name for first week of month, '' otherwise
  cells: GridCell[];
}

export interface GridData {
  rows: { cells: GridCell[] }[];
  weeks: WeekData[];
  dayLabels: string[]; // Sun, Mon, Tue, Wed, Thu, Fri, Sat
  maxValue: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function computeLevel(value: number, thresholds: number[]): number {
  if (value === 0) return 0;
  if (thresholds.length === 0) return 4;
  for (let i = 0; i < thresholds.length; i++) {
    if (value <= thresholds[i]) return i + 1;
  }
  return 4;
}

function calcThresholds(values: number[]): number[] {
  const nonZero = values.filter(v => v > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return [];
  const p = (pct: number) => {
    const idx = Math.ceil((nonZero.length * pct) / 100) - 1;
    return nonZero[Math.max(0, idx)];
  };
  return [p(25), p(50), p(75)];
}

export function buildGrid(
  data: DailyData[],
  fromDate: string,
  toDate: string,
): GridData {
  const dataMap = new Map<string, number>();
  for (const d of data) {
    dataMap.set(d.date, d.value);
  }

  const allValues = data.map(d => d.value);
  const thresholds = calcThresholds(allValues);

  const start = new Date(fromDate + 'T00:00:00');
  const end = new Date(toDate + 'T00:00:00');

  // Collect all dates in range
  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  // Build weeks
  const weeks: WeekData[] = [];
  let currentWeek: Date[] = [];
  let lastMonth = '';

  for (const date of dates) {
    const dayOfWeek = date.getDay(); // 0=Sun
    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(finishWeek(currentWeek, dataMap, thresholds, lastMonth));
      currentWeek = [];
      lastMonth = '';
    }
    currentWeek.push(date);
    const monthName = MONTHS[date.getMonth()];
    if (lastMonth === '' && (currentWeek.length === 1 || date.getDate() <= 7)) {
      lastMonth = monthName;
    }
  }
  if (currentWeek.length > 0) {
    weeks.push(finishWeek(currentWeek, dataMap, thresholds, lastMonth));
  }

  // Transpose: weeks → 7 rows
  const rows = Array.from({ length: 7 }, (_rowIdx, rowIdx) => ({
    cells: weeks.map(week => week.cells[rowIdx] ?? { date: '', value: 0, level: -1 }),
  }));

  const maxValue = Math.max(...allValues, 0);

  return { rows, weeks, dayLabels: DAYS, maxValue };
}

function finishWeek(
  dates: Date[],
  dataMap: Map<string, number>,
  thresholds: number[],
  monthLabel: string,
): WeekData {
  // Pad the beginning of the week if it doesn't start on Sunday
  const cells: GridCell[] = [];
  const firstDay = dates[0].getDay();
  for (let i = 0; i < firstDay; i++) {
    cells.push({ date: '', value: 0, level: -1 });
  }

  for (const date of dates) {
    const dateStr = toDateStr(date);
    const value = dataMap.get(dateStr);
    if (value === undefined) {
      cells.push({ date: dateStr, value: 0, level: -1 });
    } else {
      cells.push({ date: dateStr, value, level: computeLevel(value, thresholds) });
    }
  }

  // Pad the end if week doesn't end on Saturday
  while (cells.length < 7) {
    cells.push({ date: '', value: 0, level: -1 });
  }

  return { monthLabel, cells };
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/heatmap.test.ts`
Expected: 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/heatmap.ts tests/heatmap.test.ts
git commit -m "feat: add heatmap grid builder with percentile color levels"
```

---

### Task 5: HTML Renderer (`render.ts`)

**Files:**
- Create: `src/render.ts`
- Create: `tests/render.test.ts`

- [ ] **Step 1: Write tests**

```ts
// tests/render.test.ts
import { describe, it, expect } from 'vitest';
import { renderHtml } from '../src/render.js';
import type { GridData } from '../src/heatmap.js';
import type { ThemeName } from '../src/colors.js';

const mockGrid: GridData = {
  weeks: [
    {
      monthLabel: 'Jun',
      cells: [
        { date: '2026-06-07', value: 0, level: 0 },
        { date: '2026-06-01', value: 100, level: 2 },
        { date: '2026-06-02', value: 0, level: 0 },
        { date: '2026-06-03', value: 50, level: 1 },
        { date: '2026-06-04', value: 0, level: 0 },
        { date: '2026-06-05', value: 0, level: 0 },
        { date: '2026-06-06', value: 0, level: 0 },
      ],
    },
  ],
  rows: [
    { cells: [{ date: '2026-06-07', value: 0, level: 0 }] },
    { cells: [{ date: '2026-06-01', value: 100, level: 2 }] },
    { cells: [{ date: '2026-06-02', value: 0, level: 0 }] },
    { cells: [{ date: '2026-06-03', value: 50, level: 1 }] },
    { cells: [{ date: '2026-06-04', value: 0, level: 0 }] },
    { cells: [{ date: '2026-06-05', value: 0, level: 0 }] },
    { cells: [{ date: '2026-06-06', value: 0, level: 0 }] },
  ],
  dayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  maxValue: 100,
};

describe('renderHtml', () => {
  it('returns a string containing HTML doctype', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes the metric label in title', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange');
    expect(html).toContain('tokens');
  });

  it('includes the theme name as a CSS class', () => {
    const html = renderHtml(mockGrid, 'messages', 'orange');
    expect(html).toMatch(/style/);
  });

  it('renders month labels', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange');
    expect(html).toContain('Jun');
  });

  it('renders day labels (Mon, Wed, Fri)', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange');
    expect(html).toContain('Mon');
    expect(html).toContain('Wed');
    expect(html).toContain('Fri');
  });

  it('renders legend', () => {
    const html = renderHtml(mockGrid, 'tokens', 'green');
    expect(html).toContain('Less');
    expect(html).toContain('More');
  });

  it('renders cell with correct data-level attribute', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange');
    expect(html).toMatch(/data-level="2"/);
  });

  it('escapes user-supplied strings to prevent XSS', () => {
    const html = renderHtml(mockGrid, '<script>alert(1)</script>', 'orange');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/render.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement render.ts**

```ts
// src/render.ts
import type { GridData } from './heatmap.js';
import { getColors, emptyColor, type ThemeName } from './colors.js';
import type { Metric } from './data.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatValue(value: number, _metric: string): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatTooltip(date: string, value: number, metric: string): string {
  const label = metric === 'tool-calls' ? 'tool calls' : metric;
  return `${date} · ${formatValue(value, metric)} ${label}`;
}

export function renderHtml(grid: GridData, metric: Metric, theme: ThemeName): string {
  const colors = getColors(theme);
  const label = esc(metric);
  const totalCols = grid.weeks.length + 1; // +1 for day label column
  const totalRows = 8; // 1 month label row + 7 day rows

  // Build day labels (Mon, Wed, Fri) in column 1
  let dayLabelsHtml = '';
  for (let i = 0; i < 7; i++) {
    if (i % 2 === 1) {
      dayLabelsHtml +=
        `<div class="day-label" style="grid-column:1;grid-row:${i + 2}">${esc(grid.dayLabels[i])}</div>`;
    }
  }
  let monthLabelsHtml = '';
  for (const [weekIdx, week] of grid.weeks.entries()) {
    if (week.monthLabel) {
      monthLabelsHtml +=
        `<div style="grid-column:${weekIdx + 2};grid-row:1" class="month-label">${esc(week.monthLabel)}</div>`;
    }
  }

  // Build day cells with explicit grid positioning
  let cellsHtml = '';
  for (const [weekIdx, week] of grid.weeks.entries()) {
    for (const [dayIdx, cell] of week.cells.entries()) {
      const col = weekIdx + 2; // column 1 is day labels
      const row = dayIdx + 2;  // row 1 is month labels

      if (cell.date === '') {
        cellsHtml += `<div style="grid-column:${col};grid-row:${row}" class="cell empty-pad"></div>`;
        continue;
      }

      let bg: string;
      let tooltip: string;
      if (cell.level === -1) {
        bg = `${emptyColor};opacity:0.25`;
        tooltip = `${esc(cell.date)} · No data`;
      } else if (cell.level === 0) {
        bg = colors[0];
        tooltip = formatTooltip(cell.date, 0, label);
      } else {
        bg = colors[cell.level - 1];
        tooltip = formatTooltip(cell.date, cell.value, label);
      }
      cellsHtml +=
        `<div class="cell" style="grid-column:${col};grid-row:${row};background:${bg}" title="${esc(tooltip)}" data-level="${cell.level}"></div>`;
    }
  }

  // Legend boxes
  const legendBoxes = colors
    .map((c, i) => `<div class="legend-box" style="background:${c}"></div>`)
    .join('');

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
.cell.empty-pad { background: transparent; }
.day-label {
  font-size: 10px;
  line-height: 13px;
  color: #6e7681;
  display: flex;
  align-items: center;
}
.legend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 1rem;
  font-size: 11px;
  color: #6e7681;
}
.legend-box {
  width: 13px;
  height: 13px;
  border-radius: 2px;
}
</style>
</head>
<body>
<div class="container">
  <h1>Claude Code · ${label}</h1>
  <div class="grid-wrapper">
    <div class="heatmap-grid">
      ${dayLabelsHtml}
      ${monthLabelsHtml}
      ${cellsHtml}
    </div>
  </div>
  <div class="legend">
    <span>Less</span>
    ${legendBoxes}
    <span>More</span>
  </div>
</div>
</body>
</html>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/render.test.ts`
Expected: 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/render.ts tests/render.test.ts
git commit -m "feat: add HTML renderer with GitHub-style grid layout"
```

---

### Task 6: CLI Entry (`cli.ts`)

**Files:**
- Create: `src/cli.ts`
- Create: `tests/cli.test.ts`
- Create: `bin/cc-heatmap.js`

- [ ] **Step 1: Write tests**

```ts
// tests/cli.test.ts
import { describe, it, expect } from 'vitest';
import { parseArgs } from '../src/cli.js';
import type { CliOptions } from '../src/cli.js';
import { homedir } from 'node:os';
import { join } from 'node:path';

describe('parseArgs', () => {
  it('returns defaults with no arguments', () => {
    const opts = parseArgs([]);
    expect(opts.metric).toBe('tokens');
    expect(opts.theme).toBe('orange');
    expect(opts.days).toBe(365);
    expect(opts.dbPath).toBe(join(homedir(), '.claude', 'usage.db'));
  });

  it('parses --days', () => {
    const opts = parseArgs(['--days', '90']);
    expect(opts.days).toBe(90);
  });

  it('parses --from and --to', () => {
    const opts = parseArgs(['--from', '2026-01-01', '--to', '2026-06-01']);
    expect(opts.fromDate).toBe('2026-01-01');
    expect(opts.toDate).toBe('2026-06-01');
  });

  it('--from without --to uses today', () => {
    const opts = parseArgs(['--from', '2026-01-01']);
    expect(opts.fromDate).toBe('2026-01-01');
    expect(opts.toDate).toBeTruthy(); // today's date
  });

  it('parses --metric', () => {
    expect(parseArgs(['--metric', 'tokens']).metric).toBe('tokens');
    expect(parseArgs(['--metric', 'messages']).metric).toBe('messages');
    expect(parseArgs(['--metric', 'tool-calls']).metric).toBe('tool-calls');
  });

  it('rejects invalid --metric', () => {
    expect(() => parseArgs(['--metric', 'invalid'])).toThrow('Invalid metric');
  });

  it('parses --theme', () => {
    expect(parseArgs(['--theme', 'green']).theme).toBe('green');
    expect(parseArgs(['--theme', 'purple']).theme).toBe('purple');
  });

  it('rejects invalid --theme', () => {
    expect(() => parseArgs(['--theme', 'blue'])).toThrow('Invalid theme');
  });

  it('parses --output', () => {
    const opts = parseArgs(['--output', '/tmp/out.html']);
    expect(opts.output).toBe('/tmp/out.html');
  });

  it('parses --db', () => {
    const opts = parseArgs(['--db', '/custom/path/usage.db']);
    expect(opts.dbPath).toBe('/custom/path/usage.db');
  });

  it('parses -h alias', () => {
    const opts = parseArgs(['-h']);
    expect(opts).toBeNull(); // help requested
  });

  it('parses --help', () => {
    const opts = parseArgs(['--help']);
    expect(opts).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/cli.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement cli.ts**

```ts
// src/cli.ts
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Metric } from './data.js';
import type { ThemeName } from './colors.js';

export interface CliOptions {
  days: number;
  fromDate?: string;
  toDate?: string;
  metric: Metric;
  output?: string;
  theme: ThemeName;
  dbPath: string;
}

const VALID_METRICS: Metric[] = ['tokens', 'messages', 'tool-calls'];
const VALID_THEMES: ThemeName[] = ['orange', 'green', 'purple'];

const HELP = `cc-heatmap — Visualize Claude Code usage as a GitHub-style heatmap

Usage: cc-heatmap [options]

Options:
  --days <n>        Number of days to show (default: 365)
  --from <date>     Start date YYYY-MM-DD (overrides --days when used with --to)
  --to <date>       End date YYYY-MM-DD
  --metric <name>   Metric: tokens | messages | tool-calls (default: tokens)
  --output <path>   Output HTML file path (default: cc-heatmap-<today>.html)
  --theme <name>    Color theme: orange | green | purple (default: orange)
  --db <path>       Path to usage.db (default: ~/.claude/usage.db)
  --help, -h        Show this help
`;

export function parseArgs(argv: string[]): CliOptions | null {
  const opts: Partial<CliOptions> = {};
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    switch (arg) {
      case '-h':
      case '--help':
        process.stdout.write(HELP);
        return null;

      case '--days': {
        const val = argv[++i];
        const n = parseInt(val, 10);
        if (isNaN(n) || n <= 0) throw new Error(`Invalid --days value: ${val}`);
        opts.days = n;
        break;
      }

      case '--from':
        opts.fromDate = argv[++i];
        break;

      case '--to':
        opts.toDate = argv[++i];
        break;

      case '--metric': {
        const val = argv[++i] as Metric;
        if (!VALID_METRICS.includes(val)) {
          throw new Error(`Invalid metric: ${val}. Must be one of: ${VALID_METRICS.join(', ')}`);
        }
        opts.metric = val;
        break;
      }

      case '--theme': {
        const val = argv[++i] as ThemeName;
        if (!VALID_THEMES.includes(val)) {
          throw new Error(`Invalid theme: ${val}. Must be one of: ${VALID_THEMES.join(', ')}`);
        }
        opts.theme = val;
        break;
      }

      case '--output':
        opts.output = argv[++i];
        break;

      case '--db':
        opts.dbPath = argv[++i];
        break;

      default:
        throw new Error(`Unknown option: ${arg}. Use --help for usage.`);
    }
    i++;
  }

  return {
    days: opts.days ?? 365,
    fromDate: opts.fromDate,
    toDate: opts.toDate,
    metric: opts.metric ?? 'tokens',
    output: opts.output,
    theme: opts.theme ?? 'orange',
    dbPath: opts.dbPath ?? join(homedir(), '.claude', 'usage.db'),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/cli.test.ts`
Expected: 12 tests PASS

- [ ] **Step 5: Create bin/cc-heatmap.js shebang entry**

```bash
mkdir -p bin

cat > bin/cc-heatmap.js << 'SHEBANG'
#!/usr/bin/env node
import('../dist/cli.js').then(m => m.main()).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
SHEBANG
chmod +x bin/cc-heatmap.js
```

- [ ] **Step 6: Update package.json bin path**

Edit `package.json` — change `"./bin/cc-heatmap"` to `"./bin/cc-heatmap.js"`

- [ ] **Step 7: Commit**

```bash
git add src/cli.ts tests/cli.test.ts bin/cc-heatmap.js package.json
git commit -m "feat: add CLI argument parser and bin entry"
```

---

### Task 7: CLI Main Function & Orchestration

**Files:**
- Modify: `src/cli.ts` (add `main` export, date computation)

- [ ] **Step 1: Write integration test**

```ts
// tests/main.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// We'll test the computeDateRange and output path logic in isolation,
// and do a smoke test of main()

import { computeDateRange, defaultOutputPath } from '../src/cli.js';

describe('computeDateRange', () => {
  it('uses --from and --to when both provided', () => {
    const [from, to] = computeDateRange({ fromDate: '2026-01-01', toDate: '2026-01-31' });
    expect(from).toBe('2026-01-01');
    expect(to).toBe('2026-01-31');
  });

  it('uses --from with today when --to not provided', () => {
    const [from, to] = computeDateRange({ fromDate: '2026-01-01' });
    expect(from).toBe('2026-01-01');
    expect(to).toBe(todayStr());
  });

  it('uses --days to compute start from today', () => {
    const [from, to] = computeDateRange({ days: 7 });
    expect(to).toBe(todayStr());
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diff = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
    expect(diff).toBe(6); // 7 days including today → 6 days back
  });

  it('defaults to 365 days when no range specified', () => {
    const [from, to] = computeDateRange({ days: 365 });
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diff = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
    expect(diff).toBe(364);
  });
});

describe('defaultOutputPath', () => {
  it('generates filename with today date', () => {
    const path = defaultOutputPath();
    expect(path).toContain('cc-heatmap-');
    expect(path).toMatch(/\.html$/);
  });
});

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/main.test.ts`
Expected: FAIL — `computeDateRange` not exported

- [ ] **Step 3: Add main() and helper functions to cli.ts**

Edit `src/cli.ts` — append after the `parseArgs` function:

```ts
// Append to src/cli.ts (after parseArgs)

import { QueryOptions } from 'node:sqlite';
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, existsSync } from 'node:fs';
import { queryDailyData } from './data.js';
import { buildGrid } from './heatmap.js';
import { renderHtml } from './render.js';

export function computeDateRange(
  opts: Pick<CliOptions, 'days' | 'fromDate' | 'toDate'>,
): [string, string] {
  const today = new Date();
  const todayStr = toDateStr(today);

  if (opts.fromDate && opts.toDate) {
    return [opts.fromDate, opts.toDate];
  }

  if (opts.fromDate) {
    return [opts.fromDate, todayStr];
  }

  const days = opts.days ?? 365;
  const from = new Date(today);
  from.setDate(from.getDate() - days + 1);
  return [toDateStr(from), todayStr];
}

export function defaultOutputPath(): string {
  return `cc-heatmap-${toDateStr(new Date())}.html`;
}

export async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts) return; // help displayed

  if (!existsSync(opts.dbPath)) {
    process.stderr.write(`Error: usage.db not found at ${opts.dbPath}\n`);
    process.exit(1);
  }

  const [fromDate, toDate] = computeDateRange(opts);
  const data = queryDailyData(opts.dbPath, fromDate, toDate, opts.metric);
  const grid = buildGrid(data, fromDate, toDate);
  const html = renderHtml(grid, opts.metric, opts.theme);

  const outputPath = opts.output ?? defaultOutputPath();
  writeFileSync(outputPath, html, 'utf-8');
  process.stdout.write(`Heatmap saved to ${outputPath}\n`);
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS (37+ tests across 6 suites)

- [ ] **Step 5: Build and smoke test**

```bash
npx tsc
node bin/cc-heatmap --days 30
```

Expected: Creates `cc-heatmap-<today>.html` file

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts tests/main.test.ts
git commit -m "feat: add main orchestration function"
```

---

### Task 8: Final Integration Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```
Expected: All tests PASS

- [ ] **Step 2: Build and smoke test against real data**

```bash
npx tsc
node bin/cc-heatmap --days 90 --metric tokens --theme orange
```
Expected: `cc-heatmap-<today>.html` created, opens in browser showing a valid heatmap

- [ ] **Step 3: Test with different metrics**

```bash
node bin/cc-heatmap --days 30 --metric messages --theme green
node bin/cc-heatmap --days 30 --metric tool-calls --theme purple
```

- [ ] **Step 4: Test with --from/--to**

```bash
node bin/cc-heatmap --from 2026-04-01 --to 2026-04-30
```

- [ ] **Step 5: Test help**

```bash
node bin/cc-heatmap --help
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: final integration verification"
```
