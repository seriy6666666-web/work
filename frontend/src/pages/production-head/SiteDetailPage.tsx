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
import { useTableControls, SortHeader } from '../../components/TableControls';
import { Table, Td } from '../../components/ui';

/** Colour the norm-rate cell: red below 85% of norm, green when at/above norm. */
function normStyle(rate: number | null): React.CSSProperties {
  if (rate === null) return {};
  if (rate < 0.85) return { color: COLORS.error, fontWeight: 700 };
  if (rate >= 1) return { color: COLORS.accentDark, fontWeight: 700 };
  return { fontWeight: 600 };
}

export function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const { token } = useAuth();
  const toast = useToast();
  const [period, setPeriod] = useState<StatsPeriod>('week');
  const [ranking, setRanking] = useState<SiteRanking | null>(null);

  const controls = useTableControls(ranking?.entries ?? [], {
    searchText: (e) => e.fullName,
    sortAccessors: {
      user: (e) => e.fullName,
      norm: (e) => e.normRate,
      completion: (e) => e.completionRate,
      excused: (e) => e.excusedCount,
      total: (e) => e.totalCount,
    },
    defaultSortKey: 'user',
    storageKey: 'head-site-detail',
  });
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
            Выработка по норме:{' '}
            <strong>
              {ranking.siteNormRate === null ? '—' : `${Math.round(ranking.siteNormRate * 100)}%`}
            </strong>
            {' · '}Выполнение назначенного:{' '}
            {ranking.siteCompletionRate === null ? '—' : `${Math.round(ranking.siteCompletionRate * 100)}%`}
          </p>
          <Table>
            <thead>
              <tr>
                <SortHeader label="Сотрудник" sortKey="user" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <SortHeader label="Выработка по норме" sortKey="norm" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <SortHeader label="Выполнение назначенного" sortKey="completion" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <SortHeader label="Исключено (уважительная причина)" sortKey="excused" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <SortHeader label="Всего назначений" sortKey="total" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              </tr>
            </thead>
            <tbody>
              {controls.result.map((e) => (
                <tr key={e.userId}>
                  <Td>
                    <div style={styles.nameCell}>
                      <Avatar name={e.fullName} size={26} />
                      {e.fullName}
                    </div>
                  </Td>
                  <td style={{ ...styles.td, ...normStyle(e.normRate) }}>
                    {e.normRate === null ? '—' : `${Math.round(e.normRate * 100)}%`}
                  </td>
                  <Td>
                    {e.completionRate === null ? '—' : `${Math.round(e.completionRate * 100)}%`}
                  </Td>
                  <Td>{e.excusedCount}</Td>
                  <Td>{e.totalCount}</Td>
                </tr>
              ))}
              {ranking.entries.length === 0 && (
                <tr>
                  <td style={styles.td} colSpan={5}>
                    За выбранный период данных нет
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
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
