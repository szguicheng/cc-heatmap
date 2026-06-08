import { describe, it, expect } from 'vitest';
import { renderHtml } from '../src/render.js';
import { noDataColor } from '../src/colors.js';
import type { GridData } from '../src/heatmap.js';

// 2026-06-01 is Monday. Week layout by day-of-week (0=Sun..6=Sat):
// Sun: empty, Mon: 100/level2, Tue: 0/level0, Wed: 50/level1, Thu-Sat: out of range
const mockGrid: GridData = {
  weeks: [
    {
      monthLabel: 'Jun',
      cells: [
        { date: '', value: 0, level: -1 },                          // Sun
        { date: '2026-06-01', value: 100, level: 2 },               // Mon
        { date: '2026-06-02', value: 0, level: 0 },                 // Tue
        { date: '2026-06-03', value: 50, level: 1 },                // Wed
        { date: '', value: 0, level: -1 },                          // Thu
        { date: '', value: 0, level: -1 },                          // Fri
        { date: '', value: 0, level: -1 },                          // Sat
      ],
    },
    {
      monthLabel: '',
      cells: [
        { date: '', value: 0, level: -1 },                          // Sun
        { date: '', value: 0, level: -1 },                          // Mon
        { date: '', value: 0, level: -1 },                          // Tue
        { date: '2026-06-10', value: 0, level: -1 },                // Wed (no data day)
        { date: '', value: 0, level: -1 },                          // Thu
        { date: '', value: 0, level: -1 },                          // Fri
        { date: '', value: 0, level: -1 },                          // Sat
      ],
    },
  ],
  rows: [
    { cells: [{ date: '', value: 0, level: -1 }, { date: '', value: 0, level: -1 }] },
    { cells: [{ date: '2026-06-01', value: 100, level: 2 }, { date: '', value: 0, level: -1 }] },
    { cells: [{ date: '2026-06-02', value: 0, level: 0 }, { date: '', value: 0, level: -1 }] },
    { cells: [{ date: '2026-06-03', value: 50, level: 1 }, { date: '2026-06-10', value: 0, level: -1 }] },
    { cells: [{ date: '', value: 0, level: -1 }, { date: '', value: 0, level: -1 }] },
    { cells: [{ date: '', value: 0, level: -1 }, { date: '', value: 0, level: -1 }] },
    { cells: [{ date: '', value: 0, level: -1 }, { date: '', value: 0, level: -1 }] },
  ],
  dayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  maxValue: 100,
  totalValue: 150,
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

  it('renders tooltip with date and value', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange');
    expect(html).toContain('2026-06-01');
    expect(html).toContain('100');
  });

  it('escapes user-supplied strings to prevent XSS', () => {
    const html = renderHtml(mockGrid, '<script>alert(1)</script>', 'orange');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('renders no-data cells with grey background', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange');
    expect(html).toContain(noDataColor);
    expect(html).toContain('2026-06-10');
    expect(html).toContain('No data');
  });

  it('renders total value in footer', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange');
    expect(html).toContain('150');
    expect(html).toContain('total');
  });
});
