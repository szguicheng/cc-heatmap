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
    // 2026-06-01 is a Monday (JS getDay() = 1)
    const data: DailyData[] = [{ date: '2026-06-01', value: 100 }];
    const grid = buildGrid(data, '2026-06-01', '2026-06-01');

    // Row 0 = Sun, Row 1 = Mon
    const monCell = grid.rows[1].cells[0];
    expect(monCell.date).toBe('2026-06-01');
    expect(monCell.value).toBe(100);
  });

  it('fills empty cells for days with no data', () => {
    const data: DailyData[] = [{ date: '2026-06-01', value: 100 }];
    const grid = buildGrid(data, '2026-06-01', '2026-06-03');

    // 2026-06-02 has no data — should exist as empty cell, Tue = row 2
    const tueCell = grid.rows[2].cells[0];
    expect(tueCell.date).toBe('2026-06-02');
    expect(tueCell.value).toBe(0);
    expect(tueCell.level).toBe(-1);
  });

  it('computes correct month labels', () => {
    const data: DailyData[] = [
      { date: '2026-05-31', value: 100 },
      { date: '2026-06-07', value: 200 },
    ];
    const grid = buildGrid(data, '2026-05-31', '2026-06-20');

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

    const levels = grid.rows.flatMap(r => r.cells).map(c => c.level).filter(l => l >= 0);
    // 10 → level 1 (≤P25=50), 50 → level 1 (≤P25), 100 → level 2 (≤P50), 200 → level 3 (≤P75), 1000 → level 4 (>P75)
    expect(levels).toEqual([1, 1, 2, 3, 4]);
  });
});
