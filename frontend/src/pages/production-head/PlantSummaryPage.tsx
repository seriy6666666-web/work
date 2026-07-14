import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type PlantSummaryEntry, type StatsPeriod } from '../../api/client';
import { STATS_PERIODS, STATS_PERIOD_LABELS } from '../../constants/statsPeriod';
import { ProductionHeadLayout } from './ProductionHeadLayout';
import { useToast } from '../../components/ToastProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { BarChart } from '../../components/BarChart';
import { COLORS, RADIUS } from '../../theme';

export function PlantSummaryPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [period, setPeriod] = useState<StatsPeriod>('week');
  const [summary, setSummary] = useState<PlantSummaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      setSummary(await api.getPlantSummary(token, period));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить сводку');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, period]);

  return (
    <ProductionHeadLayout title="Сводка участков" breadcrumb="Начальник производства">

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
        <SkeletonTable rows={4} cols={4} />
      ) : summary.length === 0 ? (
        <EmptyState icon="building" title="Участков пока нет" hint="Данные появятся после создания участков и выполнения операций." />
      ) : (
        <>
          <div style={{ marginBottom: '24px' }}>
            <BarChart
              title={summary.some((s) => s.normRate !== null) ? 'Выработка по норме' : 'Выполнение плана по участкам'}
              threshold={summary.some((s) => s.normRate !== null) ? 0.85 : 0.7}
              data={summary.map((s) => ({
                label: s.siteName,
                value: s.normRate ?? s.completionRate,
                sub: `${s.workersCount} сотр. с данными`,
              }))}
            />
          </div>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Участок</th>
                <th style={styles.th}>Выработка по норме</th>
                <th style={styles.th}>Выполнение плана</th>
                <th style={styles.th}>Сотрудников с данными</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.siteId}>
                  <td style={styles.td}>{s.siteName}</td>
                  <td style={{ ...styles.td, fontWeight: 600 }}>
                    {s.normRate === null ? '—' : `${Math.round(s.normRate * 100)}%`}
                  </td>
                  <td style={styles.td}>
                    {s.completionRate === null ? '—' : `${Math.round(s.completionRate * 100)}%`}
                  </td>
                  <td style={styles.td}>{s.workersCount}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <Link to={`/production-head/sites/${s.siteId}`} style={styles.link}>
                      Подробнее →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </ProductionHeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
  link: {
    color: COLORS.accentDark,
    fontSize: '14px',
    fontWeight: 600,
    textDecoration: 'none',
  },
};
