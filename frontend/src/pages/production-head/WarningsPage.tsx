import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Warnings } from '../../api/client';
import { ProductionHeadLayout } from './ProductionHeadLayout';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { COLORS } from '../../theme';

export function WarningsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [warnings, setWarnings] = useState<Warnings | null>(null);
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
                  <th style={styles.th}>Заказ</th>
                  <th style={styles.th}>Срок</th>
                  <th style={styles.th}>Прогресс</th>
                  <th style={styles.th}>Прошло времени</th>
                </tr>
              </thead>
              <tbody>
                {warnings.orderWarnings.map((w) => (
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
                  <th style={styles.th}>Сотрудник</th>
                  <th style={styles.th}>Участок</th>
                  <th style={styles.th}>Выработка по норме</th>
                  <th style={styles.th}>Выполнение назначенного</th>
                </tr>
              </thead>
              <tbody>
                {warnings.workerWarnings.map((w) => (
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
