import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type AuditLogEntry, type AuditLogPage, type AuditLogFilters } from '../../api/client';
import { AdminLayout } from './AdminLayout';
import { Badge, type BadgeVariant } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { Select } from '../../components/Select';
import { COLORS } from '../../theme';
import { SortHeader } from '../../components/TableControls';
import { Table, Th, Td, Button, Input } from '../../components/ui';

const METHOD_BADGE: Record<string, BadgeVariant> = {
  POST: 'accent',
  PATCH: 'shared',
  PUT: 'shared',
  DELETE: 'danger',
};

const METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'] as const;

/** Быстрые фильтры: два вопроса, с которыми сюда заходят чаще всего. */
const QUICK: { label: string; method: string }[] = [
  { label: 'Все', method: '' },
  { label: 'Изменения', method: 'PATCH' },
  { label: 'Создание', method: 'POST' },
  { label: 'Удаления', method: 'DELETE' },
];

export function AuditLogPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<AuditLogPage | null>(null);
  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState('');
  const [method, setMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  /**
   * Порядок здесь серверный.
   *
   * Записей в журнале десятки тысяч, приходят они страницами по 50. Сортировка в
   * браузере переставила бы только видимые 50, а выглядела бы как сортировка
   * всего журнала — и по ней делали бы неверные выводы.
   */
  const [sort, setSort] = useState<AuditLogFilters['sort']>(undefined);
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  function toggleSort(key: string) {
    const field = key as NonNullable<AuditLogFilters['sort']>;
    if (sort === field) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(field);
      setDir('asc');
    }
    // Порядок сменился — прежний номер страницы указывает уже не туда.
    setPage(1);
  }

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const result = await api.getAuditLog(token, {
        userId: userId || undefined,
        method: method || undefined,
        from: from || undefined,
        to: to || undefined,
        sort,
        dir,
        page,
      });
      setData(result);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить журнал действий');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, sort, dir]);

  function applyFilters() {
    setPage(1);
    refresh();
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminLayout title="Журнал действий" breadcrumb="Администрирование">

      {/*
        Быстрые кнопки поверх подробных фильтров: в журнал заходят с одним из двух
        вопросов — «что удаляли» и «где отказы». Набирать ради этого дату и метод
        в четырёх полях никто не станет.
      */}
      <div style={styles.quickFilters}>
        {QUICK.map((q) => (
          <button
            key={q.label}
            style={{ ...styles.quick, ...(method === q.method ? styles.quickActive : null) }}
            onClick={() => {
              setMethod(q.method);
              setPage(1);
              setTimeout(applyFilters, 0);
            }}
          >
            {q.label}
          </button>
        ))}
      </div>

      <div style={styles.filters}>
        <Input style={{ borderRadius: '8px' }}
          placeholder="ID пользователя"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <Select
          width="160px"
          ariaLabel="Метод запроса"
          value={method}
          onChange={setMethod}
          // Пустой вариант — «не фильтровать», его надо уметь выбрать обратно.
          options={[
            { value: '', label: 'Все методы' },
            ...METHODS.map((m) => ({ value: m, label: m })),
          ]}
        />
        <Input style={{ borderRadius: '8px' }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input style={{ borderRadius: '8px' }} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button style={{ borderRadius: '8px' }} onClick={applyFilters}>
          Применить
        </Button>
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : data && data.entries.length === 0 ? (
        <EmptyState icon="list" title="Записей нет" hint="Под выбранные фильтры ничего не найдено." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <SortHeader label="Время" sortKey="createdAt" activeKey={sort ?? null} dir={dir} onSort={toggleSort} />
                <SortHeader label="Пользователь" sortKey="username" activeKey={sort ?? null} dir={dir} onSort={toggleSort} />
                <Th>Роль</Th>
                <SortHeader label="Метод" sortKey="method" activeKey={sort ?? null} dir={dir} onSort={toggleSort} />
                <SortHeader label="Путь" sortKey="path" activeKey={sort ?? null} dir={dir} onSort={toggleSort} />
                <SortHeader label="Код" sortKey="statusCode" activeKey={sort ?? null} dir={dir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {data?.entries.map((entry: AuditLogEntry) => (
                <tr key={entry.id}>
                  <Td>{new Date(entry.createdAt).toLocaleString('ru-RU')}</Td>
                  <Td>{entry.username ?? '—'}</Td>
                  <Td>{entry.role ?? '—'}</Td>
                  <Td>
                    <Badge variant={METHOD_BADGE[entry.method] ?? 'muted'}>{entry.method}</Badge>
                  </Td>
                  <Td>{entry.path}</Td>
                  <Td>
                    <span
                      style={{
                        ...styles.code,
                        ...(entry.statusCode >= 400 ? styles.codeBad : null),
                      }}
                    >
                      {entry.statusCode}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div style={styles.pagination}>
            <button
              style={styles.button}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Назад
            </button>
            <span style={styles.pageInfo}>
              {data
                ? `${(page - 1) * data.pageSize + 1}–${Math.min(page * data.pageSize, data.total)} из ${data.total}`
                : ''}
            </span>
            <button
              style={styles.button}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Дальше →
            </button>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  quickFilters: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  quick: {
    padding: '8px 14px',
    minHeight: '40px',
    borderRadius: '999px',
    border: '1px solid var(--line)',
    background: 'var(--surf)',
    color: 'var(--tx2)',
    fontSize: '14px',
    cursor: 'pointer',
  },
  quickActive: {
    background: 'var(--accsoft)',
    borderColor: 'var(--acc)',
    color: 'var(--accd)',
    fontWeight: 600,
  },
  /** Код ответа моноширинным: в столбце цифры не должны плясать. */
  code: {
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    fontVariantNumeric: 'tabular-nums',
    fontSize: '13px',
    color: 'var(--tx2)',
  },
  codeBad: {
    color: 'var(--err)',
    fontWeight: 600,
  },
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '24px',
    alignItems: 'center',
  },
  button: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginTop: '16px',
  },
  pageInfo: {
    color: COLORS.mutedText,
    fontSize: '14px',
  },
};
