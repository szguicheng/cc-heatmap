import { describe, it, expect } from 'vitest';
import { renderHtml } from '../src/render.js';
import type { GridData } from '../src/heatmap.js';

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
});
