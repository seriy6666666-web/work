import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
  api,
  ApiError,
  type PlannedShiftWeek,
  type ShiftType,
} from '../../api/client';
import { SiteLeadLayout } from './SiteLeadLayout';
import { useToast } from '../../components/ToastProvider';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { COLORS, RADIUS, SHADOW } from '../../theme';
import { useTableControls, SortHeader } from '../../components/TableControls';
import { Table } from '../../components/ui';

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mondayOf(d: Date): Date {
  const r = new Date(d);
  const dow = (r.getDay() + 6) % 7; // Mon=0 … Sun=6
  r.setDate(r.getDate() - dow);
  r.setHours(0, 0, 0, 0);
  return r;
}

function shiftWeek(weekStart: string, deltaDays: number): string {
  const d = new Date(`${weekStart}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return ymd(d);
}

const DAY_LABEL: Record<ShiftType, string> = { DAY: 'Д', NIGHT: 'Н' };
const DAY_TITLE: Record<ShiftType, string> = { DAY: 'Дневная смена', NIGHT: 'Ночная смена' };

export function ShiftPlanningPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(() => ymd(mondayOf(new Date())));
  const [week, setWeek] = useState<PlannedShiftWeek | null>(null);

  // Дни недели здесь — столбцы, их порядок задан календарём. Переставлять можно
  // только строки, то есть сотрудников.
  const controls = useTableControls(week?.workers ?? [], {
    searchText: (w) => w.fullName,
    sortAccessors: { user: (w) => w.fullName },
    defaultSortKey: 'user',
    storageKey: 'site-lead-shifts',
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setWeek(await api.getPlannedShiftsWeek(token, weekStart));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить смены');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  const byCell = useMemo(() => {
    const map = new Map<string, { id: string; type: ShiftType }>();
    for (const s of week?.shifts ?? []) {
      map.set(`${s.userId}|${s.date.slice(0, 10)}`, { id: s.id, type: s.type });
    }
    return map;
  }, [week]);

  async function cycle(userId: string, dayIso: string) {
    if (!token) return;
    const key = `${userId}|${dayIso.slice(0, 10)}`;
    const current = byCell.get(key);
    try {
      if (!current) {
        await api.setPlannedShift(token, { userId, date: dayIso, type: 'DAY' });
      } else if (current.type === 'DAY') {
        await api.setPlannedShift(token, { userId, date: dayIso, type: 'NIGHT' });
      } else {
        await api.deletePlannedShift(token, current.id);
      }
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось изменить смену');
    }
  }

  const rangeLabel = week
    ? `${new Date(week.days[0]).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })} – ${new Date(
        week.days[6],
      ).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}`
    : '';

  const nav = (
    <div style={styles.nav}>
      <button style={styles.navBtn} onClick={() => setWeekStart((w) => shiftWeek(w, -7))} title="Предыдущая неделя">
        ‹
      </button>
      <button style={styles.todayBtn} onClick={() => setWeekStart(ymd(mondayOf(new Date())))}>
        Текущая неделя
      </button>
      <button style={styles.navBtn} onClick={() => setWeekStart((w) => shiftWeek(w, 7))} title="Следующая неделя">
        ›
      </button>
    </div>
  );

  return (
    <SiteLeadLayout title="Планирование смен" breadcrumb="Участок" headerExtra={nav}>
      <p style={styles.hint}>
        Неделя: <strong>{rangeLabel}</strong>. Нажимайте на ячейку, чтобы переключать смену:
        пусто → <span style={styles.legendDay}>Д</span> дневная → <span style={styles.legendNight}>Н</span> ночная →
        пусто.
      </p>

      {loading ? (
        <Skeleton height={280} />
      ) : !week || week.workers.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="На участке нет рабочих"
          hint="Добавьте сотрудников с ролью «Рабочий» на этот участок, чтобы планировать смены."
        />
      ) : (
        <div style={styles.tableWrap}>
          <Table>
            <thead>
              <tr>
                <SortHeader label="Сотрудник" sortKey="user" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                {week.days.map((d) => (
                  <th key={d} style={styles.th}>
                    {new Date(d)
                      .toLocaleDateString('ru-RU', { weekday: 'short', timeZone: 'UTC' })
                      .replace(/^./, (c) => c.toUpperCase())}
                    <div style={styles.thDate}>
                      {new Date(d).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        timeZone: 'UTC',
                      })}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {controls.result.map((w) => (
                <tr key={w.id}>
                  <td style={{ ...styles.td, ...styles.nameCol }}>{w.fullName}</td>
                  {week.days.map((d) => {
                    const cell = byCell.get(`${w.id}|${d.slice(0, 10)}`);
                    return (
                      <td key={d} style={styles.td}>
                        <button
                          style={{
                            ...styles.cellBtn,
                            ...(cell?.type === 'DAY' ? styles.cellDay : null),
                            ...(cell?.type === 'NIGHT' ? styles.cellNight : null),
                          }}
                          onClick={() => cycle(w.id, d)}
                          title={cell ? DAY_TITLE[cell.type] : 'Не запланировано'}
                        >
                          {cell ? DAY_LABEL[cell.type] : '+'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </SiteLeadLayout>
  );
}

const cellBase: React.CSSProperties = {
  width: '38px',
  height: '38px',
  borderRadius: RADIUS.sm,
  border: `1px solid ${COLORS.lightGreenBg}`,
  background: COLORS.lightGrayBg,
  color: COLORS.mutedText,
  fontSize: '15px',
  fontWeight: 700,
  cursor: 'pointer',
};

const styles: Record<string, React.CSSProperties> = {
  hint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0 },
  legendDay: { color: COLORS.accentDark, fontWeight: 700 },
  legendNight: { color: COLORS.info, fontWeight: 700 },
  nav: { display: 'flex', alignItems: 'center', gap: '8px' },
  navBtn: {
    width: '34px',
    height: '34px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    color: COLORS.darkText,
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  todayBtn: {
    padding: '8px 14px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    color: COLORS.darkText,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tableWrap: {
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
    padding: '8px',
    overflowX: 'auto',
  },
  th: {
    padding: '8px',
    textAlign: 'center',
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.mutedText,
    borderBottom: `1px solid ${COLORS.lightGreenBg}`,
  },
  thDate: { fontSize: '11px', fontWeight: 400, color: COLORS.mutedText, marginTop: '2px' },
  nameCol: { textAlign: 'left', minWidth: '160px', whiteSpace: 'nowrap' },
  td: { padding: '6px', textAlign: 'center', fontSize: '14px', color: COLORS.darkText },
  cellBtn: cellBase,
  cellDay: { background: COLORS.accent, color: COLORS.white, borderColor: COLORS.accent },
  cellNight: { background: COLORS.info, color: COLORS.white, borderColor: COLORS.info },
};
