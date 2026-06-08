import { describe, it, expect } from 'vitest';
import { renderHtml } from '../src/render.js';
import type { GridData } from '../src/heatmap.js';

// 2026-06-01 is Monday. Sparse week: only cells at their day-of-week index
const mockGrid: GridData = {
  weeks: [
    {
      monthLabel: 'Jun',
      cells: [
        // 0=Sun: undefined (not in range)
        { date: '2026-06-01', value: 100, level: 2 },               // 1=Mon
        { date: '2026-06-02', value: 0, level: 0 },                 // 2=Tue
        { date: '2026-06-03', value: 50, level: 1 },                // 3=Wed
        // 4=Thu, 5=Fri, 6=Sat: undefined (not in range)
      ],
    },
  ],
  rows: [
    { cells: [{ date: '', value: 0, level: -1 }] },
    { cells: [{ date: '2026-06-01', value: 100, level: 2 }] },
    { cells: [{ date: '2026-06-02', value: 0, level: 0 }] },
    { cells: [{ date: '2026-06-03', value: 50, level: 1 }] },
    { cells: [{ date: '', value: 0, level: -1 }] },
    { cells: [{ date: '', value: 0, level: -1 }] },
    { cells: [{ date: '', value: 0, level: -1 }] },
  ],
  dayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  maxValue: 100,
  totalValue: 150,
};

describe('renderHtml', () => {
  it('returns HTML doctype', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange', 'dark');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes the metric label', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange', 'dark');
    expect(html).toContain('tokens');
  });

  it('renders month labels', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange', 'dark');
    expect(html).toContain('Jun');
  });

  it('renders day labels (Mon, Wed, Fri)', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange', 'dark');
    expect(html).toContain('Mon');
    expect(html).toContain('Wed');
    expect(html).toContain('Fri');
  });

  it('renders legend', () => {
    const html = renderHtml(mockGrid, 'tokens', 'green', 'dark');
    expect(html).toContain('Less');
    expect(html).toContain('More');
  });

  it('renders cell with data-lv attribute', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange', 'dark');
    expect(html).toContain('data-lv="2"');
  });

  it('renders tooltip with date and value', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange', 'dark');
    expect(html).toContain('2026-06-01');
    expect(html).toContain('100');
  });

  it('renders total value prominently', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange', 'dark');
    expect(html).toContain('150');
    expect(html).toContain('<h1>');
  });

  it('escapes user-supplied strings to prevent XSS', () => {
    const html = renderHtml(mockGrid, '<script>alert(1)</script>', 'orange', 'dark');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('uses light mode colors', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange', 'light');
    expect(html).toContain('#ffffff');
    expect(html).toContain('#f6f8fa');
  });

  it('uses dark mode colors', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange', 'dark');
    expect(html).toContain('#0d1117');
    expect(html).toContain('#161b22');
  });
});
