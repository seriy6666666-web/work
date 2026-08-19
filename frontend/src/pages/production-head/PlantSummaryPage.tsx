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
import { useTableControls, SortHeader } from '../../components/TableControls';
import { Table, Th, Td } from '../../components/ui';

export function PlantSummaryPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [period, setPeriod] = useState<StatsPeriod>('week');
  const [summary, setSummary] = useState<PlantSummaryEntry[]>([]);

  const controls = useTableControls(summary, {
    searchText: (s) => s.siteName,
    sortAccessors: {
      site: (s) => s.siteName,
      norm: (s) => s.normRate,
      completion: (s) => s.completionRate,
      people: (s) => s.workersCount,
    },
    defaultSortKey: 'site',
    storageKey: 'head-summary',
  });
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
          {(() => {
            /**
             * На графике только выработка по норме и ничего больше.
             *
             * Раньше у участка без заданных норм столбец подставлял выполнение плана,
             * а подпись графика оставалась прежней. Выполнение плана обычно заметно
             * выше выработки по норме (92–97 % против 26–30 %), поэтому участок, у
             * которого показатель просто не посчитан, выглядел лучшим на заводе —
             * ровно наоборот тому, ради чего этот экран и нужен.
             *
             * Теперь у таких участков столбца нет, а под графиком сказано, каких норм
             * не хватает: это не «плохо работают», это «нечем измерить».
             */
            const noNorms = summary.filter((s) => s.normRate === null && s.workersCount > 0);
            return (
              <div style={{ marginBottom: '24px' }}>
                <BarChart
                  title="Выработка по норме"
                  threshold={0.85}
                  data={summary.map((s) => ({
                    label: s.siteName,
                    value: s.normRate,
                    sub: `${s.workersCount} сотр. с данными`,
                  }))}
                />
                {noNorms.length > 0 && (
                  <p style={styles.normsHint}>
                    Нет данных по норме: {noNorms.map((s) => s.siteName).join(', ')} — у операций этих
                    участков не заданы нормы выработки. Задайте их в разделе «Навыки», иначе сравнить
                    участки между собой нельзя.
                  </p>
                )}
              </div>
            );
          })()}

          <Table>
            <thead>
              <tr>
                <SortHeader label="Участок" sortKey="site" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <SortHeader label="Выработка по норме" sortKey="norm" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <SortHeader label="Выполнение плана" sortKey="completion" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <SortHeader label="Сотрудников с данными" sortKey="people" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {controls.result.map((s) => (
                <tr key={s.siteId}>
                  <Td>{s.siteName}</Td>
                  <td style={{ ...styles.td, fontWeight: 600 }}>
                    {s.normRate === null ? '—' : `${Math.round(s.normRate * 100)}%`}
                  </td>
                  <Td>
                    {s.completionRate === null ? '—' : `${Math.round(s.completionRate * 100)}%`}
                  </Td>
                  <Td>{s.workersCount}</Td>
                  <Td align="right">
                    <Link to={`/production-head/sites/${s.siteId}`} style={styles.link}>
                      Подробнее →
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </ProductionHeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  normsHint: {
    margin: '10px 2px 0',
    fontSize: '13px',
    lineHeight: 1.5,
    color: COLORS.mutedText,
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
