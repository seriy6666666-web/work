import type { ReactNode } from 'react';
import { COLORS, RADIUS, SHADOW } from '../theme';
import { ProgressRing } from './ProgressRing';

export function StatCard({
  label,
  value,
  hint,
  ring,
  alert,
  extra,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  ring?: number;
  alert?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: '200px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '18px 20px',
        borderRadius: RADIUS.md,
        background: alert ? COLORS.errorBg : COLORS.white,
        boxShadow: SHADOW.card,
      }}
    >
      {ring !== undefined && <ProgressRing ratio={ring} size={56} />}
      <div>
        <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: alert ? COLORS.error : COLORS.mutedText, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {label}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: 700, color: alert ? COLORS.error : COLORS.darkText }}>
          {value}
        </p>
        {hint && (
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: alert ? COLORS.error : COLORS.mutedText }}>
            {hint}
          </p>
        )}
        {extra}
      </div>
    </div>
  );
}
