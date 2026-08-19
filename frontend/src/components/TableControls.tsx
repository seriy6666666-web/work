import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import { COLORS, RADIUS } from '../theme';

type SortDir = 'asc' | 'desc';
type Accessor<T> = (item: T) => string | number | null;

/**
 * Выбранный порядок хранится в браузере.
 *
 * Без этого сортировку пришлось бы переключать заново при каждом заходе на
 * страницу: человек работает с одним и тем же списком каждый день и порядок ему
 * нужен один и тот же. Ключ свой у каждого списка — иначе выбор в «Материалах»
 * подменял бы выбор в «Отсутствиях».
 */
function readStoredSort(storageKey: string | undefined): { key: string; dir: SortDir } | null {
  if (!storageKey) return null;
  try {
    const raw = localStorage.getItem(`belmy_sort_${storageKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.key === 'string' && (parsed.dir === 'asc' || parsed.dir === 'desc')) {
      return parsed;
    }
  } catch {
    // Испорченное значение — просто берём порядок по умолчанию.
  }
  return null;
}

/**
 * Сортировка списка по одному признаку.
 *
 * Пустые значения всегда уходят в конец, в обе стороны: «нет даты обслуживания»
 * — это не «самое раннее» и не «самое позднее», это отсутствие сведений, и
 * всплывать наверх оно не должно. Строки сравниваем по-русски, иначе «Ё» и
 * строчные буквы встают не на свои места.
 */
export function sortWith<T>(items: T[], accessor: Accessor<T>, dir: SortDir): T[] {
  return [...items].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === 'number' && typeof bv === 'number') {
      return dir === 'asc' ? av - bv : bv - av;
    }
    const cmp = String(av).localeCompare(String(bv), 'ru');
    return dir === 'asc' ? cmp : -cmp;
  });
}

/**
 * Только выбор порядка, без самого списка.
 *
 * Нужен там, где строки разложены по группам — оборудование по участкам,
 * материалы по площадкам. Общий список сортировать нельзя, он бы перемешал
 * группы; сортируем содержимое каждой, а выбор один на страницу.
 */
export function useSortState(options: { defaultKey: string; defaultDir?: SortDir; storageKey: string }) {
  const stored = readStoredSort(options.storageKey);
  const [sortKey, setSortKey] = useState<string>(stored?.key ?? options.defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(stored?.dir ?? options.defaultDir ?? 'asc');

  function setSort(key: string, dir: SortDir) {
    setSortKey(key);
    setSortDir(dir);
    try {
      localStorage.setItem(`belmy_sort_${options.storageKey}`, JSON.stringify({ key, dir }));
    } catch {
      // Хранилище недоступно — порядок просто не переживёт перезагрузку страницы.
    }
  }

  return { sortKey, sortDir, setSort };
}

export function useTableControls<T>(
  items: T[],
  options: {
    searchText: (item: T) => string;
    sortAccessors?: Record<string, Accessor<T>>;
    defaultSortKey?: string;
    defaultSortDir?: SortDir;
    /** Под каким именем запоминать выбор. Не задано — не запоминаем. */
    storageKey?: string;
  },
) {
  const stored = readStoredSort(options.storageKey);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(stored?.key ?? options.defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(stored?.dir ?? options.defaultSortDir ?? 'asc');

  function remember(key: string, dir: SortDir) {
    if (!options.storageKey) return;
    try {
      localStorage.setItem(`belmy_sort_${options.storageKey}`, JSON.stringify({ key, dir }));
    } catch {
      // Хранилище может быть недоступно — сортировка от этого работать не перестаёт.
    }
  }

  function toggleSort(key: string) {
    if (sortKey === key) {
      const next: SortDir = sortDir === 'asc' ? 'desc' : 'asc';
      setSortDir(next);
      remember(key, next);
    } else {
      setSortKey(key);
      setSortDir('asc');
      remember(key, 'asc');
    }
  }

  /** Для карточных списков: порядок выбирают из выпадающего списка целиком. */
  function setSort(key: string, dir: SortDir) {
    setSortKey(key);
    setSortDir(dir);
    remember(key, dir);
  }

  const result = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q ? items.filter((it) => options.searchText(it).toLowerCase().includes(q)) : [...items];

    if (sortKey && options.sortAccessors?.[sortKey]) {
      out = sortWith(out, options.sortAccessors[sortKey], sortDir);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, sortKey, sortDir]);

  return { query, setQuery, sortKey, sortDir, toggleSort, setSort, result };
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Поиск...',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={searchStyles.wrap}>
      <span style={searchStyles.icon}>
        <Icon name="search" size={16} />
      </span>
      <input
        style={searchStyles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button style={searchStyles.clear} onClick={() => onChange('')} title="Очистить">
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}

export function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: string;
  activeKey: string | null;
  dir: SortDir;
  onSort: (key: string) => void;
  align?: 'left' | 'right';
}) {
  const active = activeKey === sortKey;
  return (
    <th style={{ ...headerStyles.th, textAlign: align }}>
      <button style={headerStyles.button} onClick={() => onSort(sortKey)}>
        <span>{label}</span>
        <span style={{ opacity: active ? 1 : 0.35, display: 'inline-flex' }}>
          <Icon name="sort" size={12} />
        </span>
        {active && <span style={headerStyles.dir}>{dir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
}

/**
 * Выбор порядка для списков, где нет столбцов.
 *
 * Проекты, доска распределения, обращения — это карточки, щёлкать по заголовку
 * столбца там не по чему. Направление входит прямо в вариант («по алфавиту»,
 * «сначала новые»), а не прячется в отдельную стрелку: два переключателя на один
 * вопрос — это на один больше, чем нужно.
 */
export interface SortChoice {
  key: string;
  dir: SortDir;
  label: string;
}

export function SortSelect({
  choices,
  sortKey,
  dir,
  onSelect,
}: {
  choices: SortChoice[];
  sortKey: string | null;
  dir: SortDir;
  onSelect: (key: string, dir: SortDir) => void;
}) {
  const currentIndex = choices.findIndex((c) => c.key === sortKey && c.dir === dir);
  return (
    <label style={sortSelectStyles.wrap}>
      <span style={sortSelectStyles.caption}>Сортировка</span>
      <select
        style={sortSelectStyles.select}
        value={currentIndex >= 0 ? String(currentIndex) : ''}
        onChange={(e) => {
          const choice = choices[Number(e.target.value)];
          if (choice) onSelect(choice.key, choice.dir);
        }}
      >
        {currentIndex < 0 && <option value="">по умолчанию</option>}
        {choices.map((c, i) => (
          <option key={`${c.key}-${c.dir}`} value={String(i)}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const sortSelectStyles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: COLORS.mutedText,
  },
  caption: {
    whiteSpace: 'nowrap',
  },
  select: {
    padding: '7px 10px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    color: COLORS.darkText,
    fontSize: '13px',
    // На планшете в перчатках промахиваются мимо мелкого поля.
    minHeight: '36px',
  },
};

const searchStyles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: '240px',
  },
  icon: {
    position: 'absolute',
    left: '10px',
    color: COLORS.mutedText,
    display: 'flex',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '9px 32px 9px 32px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '14px',
  },
  clear: {
    position: 'absolute',
    right: '8px',
    border: 'none',
    background: 'transparent',
    color: COLORS.mutedText,
    cursor: 'pointer',
    display: 'flex',
    padding: '2px',
  },
};

const headerStyles: Record<string, React.CSSProperties> = {
  th: {
    padding: '10px 8px',
    borderBottom: `2px solid ${COLORS.lightGreenBg}`,
    color: COLORS.mutedText,
    fontSize: '13px',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    border: 'none',
    background: 'transparent',
    color: COLORS.mutedText,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  },
  dir: {
    color: COLORS.accentDark,
    fontWeight: 700,
  },
};
