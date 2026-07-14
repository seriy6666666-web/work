import { COLORS, RADIUS } from '../theme';

export interface BarDatum {
  label: string;
  value: number | null; // 0..1 ratio, or null for "no data"
  sub?: string;
}

/**
 * Horizontal bar chart for comparing a small set of named categories
 * (sites, workers). Values are 0..1 ratios rendered as percentages.
 */
export function BarChart({
  data,
  title,
  threshold,
}: {
  data: BarDatum[];
  title?: string;
  threshold?: number; // draws a reference line; bars below it turn warning-colored
}) {
  const sorted = [...data].sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  return (
    <div style={styles.wrap}>
      {title && <p style={styles.title}>{title}</p>}
      <div style={styles.rows}>
        {sorted.map((d) => {
          const pct = d.value === null ? 0 : Math.round(d.value * 100);
          const below = threshold !== undefined && d.value !== null && d.value < threshold;
          const barColor = d.value === null ? COLORS.mutedText : below ? COLORS.warning : COLORS.accent;
          return (
            <div key={d.label} style={styles.row}>
              <div style={styles.labelCol}>
                <span style={styles.label} title={d.label}>
                  {d.label}
                </span>
                {d.sub && <span style={styles.sub}>{d.sub}</span>}
              </div>
              <div style={styles.track}>
                <div
                  style={{
                    ...styles.bar,
                    width: `${d.value === null ? 2 : Math.min(Math.max(pct, 2), 100)}%`,
                    background: barColor,
                    opacity: d.value === null ? 0.4 : 1,
                  }}
                />
                {threshold !== undefined && (
                  <div style={{ ...styles.thresholdLine, left: `${Math.round(threshold * 100)}%` }} />
                )}
              </div>
              <span style={styles.value}>{d.value === null ? '—' : `${pct}%`}</span>
            </div>
          );
        })}
        {sorted.length === 0 && <p style={styles.sub}>Нет данных за период.</p>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    background: COLORS.lightGrayBg,
    borderRadius: RADIUS.md,
    padding: '16px 18px',
  },
  title: {
    margin: '0 0 14px',
    fontSize: '14px',
    fontWeight: 700,
    color: COLORS.darkText,
  },
  rows: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  labelCol: {
    width: '150px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.darkText,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sub: {
    fontSize: '11px',
    color: COLORS.mutedText,
  },
  track: {
    position: 'relative',
    flex: 1,
    height: '12px',
    background: COLORS.lightGreenBg,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: RADIUS.pill,
    transition: 'width 0.3s ease',
  },
  thresholdLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '2px',
    background: COLORS.mutedText,
    opacity: 0.5,
  },
  value: {
    width: '44px',
    flexShrink: 0,
    textAlign: 'right',
    fontSize: '13px',
    fontWeight: 700,
    color: COLORS.darkText,
  },
};
