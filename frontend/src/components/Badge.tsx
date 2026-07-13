import { COLORS, RADIUS } from '../theme';

export type BadgeVariant = 'priority-high' | 'priority-medium' | 'shared' | 'danger' | 'muted' | 'accent';

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; color: string }> = {
  'priority-high': { bg: COLORS.errorBg, color: COLORS.error },
  'priority-medium': { bg: COLORS.warningBg, color: COLORS.warning },
  shared: { bg: COLORS.infoBg, color: COLORS.info },
  danger: { bg: COLORS.errorBg, color: COLORS.error },
  muted: { bg: COLORS.lightGrayBg, color: COLORS.mutedText },
  accent: { bg: COLORS.lightGreenBg, color: COLORS.accentDark },
};

export function Badge({ variant, children }: { variant: BadgeVariant; children: React.ReactNode }) {
  const { bg, color } = VARIANT_STYLES[variant];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: RADIUS.pill,
        background: bg,
        color,
        fontSize: '12px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
