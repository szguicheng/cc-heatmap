import { describe, it, expect } from 'vitest';
import { renderHtml } from '../src/render.js';
import type { GridData } from '../src/heatmap.js';

// 2026-06-01 is Monday. Week layout by day-of-week (0=Sun..6=Sat)
const mockGrid: GridData = {
  weeks: [
    {
      monthLabel: 'Jun',
      cells: [
        { date: '', value: 0, level: -1 },
        { date: '2026-06-01', value: 100, level: 2 },
        { date: '2026-06-02', value: 0, level: 0 },
        { date: '2026-06-03', value: 50, level: 1 },
        { date: '', value: 0, level: -1 },
        { date: '', value: 0, level: -1 },
        { date: '', value: 0, level: -1 },
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
  it('returns a string containing HTML doctype', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange', 'dark');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes the metric label in title', () => {
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

  it('renders cell with correct data-lv attribute', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange', 'dark');
    expect(html).toContain('data-lv="2"');
  });

  it('renders tooltip with date and value', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange', 'dark');
    expect(html).toContain('2026-06-01');
    expect(html).toContain('100');
  });

  it('renders total value in footer', () => {
    const html = renderHtml(mockGrid, 'tokens', 'orange', 'dark');
    expect(html).toContain('150');
    expect(html).toContain('tt');
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
