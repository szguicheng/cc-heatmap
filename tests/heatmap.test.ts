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

  it('handles empty thresholds', () => {
    expect(computeLevel(100, [])).toBe(4);
  });

  it('handles single value in thresholds', () => {
    expect(computeLevel(5, [10])).toBe(1);
    expect(computeLevel(15, [10])).toBe(4);
  });
});

describe('buildGrid', () => {
  it('builds a grid with 7 rows', () => {
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

    // Row 1 = Mon, should have the cell
    const monCell = grid.rows[1].cells[0];
    expect(monCell.date).toBe('2026-06-01');
    expect(monCell.value).toBe(100);
  });

  it('includes all dates in range, no padding', () => {
    const data: DailyData[] = [{ date: '2026-06-01', value: 100 }];
    const grid = buildGrid(data, '2026-06-01', '2026-06-03');

    // One week with Mon-Wed: Week has 3 cells at indices 1,2,3 (Mon,Tue,Wed)
    expect(grid.weeks).toHaveLength(1);
    const week = grid.weeks[0];
    expect(week.cells[0]).toBeUndefined(); // Sun - not in range
    expect(week.cells[1]!.date).toBe('2026-06-01'); // Mon
    expect(week.cells[2]!.date).toBe('2026-06-02'); // Tue - in range, no data
    expect(week.cells[3]!.date).toBe('2026-06-03'); // Wed - in range, no data
    expect(week.cells[4]).toBeUndefined(); // Thu - not in range
  });

  it('no-data day is in range but has level -1', () => {
    const data: DailyData[] = [{ date: '2026-06-01', value: 100 }];
    const grid = buildGrid(data, '2026-06-01', '2026-06-03');

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

  it('last week ends at toDate, not Saturday', () => {
    // 2026-06-03 is Wednesday. Range Mon-Fri: June 1-5
    const data: DailyData[] = [
      { date: '2026-06-01', value: 10 },
    ];
    const grid = buildGrid(data, '2026-06-01', '2026-06-05');

    // Single week, Mon-Fri. No cells for Sun(0) or Sat(6)
    const week = grid.weeks[0];
    expect(week.cells[0]).toBeUndefined(); // Sun not in range
    expect(week.cells[1]!.date).toBe('2026-06-01'); // Mon
    expect(week.cells[5]!.date).toBe('2026-06-05'); // Fri
    expect(week.cells[6]).toBeUndefined(); // Sat not in range
    expect(grid.weeks).toHaveLength(1);
  });

  it('computes totalValue as sum of all values', () => {
    const data: DailyData[] = [
      { date: '2026-06-01', value: 100 },
      { date: '2026-06-02', value: 200 },
      { date: '2026-06-03', value: 50 },
    ];
    const grid = buildGrid(data, '2026-06-01', '2026-06-03');
    expect(grid.totalValue).toBe(350);
  });
});
