import { useEffect, useRef, useState } from 'react';
import { COLORS, RADIUS, SHADOW } from '../theme';

export interface RowAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

/**
 * Действия строки таблицы: первое видно сразу, остальные под «…».
 * Четыре равнозначные ссылки в каждой из шестидесяти строк — это шум, в котором
 * «Удалить» стоит вплотную к «Редактировать».
 */
export function RowActions({ primary, actions }: { primary?: RowAction; actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div style={styles.wrap} ref={ref}>
      {primary && (
        <button style={styles.primary} onClick={primary.onClick}>
          {primary.label}
        </button>
      )}
      {actions.length > 0 && (
        <button
          style={styles.more}
          onClick={() => setOpen((v) => !v)}
          aria-label="Ещё действия"
          aria-expanded={open}
        >
          •••
        </button>
      )}
      {open && (
        <div style={styles.menu}>
          {actions.map((a) => (
            <button
              key={a.label}
              style={a.danger ? styles.itemDanger : styles.item}
              onClick={() => {
                setOpen(false);
                a.onClick();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px' },
  primary: {
    border: 'none',
    background: 'none',
    color: COLORS.accentDark,
    cursor: 'pointer',
    fontSize: '13px',
    padding: '4px 6px',
  },
  more: {
    border: 'none',
    background: 'none',
    color: COLORS.mutedText,
    cursor: 'pointer',
    fontSize: '13px',
    letterSpacing: '1px',
    padding: '4px 6px',
    lineHeight: 1,
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: '4px',
    minWidth: '170px',
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.sm,
    boxShadow: SHADOW.card,
    padding: '4px',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 30,
  },
  item: {
    border: 'none',
    background: 'none',
    textAlign: 'left',
    padding: '9px 12px',
    fontSize: '14px',
    color: COLORS.darkText,
    cursor: 'pointer',
    borderRadius: RADIUS.sm,
  },
  itemDanger: {
    border: 'none',
    background: 'none',
    textAlign: 'left',
    padding: '9px 12px',
    fontSize: '14px',
    color: COLORS.error,
    cursor: 'pointer',
    borderRadius: RADIUS.sm,
  },
};
