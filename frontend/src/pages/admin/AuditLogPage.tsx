import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type AuditLogEntry, type AuditLogPage } from '../../api/client';
import { AdminLayout } from './AdminLayout';
import { Badge, type BadgeVariant } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { Select } from '../../components/Select';
import { COLORS } from '../../theme';

const METHOD_BADGE: Record<string, BadgeVariant> = {
  POST: 'accent',
  PATCH: 'shared',
  PUT: 'shared',
  DELETE: 'danger',
};

const METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'] as const;

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

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const result = await api.getAuditLog(token, {
        userId: userId || undefined,
        method: method || undefined,
        from: from || undefined,
        to: to || undefined,
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
  }, [token, page]);

  function applyFilters() {
    setPage(1);
    refresh();
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminLayout title="Журнал действий" breadcrumb="Администрирование">

      <div style={styles.filters}>
        <input
          style={styles.input}
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
        <input style={styles.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input style={styles.input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button style={styles.button} onClick={applyFilters}>
          Применить
        </button>
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : data && data.entries.length === 0 ? (
        <EmptyState icon="list" title="Записей нет" hint="Под выбранные фильтры ничего не найдено." />
      ) : (
        <>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Время</th>
                <th style={styles.th}>Пользователь</th>
                <th style={styles.th}>Роль</th>
                <th style={styles.th}>Метод</th>
                <th style={styles.th}>Путь</th>
                <th style={styles.th}>Код</th>
              </tr>
            </thead>
            <tbody>
              {data?.entries.map((entry: AuditLogEntry) => (
                <tr key={entry.id}>
                  <td style={styles.td}>{new Date(entry.createdAt).toLocaleString('ru-RU')}</td>
                  <td style={styles.td}>{entry.username ?? '—'}</td>
                  <td style={styles.td}>{entry.role ?? '—'}</td>
                  <td style={styles.td}>
                    <Badge variant={METHOD_BADGE[entry.method] ?? 'muted'}>{entry.method}</Badge>
                  </td>
                  <td style={styles.td}>{entry.path}</td>
                  <td style={styles.td}>{entry.statusCode}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={styles.pagination}>
            <button
              style={styles.button}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Назад
            </button>
            <span style={styles.pageInfo}>
              Стр. {page} из {totalPages}
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
  heading: {
    marginTop: 0,
  },
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '24px',
    alignItems: 'center',
  },
  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '15px',
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
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    borderBottom: `2px solid ${COLORS.lightGreenBg}`,
    color: COLORS.mutedText,
    fontSize: '13px',
  },
  td: {
    padding: '10px 8px',
    borderBottom: `1px solid ${COLORS.lightGreenBg}`,
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
