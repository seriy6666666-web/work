import type { ReactNode } from 'react';

/**
 * Строка-карточка для справочников: заказы, операции, навыки, материалы.
 *
 * Один вид на все списки — чтобы одинаковые по смыслу вещи выглядели одинаково,
 * и чтобы поправить их можно было в одном месте, а не в шести файлах.
 *
 * Числа отдельными ячейками справа, а не внутри подписи: их сравнивают глазами
 * по вертикали, и для этого они должны стоять в столбец. Моноширинные — иначе
 * при разной ширине цифр столбец «пляшет».
 */
export interface ListCardStat {
  label: string;
  value: ReactNode;
  /** Приглушить: значение есть, но оно вторично. */
  muted?: boolean;
}

export function ListCard({
  title,
  subtitle,
  badge,
  stats = [],
  actions,
  onClick,
  accent,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  stats?: ListCardStat[];
  actions?: ReactNode;
  /** Карточка целиком нажимается — тогда она ведёт себя как кнопка. */
  onClick?: () => void;
  /** Цвет полосы слева: состояние видно, не читая. */
  accent?: string;
}) {
  const body = (
    <>
      <div style={styles.main}>
        <div style={styles.titleRow}>
          <strong style={styles.title}>{title}</strong>
          {badge}
        </div>
        {subtitle && <div style={styles.subtitle}>{subtitle}</div>}
      </div>

      {stats.length > 0 && (
        <div style={styles.stats}>
          {stats.map((s) => (
            <div key={s.label} style={styles.stat}>
              <div style={{ ...styles.statValue, ...(s.muted ? styles.statMuted : null) }}>{s.value}</div>
              <div style={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {actions && <div style={styles.actions}>{actions}</div>}
    </>
  );

  const style: React.CSSProperties = {
    ...styles.card,
    ...(accent ? { borderLeft: `4px solid ${accent}` } : null),
    ...(onClick ? styles.clickable : null),
  };

  // Нажимаемая карточка — это кнопка, а не div с обработчиком: иначе до неё не
  // добраться с клавиатуры и её не увидит программа чтения с экрана.
  return onClick ? (
    <button type="button" style={style} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div style={style}>{body}</div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    width: '100%',
    padding: '14px 16px',
    borderRadius: '14px',
    border: '1px solid var(--line)',
    background: 'var(--surf)',
    boxShadow: 'var(--sh1)',
    textAlign: 'left',
    font: 'inherit',
    color: 'var(--tx)',
  },
  clickable: {
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  subtitle: {
    marginTop: '3px',
    fontSize: '13px',
    color: 'var(--tx2)',
  },
  stats: {
    display: 'flex',
    gap: '20px',
  },
  stat: {
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  statValue: {
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    fontVariantNumeric: 'tabular-nums',
    fontSize: '17px',
    fontWeight: 600,
  },
  statMuted: {
    color: 'var(--tx3)',
    fontWeight: 400,
  },
  statLabel: {
    fontSize: '11px',
    color: 'var(--tx3)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
};
