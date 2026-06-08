import { describe, it, expect } from 'vitest';
import { getColors, getModeColors, themes, modes, type ThemeName, type ModeName } from '../src/colors.js';

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
    for (const [, colors] of Object.entries(themes)) {
      expect(colors, `should have 5 colors`).toHaveLength(5);
    }
  });
});

describe('getModeColors', () => {
  it('returns dark mode colors', () => {
    const m = getModeColors('dark');
    expect(m.bodyBg).toMatch(/^#[0-9a-f]{6}$/);
    expect(m.containerBg).toBeTruthy();
    expect(m.noDataCell).toBeTruthy();
  });

  it('returns light mode colors', () => {
    const m = getModeColors('light');
    expect(m.bodyBg).toMatch(/^#[0-9a-f]{6}$/);
    expect(m.noDataCell).toBeTruthy();
  });

  it('throws for unknown mode', () => {
    expect(() => getModeColors('system' as ModeName)).toThrow('Unknown mode');
  });

  it('dark and light have different body backgrounds', () => {
    expect(getModeColors('dark').bodyBg).not.toBe(getModeColors('light').bodyBg);
  });

  it('both modes are defined', () => {
    expect(Object.keys(modes)).toHaveLength(2);
  });
});
