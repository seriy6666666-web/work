// Colors reference CSS variables defined in index.css so the whole app can
// switch between light and dark themes at runtime (see theme-mode.ts).
export const COLORS = {
  darkBg: 'var(--c-dark-bg)',
  accent: 'var(--c-accent)',
  accentDark: 'var(--c-accent-dark)',
  lightGreenBg: 'var(--c-surface-alt)',
  lightGrayBg: 'var(--c-page-bg)',
  mutedText: 'var(--c-muted-text)',
  darkText: 'var(--c-text)',
  white: 'var(--c-surface)',
  error: 'var(--c-error)',
  errorBg: 'var(--c-error-bg)',
  warning: 'var(--c-warning)',
  warningBg: 'var(--c-warning-bg)',
  info: 'var(--c-info)',
  infoBg: 'var(--c-info-bg)',
};

export const RADIUS = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  pill: '999px',
};

export const SHADOW = {
  card: 'var(--shadow-card)',
  raised: 'var(--shadow-raised)',
};

export const AVATAR_PALETTE = ['#4caf82', '#2f6fb0', '#b8860b', '#8e5fd1', '#d1637f', '#3d9970'];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}
