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
import { useTableControls, SortHeader } from '../../components/TableControls';

/** Colour the norm-rate cell: red below 85% of norm, green when at/above norm. */
function normStyle(rate: number | null): React.CSSProperties {
  if (rate === null) return {};
  if (rate < 0.85) return { color: COLORS.error, fontWeight: 700 };
  if (rate >= 1) return { color: COLORS.accentDark, fontWeight: 700 };
  return { fontWeight: 600 };
}

export function StatsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [period, setPeriod] = useState<StatsPeriod>('shift');
  const [ranking, setRanking] = useState<SiteRanking | null>(null);

  // Сортируем строки рейтинга, а не весь ответ: в нём кроме них лежат сводные числа.
  const controls = useTableControls(ranking?.entries ?? [], {
    searchText: (e) => e.fullName,
    sortAccessors: {
      user: (e) => e.fullName,
      norm: (e) => e.normRate,
      completion: (e) => e.completionRate,
      defects: (e) => e.defectRate,
      excused: (e) => e.excusedCount,
      total: (e) => e.totalCount,
    },
    defaultSortKey: 'user',
    storageKey: 'site-lead-stats',
  });
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
            Выработка по норме «{ranking.siteName}»:{' '}
            <strong>
              {ranking.siteNormRate === null ? '—' : `${Math.round(ranking.siteNormRate * 100)}%`}
            </strong>
            {' · '}Выполнение назначенного:{' '}
            {ranking.siteCompletionRate === null ? '—' : `${Math.round(ranking.siteCompletionRate * 100)}%`}
            {' · '}Брак:{' '}
            <span style={ranking.siteDefectRate && ranking.siteDefectRate > 0 ? styles.defectValue : undefined}>
              {ranking.siteDefectRate === null ? '—' : `${Math.round(ranking.siteDefectRate * 100)}%`}
            </span>
          </p>

          {ranking.entries.some((e) => e.normRate !== null) ? (
            <div style={{ margin: '16px 0 24px' }}>
              <BarChart
                title="Выработка по норме, %"
                threshold={0.85}
                data={ranking.entries.map((e) => ({
                  label: e.fullName,
                  value: e.normRate,
                  sub: `${e.totalCount} назнач.${e.excusedCount ? ` · ${e.excusedCount} искл.` : ''}`,
                }))}
              />
            </div>
          ) : ranking.entries.some((e) => e.completionRate !== null) ? (
            <div style={{ margin: '16px 0 24px' }}>
              <BarChart
                title="Выполнение назначенного, %"
                threshold={0.7}
                data={ranking.entries.map((e) => ({
                  label: e.fullName,
                  value: e.completionRate,
                  sub: `${e.totalCount} назнач.${e.excusedCount ? ` · ${e.excusedCount} искл.` : ''}`,
                }))}
              />
            </div>
          ) : null}

          <table style={styles.table}>
            <thead>
              <tr>
                <SortHeader label="Сотрудник" sortKey="user" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <SortHeader label="Выработка по норме" sortKey="norm" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <SortHeader label="Выполнение назначенного" sortKey="completion" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <SortHeader label="Брак" sortKey="defects" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <SortHeader label="Исключено (уважительная причина)" sortKey="excused" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <SortHeader label="Всего назначений" sortKey="total" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <th style={styles.th}>Причины невыполнения</th>
              </tr>
            </thead>
            <tbody>
              {controls.result.map((e) => (
                <tr key={e.userId}>
                  <td style={styles.td}>
                    <div style={styles.nameCell}>
                      <Avatar name={e.fullName} size={26} />
                      {e.fullName}
                    </div>
                  </td>
                  <td style={{ ...styles.td, ...normStyle(e.normRate) }}>
                    {e.normRate === null ? '—' : `${Math.round(e.normRate * 100)}%`}
                  </td>
                  <td style={styles.td}>
                    {e.completionRate === null ? '—' : `${Math.round(e.completionRate * 100)}%`}
                  </td>
                  <td style={{ ...styles.td, ...(e.defectRate && e.defectRate > 0 ? styles.defectValue : {}) }}>
                    {e.defectRate === null ? '—' : `${Math.round(e.defectRate * 100)}% (${e.defectCount})`}
                  </td>
                  <td style={styles.td}>{e.excusedCount}</td>
                  <td style={styles.td}>{e.totalCount}</td>
                  <td style={styles.td}>
                    {e.reasons.length === 0 ? (
                      <span style={styles.muted}>—</span>
                    ) : (
                      <ul style={styles.reasons}>
                        {e.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
              {ranking.entries.length === 0 && (
                <tr>
                  <td style={styles.td} colSpan={7}>
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
  defectValue: {
    color: COLORS.error,
    fontWeight: 700,
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
  reasons: { margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '2px' },
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
};
