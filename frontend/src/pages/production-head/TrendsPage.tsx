import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type StatsTrends, type TrendPoint } from '../../api/client';
import { ProductionHeadLayout } from './ProductionHeadLayout';
import { StatCard } from '../../components/StatCard';
import { useToast } from '../../components/ToastProvider';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { COLORS, RADIUS, SHADOW } from '../../theme';

const DAY_OPTIONS = [7, 14, 30];

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

/** Vertical bar chart for a chronological series. */
function TrendBars({
  points,
  valueOf,
  colorOf,
  labelOf,
  title,
}: {
  points: TrendPoint[];
  valueOf: (p: TrendPoint) => number | null;
  colorOf: (p: TrendPoint) => string;
  labelOf: (p: TrendPoint) => string;
  title: string;
}) {
  const values = points.map(valueOf).filter((v): v is number => v !== null);
  const max = Math.max(...values, 1);

  return (
    <div style={styles.chartCard}>
      <p style={styles.chartTitle}>{title}</p>
      <div style={styles.bars}>
        {points.map((p) => {
          const v = valueOf(p);
          const heightPct = v === null || max === 0 ? 0 : Math.round((v / max) * 100);
          return (
            <div key={p.date} style={styles.barCol} title={`${shortDate(p.date)}: ${labelOf(p)}`}>
              <div style={styles.barValue}>{v === null ? '' : labelOf(p)}</div>
              <div style={styles.barTrack}>
                <div
                  style={{
                    ...styles.barFill,
                    height: `${heightPct}%`,
                    background: colorOf(p),
                  }}
                />
              </div>
              <div style={styles.barLabel}>{shortDate(p.date)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TrendsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [days, setDays] = useState(14);
  const [data, setData] = useState<StatsTrends | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .getStatsTrends(token, days)
      .then(setData)
      .catch((err) =>
        toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить тренды'),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, days]);

  const hasData = data && data.totalProducedGood + data.totalDefects > 0;

  return (
    <ProductionHeadLayout title="Тренды производства" breadcrumb="Начальник производства">
      <div style={styles.periodSwitch}>
        {DAY_OPTIONS.map((d) => (
          <button
            key={d}
            style={{ ...styles.periodButton, ...(days === d ? styles.periodButtonActive : {}) }}
            onClick={() => setDays(d)}
          >
            {d} дней
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton height={320} />
      ) : !data ? (
        <EmptyState icon="bar-chart" title="Нет данных" />
      ) : (
        <>
          <div style={styles.summary}>
            <StatCard
              label="Выпуск годного"
              value={data.totalProducedGood.toLocaleString('ru-RU')}
              hint={`за ${data.days} дней`}
            />
            <StatCard
              label="Брак"
              value={data.totalDefects.toLocaleString('ru-RU')}
              hint={`за ${data.days} дней`}
              alert={data.totalDefects > 0}
            />
            <StatCard
              label="Средний % брака"
              value={data.overallDefectRate === null ? '—' : `${(data.overallDefectRate * 100).toFixed(1)}%`}
              hint={`за ${data.days} дней`}
              alert={(data.overallDefectRate ?? 0) > 0.1}
            />
          </div>

          {!hasData ? (
            <EmptyState
              icon="bar-chart"
              title="За период нет отметок о выполнении"
              hint="Данные появятся, когда рабочие начнут отмечать выполнение операций."
            />
          ) : (
            <>
              <TrendBars
                title="Выпуск годной продукции по дням, шт"
                points={data.points}
                valueOf={(p) => p.producedGood}
                colorOf={() => COLORS.accent}
                labelOf={(p) => String(p.producedGood)}
              />
              <TrendBars
                title="Доля брака по дням, %"
                points={data.points}
                valueOf={(p) => p.defectRate}
                colorOf={(p) => ((p.defectRate ?? 0) > 0.1 ? COLORS.error : COLORS.warning)}
                labelOf={(p) => (p.defectRate === null ? '' : `${Math.round(p.defectRate * 100)}%`)}
              />
            </>
          )}
        </>
      )}
    </ProductionHeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  periodSwitch: { display: 'flex', gap: '8px', marginBottom: '20px' },
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
  summary: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' },
  chartCard: {
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
    padding: '18px 20px',
    marginBottom: '20px',
  },
  chartTitle: { margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: COLORS.darkText },
  bars: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '6px',
    height: '180px',
    overflowX: 'auto',
    paddingBottom: '4px',
  },
  barCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: '1 0 32px',
    minWidth: '32px',
    height: '100%',
  },
  barValue: { fontSize: '11px', color: COLORS.mutedText, marginBottom: '4px', height: '14px', whiteSpace: 'nowrap' },
  barTrack: { flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  barFill: { width: '70%', minHeight: '2px', borderRadius: `${RADIUS.sm} ${RADIUS.sm} 0 0`, transition: 'height 0.2s' },
  barLabel: { fontSize: '10px', color: COLORS.mutedText, marginTop: '6px', whiteSpace: 'nowrap' },
};
