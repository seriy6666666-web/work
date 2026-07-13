import { COLORS, RADIUS } from '../theme';

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const ratio = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ flex: 1, height: '8px', borderRadius: RADIUS.pill, background: COLORS.lightGreenBg }}>
        <div
          style={{
            width: `${ratio * 100}%`,
            height: '100%',
            borderRadius: RADIUS.pill,
            background: COLORS.accent,
          }}
        />
      </div>
      <span style={{ fontSize: '13px', color: COLORS.mutedText, whiteSpace: 'nowrap' }}>
        {done} / {total}
      </span>
    </div>
  );
}
