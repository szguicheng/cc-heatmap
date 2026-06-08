export type ThemeName = 'orange' | 'green' | 'purple';
export type ModeName = 'dark' | 'light';

export const themes: Record<ThemeName, readonly string[]> = {
  orange: ['#fde6d2', '#f7b37a', '#f08a3d', '#e0681e', '#b8450d'],
  green: ['#d2f3d2', '#7bc96e', '#40a335', '#21731a', '#0f4d0c'],
  purple: ['#e8d5f5', '#b77dd6', '#8e4db8', '#6b2d94', '#481a6e'],
};

export interface ModeColors {
  bodyBg: string;
  containerBg: string;
  containerBorder: string;
  textColor: string;
  headingColor: string;
  mutedColor: string;
  noDataCell: string;
}

export const modes: Record<ModeName, ModeColors> = {
  dark: {
    bodyBg: '#0d1117',
    containerBg: '#161b22',
    containerBorder: '#30363d',
    textColor: '#c9d1d9',
    headingColor: '#f0f6fc',
    mutedColor: '#6e7681',
    noDataCell: '#21262d',
  },
  light: {
    bodyBg: '#ffffff',
    containerBg: '#f6f8fa',
    containerBorder: '#d0d7de',
    textColor: '#1f2328',
    headingColor: '#1f2328',
    mutedColor: '#656d76',
    noDataCell: '#ebedf0',
  },
};

export function getColors(name: ThemeName): readonly string[] {
  const c = themes[name];
  if (!c) throw new Error(`Unknown theme: ${name}`);
  return c;
}

export function getModeColors(name: ModeName): ModeColors {
  const m = modes[name];
  if (!m) throw new Error(`Unknown mode: ${name}`);
  return m;
}
