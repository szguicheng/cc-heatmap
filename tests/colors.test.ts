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
    for (const [, colors] of Object.entries(themes)) {
      expect(colors, `should have 5 colors`).toHaveLength(5);
    }
  });
});
