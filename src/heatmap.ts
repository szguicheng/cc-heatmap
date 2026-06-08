import type { DailyData } from './data.js';

export interface GridCell {
  date: string;
  value: number;
  level: number; // -1 = no record, 0 = zero value, 1-4 = color tiers
}

export interface WeekData {
  monthLabel: string;
  cells: GridCell[];
}

export interface GridData {
  rows: { cells: GridCell[] }[];
  weeks: WeekData[];
  dayLabels: string[];
  maxValue: number;
  totalValue: number;
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

  // Collect all dates into weeks (Sun-Sat)
  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const rawWeeks: Date[][] = [];
  let currentRaw: Date[] = [];

  for (const date of dates) {
    if (date.getDay() === 0 && currentRaw.length > 0) {
      rawWeeks.push(currentRaw);
      currentRaw = [];
    }
    currentRaw.push(date);
  }
  if (currentRaw.length > 0) {
    rawWeeks.push(currentRaw);
  }

  // Determine month labels: label a week with a month if any date in that
  // week falls in that month AND that month hasn't been labeled yet.
  const emittedMonths = new Set<string>();
  const weeks: WeekData[] = [];

  for (const weekDates of rawWeeks) {
    let label = '';
    for (const d of weekDates) {
      const m = MONTHS[d.getMonth()];
      if (!emittedMonths.has(m)) {
        label = m;
        emittedMonths.add(m);
        break;
      }
    }
    weeks.push(finishWeek(weekDates, dataMap, thresholds, label));
  }

  const rows = Array.from({ length: 7 }, (_rowIdx, rowIdx) => ({
    cells: weeks.map(week => week.cells[rowIdx] ?? { date: '', value: 0, level: -1 }),
  }));

  const maxValue = Math.max(...allValues, 0);
  const totalValue = allValues.reduce((a, b) => a + b, 0);

  return { rows, weeks, dayLabels: DAYS, maxValue, totalValue };
}

function finishWeek(
  dates: Date[],
  dataMap: Map<string, number>,
  thresholds: number[],
  monthLabel: string,
): WeekData {
  const cells: GridCell[] = [];

  // Build 7-slot array, positioned by day of week
  for (const date of dates) {
    const dateStr = toDateStr(date);
    const dayIdx = date.getDay(); // 0=Sun
    const value = dataMap.get(dateStr);
    if (value === undefined) {
      cells[dayIdx] = { date: dateStr, value: 0, level: -1 };
    } else {
      cells[dayIdx] = { date: dateStr, value, level: computeLevel(value, thresholds) };
    }
  }

  // Fill any missing slots with empty cells
  for (let i = 0; i < 7; i++) {
    if (!cells[i]) {
      cells[i] = { date: '', value: 0, level: -1 };
    }
  }

  return { monthLabel, cells };
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
