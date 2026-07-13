import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type SiteRanking, type StatsPeriod } from '../../api/client';
import { STATS_PERIODS, STATS_PERIOD_LABELS } from '../../constants/statsPeriod';
import { SiteLeadLayout } from './SiteLeadLayout';
import { Avatar } from '../../components/Avatar';
import { BarChart } from '../../components/BarChart';
import { useToast } from '../../components/ToastProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { Icon } from '../../components/Icon';
import { COLORS, RADIUS } from '../../theme';

export function StatsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [period, setPeriod] = useState<StatsPeriod>('shift');
  const [ranking, setRanking] = useState<SiteRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      setRanking(await api.getSiteRanking(token, period));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить статистику');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, period]);

  async function handleExport() {
    if (!token) return;
    setExporting(true);
    try {
      const blob = await api.exportSiteRanking(token, period);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rating.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Отчёт загружен');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось скачать отчёт');
    } finally {
      setExporting(false);
    }
  }

  return (
    <SiteLeadLayout title="Статистика" breadcrumb="Начальник участка">

      <div style={styles.toolbar}>
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
        <button style={styles.button} onClick={handleExport} disabled={exporting}>
          <Icon name="download" size={16} />
          Скачать CSV
        </button>
      </div>

      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : ranking ? (
        <>
          <p style={styles.muted}>
            Выполнение по участку «{ranking.siteName}»:{' '}
            {ranking.siteCompletionRate === null ? '—' : `${Math.round(ranking.siteCompletionRate * 100)}%`}
          </p>

          {ranking.entries.some((e) => e.completionRate !== null) && (
            <div style={{ margin: '16px 0 24px' }}>
              <BarChart
                title="Выполнение по сотрудникам"
                threshold={0.7}
                data={ranking.entries.map((e) => ({
                  label: e.fullName,
                  value: e.completionRate,
                  sub: `${e.totalCount} назнач.${e.excusedCount ? ` · ${e.excusedCount} искл.` : ''}`,
                }))}
              />
            </div>
          )}

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
    </SiteLeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '20px',
  },
  periodSwitch: {
    display: 'flex',
    gap: '8px',
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
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
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
