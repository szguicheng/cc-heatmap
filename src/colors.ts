export type ThemeName = 'orange' | 'green' | 'purple';

export const themes: Record<ThemeName, readonly string[]> = {
  orange: ['#fde6d2', '#f7b37a', '#f08a3d', '#e0681e', '#b8450d'],
  green: ['#d2f3d2', '#7bc96e', '#40a335', '#21731a', '#0f4d0c'],
  purple: ['#e8d5f5', '#b77dd6', '#8e4db8', '#6b2d94', '#481a6e'],
};

export const noDataColor = '#161b22';
export const emptyColor = '#1a1a2e';

export function getColors(name: ThemeName): readonly string[] {
  const colors = themes[name];
  if (!colors) throw new Error(`Unknown theme: ${name}`);
  return colors;
}
