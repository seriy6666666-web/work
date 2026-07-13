import { COLORS, RADIUS } from '../theme';

export function AlertBanner({
  text,
  actionLabel,
  onAction,
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '14px 20px',
        borderRadius: RADIUS.md,
        background: COLORS.errorBg,
        border: `1px solid ${COLORS.error}22`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{ fontSize: '16px' }}>⚠️</span>
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: COLORS.error, fontSize: '14px' }}>Требует внимания</p>
          <p style={{ margin: '2px 0 0', color: COLORS.darkText, fontSize: '13px' }}>{text}</p>
        </div>
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            padding: '8px 16px',
            borderRadius: RADIUS.sm,
            border: 'none',
            background: COLORS.error,
            color: COLORS.white,
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
