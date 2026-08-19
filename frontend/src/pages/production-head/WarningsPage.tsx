import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Warnings } from '../../api/client';
import { ProductionHeadLayout } from './ProductionHeadLayout';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { COLORS } from '../../theme';
import { useTableControls, SortHeader } from '../../components/TableControls';

export function WarningsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [warnings, setWarnings] = useState<Warnings | null>(null);

  // Заказы и сотрудники — разные таблицы, порядок в них выбирают порознь.
  const orderControls = useTableControls(warnings?.orderWarnings ?? [], {
    searchText: (w) => w.orderName,
    sortAccessors: {
      order: (w) => w.orderName,
      due: (w) => w.dueDate,
      progress: (w) => w.progressRatio,
      time: (w) => w.timeRatio,
    },
    defaultSortKey: 'due',
    storageKey: 'head-warnings-orders',
  });
  const workerControls = useTableControls(warnings?.workerWarnings ?? [], {
    searchText: (w) => `${w.fullName} ${w.siteName}`,
    sortAccessors: {
      user: (w) => w.fullName,
      site: (w) => w.siteName,
      norm: (w) => w.normRate,
      completion: (w) => w.completionRate,
    },
    defaultSortKey: 'norm',
    storageKey: 'head-warnings-workers',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .getWarnings(token)
      .then(setWarnings)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить предупреждения'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <ProductionHeadLayout title="Предупреждения" breadcrumb="Начальник производства">

      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : (
        <>
          <h3 style={styles.subheading}>Заказы в зоне риска</h3>
          {warnings && warnings.orderWarnings.length > 0 ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  <SortHeader label="Заказ" sortKey="order" activeKey={orderControls.sortKey} dir={orderControls.sortDir} onSort={orderControls.toggleSort} />
                  <SortHeader label="Срок" sortKey="due" activeKey={orderControls.sortKey} dir={orderControls.sortDir} onSort={orderControls.toggleSort} />
                  <SortHeader label="Прогресс" sortKey="progress" activeKey={orderControls.sortKey} dir={orderControls.sortDir} onSort={orderControls.toggleSort} />
                  <SortHeader label="Прошло времени" sortKey="time" activeKey={orderControls.sortKey} dir={orderControls.sortDir} onSort={orderControls.toggleSort} />
                </tr>
              </thead>
              <tbody>
                {orderControls.result.map((w) => (
                  <tr key={w.orderId}>
                    <td style={styles.td}>
                      {w.orderName} <Badge variant="danger">риск</Badge>
                    </td>
                    <td style={styles.td}>{new Date(w.dueDate).toLocaleDateString('ru-RU')}</td>
                    <td style={styles.td}>{Math.round(w.progressRatio * 100)}%</td>
                    <td style={styles.td}>{Math.round(w.timeRatio * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={styles.muted}>Отстающих заказов нет.</p>
          )}

          <h3 style={styles.subheading}>Отстающие сотрудники (за неделю)</h3>
          {warnings && warnings.workerWarnings.length > 0 ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  <SortHeader label="Сотрудник" sortKey="user" activeKey={workerControls.sortKey} dir={workerControls.sortDir} onSort={workerControls.toggleSort} />
                  <SortHeader label="Участок" sortKey="site" activeKey={workerControls.sortKey} dir={workerControls.sortDir} onSort={workerControls.toggleSort} />
                  <SortHeader label="Выработка по норме" sortKey="norm" activeKey={workerControls.sortKey} dir={workerControls.sortDir} onSort={workerControls.toggleSort} />
                  <SortHeader label="Выполнение назначенного" sortKey="completion" activeKey={workerControls.sortKey} dir={workerControls.sortDir} onSort={workerControls.toggleSort} />
                </tr>
              </thead>
              <tbody>
                {workerControls.result.map((w) => (
                  <tr key={w.userId}>
                    <td style={styles.td}>
                      <div style={styles.nameCell}>
                        <Avatar name={w.fullName} size={26} />
                        {w.fullName}
                      </div>
                    </td>
                    <td style={styles.td}>{w.siteName}</td>
                    <td style={{ ...styles.td, color: COLORS.error, fontWeight: 700 }}>
                      {w.normRate === null ? '—' : `${Math.round(w.normRate * 100)}%`}
                    </td>
                    <td style={styles.td}>
                      {w.completionRate === null ? '—' : `${Math.round(w.completionRate * 100)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={styles.muted}>Отстающих сотрудников нет.</p>
          )}
        </>
      )}
    </ProductionHeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  subheading: {
    marginTop: '24px',
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
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  muted: {
    color: COLORS.mutedText,
    fontSize: '14px',
  },
};
