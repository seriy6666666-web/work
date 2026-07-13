import { Icon, type IconName } from './Icon';
import { COLORS, RADIUS } from '../theme';

export function EmptyState({
  icon = 'inbox',
  title,
  hint,
  action,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={styles.wrap}>
      <div style={styles.iconCircle}>
        <Icon name={icon} size={28} />
      </div>
      <p style={styles.title}>{title}</p>
      {hint && <p style={styles.hint}>{hint}</p>}
      {action && <div style={styles.action}>{action}</div>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '48px 24px',
    color: COLORS.mutedText,
  },
  iconCircle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '64px',
    height: '64px',
    borderRadius: RADIUS.pill,
    background: COLORS.lightGreenBg,
    color: COLORS.accent,
    marginBottom: '16px',
  },
  title: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: COLORS.darkText,
  },
  hint: {
    margin: '6px 0 0',
    fontSize: '13px',
    color: COLORS.mutedText,
    maxWidth: '320px',
  },
  action: {
    marginTop: '16px',
  },
};
