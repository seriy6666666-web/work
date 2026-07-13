import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import { COLORS, RADIUS } from '../theme';

type SortDir = 'asc' | 'desc';
type Accessor<T> = (item: T) => string | number | null;

export function useTableControls<T>(
  items: T[],
  options: {
    searchText: (item: T) => string;
    sortAccessors?: Record<string, Accessor<T>>;
    defaultSortKey?: string;
    defaultSortDir?: SortDir;
  },
) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(options.defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(options.defaultSortDir ?? 'asc');

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const result = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q ? items.filter((it) => options.searchText(it).toLowerCase().includes(q)) : [...items];

    if (sortKey && options.sortAccessors?.[sortKey]) {
      const accessor = options.sortAccessors[sortKey];
      out.sort((a, b) => {
        const av = accessor(a);
        const bv = accessor(b);
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        const cmp = String(av).localeCompare(String(bv), 'ru');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, sortKey, sortDir]);

  return { query, setQuery, sortKey, sortDir, toggleSort, result };
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
