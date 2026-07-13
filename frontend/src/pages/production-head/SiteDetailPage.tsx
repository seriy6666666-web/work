import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type SiteRanking, type StatsPeriod } from '../../api/client';
import { STATS_PERIODS, STATS_PERIOD_LABELS } from '../../constants/statsPeriod';
import { ProductionHeadLayout } from './ProductionHeadLayout';
import { Avatar } from '../../components/Avatar';
import { useToast } from '../../components/ToastProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { COLORS, RADIUS } from '../../theme';

export function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const { token } = useAuth();
  const toast = useToast();
  const [period, setPeriod] = useState<StatsPeriod>('week');
  const [ranking, setRanking] = useState<SiteRanking | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!token || !siteId) return;
    setLoading(true);
    try {
      setRanking(await api.getSiteDetail(token, siteId, period));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить участок');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, siteId, period]);

  return (
    <ProductionHeadLayout
      title={ranking ? ranking.siteName : 'Участок'}
      breadcrumb="Начальник производства · Сводка участков"
    >
      <Link to="/production-head/summary" style={styles.backLink}>
        ← Все участки
      </Link>

      <div style={styles.periodSwitch}>
        {STATS_PERIODS.map((p) => (
          <button
            key={p}
            style={{ ...styles.periodButton, ...(period === p ? styles.periodButtonActive : {}) }}
            onClick={() => setPeriod(p)}
          >
            {STATS_PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : ranking ? (
        <>
          <p style={styles.muted}>
            Выполнение по участку:{' '}
            {ranking.siteCompletionRate === null ? '—' : `${Math.round(ranking.siteCompletionRate * 100)}%`}
          </p>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Сотрудник</th>
                <th style={styles.th}>Выполнение</th>
                <th style={styles.th}>Исключено (уважительная причина)</th>
                <th style={styles.th}>Всего назначений</th>
              </tr>
            </thead>
            <tbody>
              {ranking.entries.map((e) => (
                <tr key={e.userId}>
                  <td style={styles.td}>
                    <div style={styles.nameCell}>
                      <Avatar name={e.fullName} size={26} />
                      {e.fullName}
                    </div>
                  </td>
                  <td style={styles.td}>
                    {e.completionRate === null ? '—' : `${Math.round(e.completionRate * 100)}%`}
                  </td>
                  <td style={styles.td}>{e.excusedCount}</td>
                  <td style={styles.td}>{e.totalCount}</td>
                </tr>
              ))}
              {ranking.entries.length === 0 && (
                <tr>
                  <td style={styles.td} colSpan={4}>
                    За выбранный период данных нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      ) : null}
    </ProductionHeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backLink: {
    color: COLORS.accentDark,
    fontSize: '14px',
    textDecoration: 'none',
  },
  periodSwitch: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
  },
  periodButton: {
    padding: '8px 16px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    color: COLORS.darkText,
    fontSize: '14px',
    cursor: 'pointer',
  },
  periodButtonActive: {
    background: COLORS.accent,
    borderColor: COLORS.accent,
    color: COLORS.white,
    fontWeight: 600,
  },
  muted: {
    color: COLORS.mutedText,
    fontSize: '14px',
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
};
