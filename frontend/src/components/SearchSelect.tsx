import { useEffect, useMemo, useRef, useState } from 'react';
import { COLORS, RADIUS, SHADOW } from '../theme';

export interface SearchOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Выбор из длинного списка по первым буквам. Обычный select на шестьдесят фамилий
 * заставляет человека листать колесом — самое раздражающее место в интерфейсе.
 * Для коротких списков (роль, тип смены) остаётся нативный select: на планшете он быстрее.
 */
export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Начните вводить',
  disabled,
  width = '260px',
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchOption[];
  placeholder?: string;
  disabled?: boolean;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 50);
  }, [options, query]);

  return (
    <div style={{ ...styles.wrap, width }} ref={ref}>
      <input
        style={{ ...styles.input, ...(disabled ? styles.disabled : {}) }}
        value={open ? query : (selected?.label ?? '')}
        placeholder={selected ? selected.label : placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {open && !disabled && (
        <div style={styles.menu}>
          {filtered.length === 0 ? (
            <div style={styles.empty}>Никого не нашли</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                style={o.value === value ? styles.optionActive : styles.option}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQuery('');
                }}
              >
                {o.label}
                {o.hint && <span style={styles.hint}>{o.hint}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { position: 'relative' },
  input: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '14px',
    fontFamily: 'inherit',
  },
  disabled: { opacity: 0.6, cursor: 'not-allowed' },
  menu: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    marginTop: '4px',
    maxHeight: '260px',
    overflowY: 'auto',
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.sm,
    boxShadow: SHADOW.card,
    padding: '4px',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 30,
  },
  option: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    border: 'none',
    background: 'none',
    textAlign: 'left',
    padding: '9px 12px',
    fontSize: '14px',
    color: COLORS.darkText,
    cursor: 'pointer',
    borderRadius: RADIUS.sm,
  },
  optionActive: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    border: 'none',
    background: COLORS.lightGreenBg,
    textAlign: 'left',
    padding: '9px 12px',
    fontSize: '14px',
    color: COLORS.darkText,
    cursor: 'pointer',
    borderRadius: RADIUS.sm,
  },
  hint: { color: COLORS.mutedText, fontSize: '13px' },
  empty: { padding: '10px 12px', fontSize: '14px', color: COLORS.mutedText },
};
