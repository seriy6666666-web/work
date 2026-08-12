import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { COLORS, RADIUS, SHADOW } from '../theme';

export interface SelectOption {
  value: string;
  label: string;
  /** Приглушённая подпись справа: «нет навыка», «занят», количество. */
  hint?: string;
  disabled?: boolean;
}

/** Высота строки под палец: на терминале в цеху работают в перчатках. */
const ROW_HEIGHT = 40;

/** Как у полей ввода в формах — там по приложению принят именно этот размер. */
const FONT_SIZE = '15px';

/**
 * Замена нативного `<select>`: Windows рисует его своим синим, и на фоне остальных
 * полей он выглядит чужим. Здесь та же рамка, фон и скругление, что у input,
 * шеврон вместо системной стрелки и выбранное помечено галочкой СПРАВА — галочка
 * слева читается как чекбокс, то есть как множественный выбор.
 *
 * Роли combobox/listbox/option выставлены не для галочки: по ним же работают
 * автотесты (getByRole), потому что playwright-овский selectOption понимает
 * только нативный select.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = 'Выберите',
  disabled,
  width = '100%',
  ariaLabel,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  width?: string;
  ariaLabel?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);
  const firstEnabled = useMemo(() => options.findIndex((o) => !o.disabled), [options]);

  // Клик мимо и потеря фокуса закрывают список.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // При открытии подсвечиваем выбранное, иначе первое доступное.
  useEffect(() => {
    if (!open) return;
    const current = options.findIndex((o) => o.value === value && !o.disabled);
    setActive(current >= 0 ? current : firstEnabled);
  }, [open, options, value, firstEnabled]);

  // Держим подсвеченную строку в зоне видимости при навигации стрелками.
  useEffect(() => {
    if (!open || active < 0) return;
    menuRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  /** Следующая доступная строка по кругу; недоступные проскакиваем. */
  function step(from: number, delta: number): number {
    const n = options.length;
    if (n === 0) return -1;
    for (let i = 1; i <= n; i++) {
      const next = (((from + delta * i) % n) + n) % n;
      if (!options[next].disabled) return next;
    }
    return from;
  }

  function pick(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => step(i < 0 ? -1 : i, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => step(i < 0 ? 0 : i, -1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(firstEnabled);
        break;
      case 'End':
        e.preventDefault();
        setActive(step(0, -1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        pick(active);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  const label = selected?.label ?? placeholder;

  return (
    <div style={{ ...styles.wrap, width }} ref={wrapRef}>
      <button
        type="button"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        style={{
          ...styles.trigger,
          ...(disabled ? styles.triggerDisabled : {}),
          ...(open ? styles.triggerOpen : {}),
        }}
        onClick={(e) => {
          // `<button>` — labelable-элемент, поэтому обёртка `<label>` пересылает ему
          // активацию вторым кликом: список открывался и тут же закрывался. Отменяем
          // действие по умолчанию — иначе компонент не работает в любой форме, где
          // поле подписано через label, а так свёрстано большинство экранов.
          e.preventDefault();
          setOpen((v) => !v);
        }}
        onKeyDown={onKeyDown}
      >
        <span style={selected ? styles.value : styles.placeholder}>{label}</span>
        <Chevron open={open} />
      </button>

      {open && !disabled && (
        <div
          ref={menuRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          style={styles.menu}
          onKeyDown={onKeyDown}
        >
          {options.length === 0 ? (
            <div style={styles.empty}>Нет вариантов</div>
          ) : (
            options.map((o, i) => {
              const isSelected = o.value === value;
              return (
                <div
                  key={o.value}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={o.disabled || undefined}
                  style={{
                    ...styles.option,
                    ...(i === active && !o.disabled ? styles.optionActive : {}),
                    ...(o.disabled ? styles.optionDisabled : {}),
                  }}
                  onMouseEnter={() => !o.disabled && setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    // Тот же случай, что и на кнопке: клик по строке всплывает до
                    // обёртки `<label>`, та пересылает активацию кнопке — и список,
                    // только что закрытый выбором, открывается снова.
                    e.preventDefault();
                    pick(i);
                  }}
                >
                  <span style={styles.optionLabel}>{o.label}</span>
                  {o.hint && <span style={styles.hint}>{o.hint}</span>}
                  {/* Галочка справа: слева она читалась бы как чекбокс. */}
                  <span style={styles.check} aria-hidden="true">
                    {isSelected ? <Check /> : null}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        flexShrink: 0,
        color: COLORS.mutedText,
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform 120ms ease',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ color: COLORS.accent }}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { position: 'relative' },
  trigger: {
    // Совпадает с input в SearchSelect — поля выбора и ввода должны выглядеть одинаково.
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    width: '100%',
    minHeight: `${ROW_HEIGHT}px`,
    padding: '9px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: FONT_SIZE,
    fontFamily: 'inherit',
    color: COLORS.darkText,
    textAlign: 'left',
    cursor: 'pointer',
  },
  triggerOpen: { borderColor: COLORS.accent },
  triggerDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  value: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  placeholder: {
    color: COLORS.mutedText,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  menu: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    marginTop: '4px',
    minWidth: 'max-content',
    maxHeight: `${ROW_HEIGHT * 7}px`,
    overflowY: 'auto',
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.sm,
    boxShadow: SHADOW.card,
    padding: '4px',
    zIndex: 30,
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: `${ROW_HEIGHT}px`,
    padding: '8px 10px',
    fontSize: FONT_SIZE,
    color: COLORS.darkText,
    cursor: 'pointer',
    borderRadius: RADIUS.sm,
    userSelect: 'none',
  },
  optionActive: { background: COLORS.lightGreenBg },
  optionDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  optionLabel: { flex: 1, whiteSpace: 'nowrap' },
  hint: { color: COLORS.mutedText, fontSize: '13px', whiteSpace: 'nowrap' },
  check: {
    width: '15px',
    display: 'flex',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  empty: { padding: '10px 12px', fontSize: FONT_SIZE, color: COLORS.mutedText },
};
