import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type GoalsView } from '../../api/client';
import { SiteLeadLayout } from './SiteLeadLayout';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { SearchSelect } from '../../components/SearchSelect';
import { COLORS, RADIUS, SHADOW } from '../../theme';
import { useTableControls, SortHeader } from '../../components/TableControls';
import { Table, Th, Td, Button, Input } from '../../components/ui';

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Цвет процента выполнения цели. */
function rateStyle(rate: number | null): React.CSSProperties {
  if (rate === null) return {};
  if (rate >= 1) return { color: COLORS.accentDark, fontWeight: 700 };
  if (rate < 0.85) return { color: COLORS.error, fontWeight: 700 };
  return { fontWeight: 600 };
}

export function GoalsPage() {
  const { token } = useAuth();
  const toast = useToast();

  const [date, setDate] = useState(() => ymd(new Date()));
  const [data, setData] = useState<GoalsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ userId: '', target: '' });
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setData(await api.listGoals(token, date, date));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить цели');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, date]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSet(e: FormEvent) {
    e.preventDefault();
    if (!token || !form.userId || !form.target) return;
    try {
      await api.setGoal(token, {
        userId: form.userId,
        date,
        targetQuantity: Number(form.target),
      });
      setForm({ userId: '', target: '' });
      toast.success('Цель задана');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось задать цель');
    }
  }

  async function saveReason(userId: string, target: number, reason: string) {
    if (!token) return;
    try {
      await api.setGoal(token, { userId, date, targetQuantity: target, missReason: reason || null });
      toast.success('Причина сохранена');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось сохранить причину');
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    try {
      await api.deleteGoal(token, id);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить цель');
    }
  }

  const goals = data?.goals ?? [];

  const controls = useTableControls(goals, {
    searchText: (g) => g.fullName,
    sortAccessors: {
      user: (g) => g.fullName,
      plan: (g) => g.targetQuantity,
      fact: (g) => g.fact,
      rate: (g) => g.rate,
    },
    defaultSortKey: 'user',
    storageKey: 'site-lead-goals',
  });
  const missed = goals.filter((g) => g.rate !== null && g.rate < 1).length;

  return (
    <SiteLeadLayout title="Цели сотрудников" breadcrumb="Участок">
      <p style={styles.hint}>
        План на смену по каждому сотруднику. Факт подтягивается из отметок о выполнении. Если цель не
        выполнена — укажите причину, она попадёт в отчёт.
      </p>

      <form onSubmit={handleSet} style={styles.form}>
        <label style={styles.dateLabel}>
          <span style={styles.caption}>Дата</span>
          <Input style={{ padding: '9px 12px', fontSize: '14px' }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <SearchSelect
          width="240px"
          value={form.userId}
          onChange={(userId) => setForm({ ...form, userId })}
          options={(data?.workers ?? []).map((w) => ({ value: w.id, label: w.fullName }))}
          placeholder="Найти сотрудника"
        />
        <input
          style={{ ...styles.input, maxWidth: '140px' }}
          type="number"
          min="0"
          placeholder="План, шт"
          value={form.target}
          onChange={(e) => setForm({ ...form, target: e.target.value })}
          required
        />
        <Button style={{ padding: '10px 18px', fontSize: '14px' }} type="submit">
          Задать цель
        </Button>
      </form>

      {!loading && goals.length > 0 && (
        <div style={styles.summary}>
          <span>
            Целей: <strong>{goals.length}</strong>
          </span>
          {missed > 0 && <Badge variant="priority-medium">Не выполнено: {missed}</Badge>}
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={4} cols={5} />
      ) : goals.length === 0 ? (
        <EmptyState icon="checklist" title="Целей на эту дату нет" hint="Задайте цель в форме выше." />
      ) : (
        <div style={styles.tableWrap}>
          <Table style={{ fontSize: '14px' }}>
            <thead>
              <tr>
                <SortHeader label="Сотрудник" sortKey="user" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <SortHeader label="План" sortKey="plan" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} align="right" />
                <SortHeader label="Факт" sortKey="fact" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} align="right" />
                <SortHeader label="Выполнение" sortKey="rate" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} align="right" />
                <Th style={{ fontWeight: 600, borderBottom: `1px solid ${COLORS.lightGreenBg}`, whiteSpace: 'nowrap' }}>Причина невыполнения</Th>
                <Th style={{ fontWeight: 600, borderBottom: `1px solid ${COLORS.lightGreenBg}`, whiteSpace: 'nowrap' }}></Th>
              </tr>
            </thead>
            <tbody>
              {controls.result.map((g) => {
                const notMet = g.rate !== null && g.rate < 1;
                return (
                  <tr key={g.id}>
                    <Td style={{ padding: '8px', borderBottom: `1px solid ${COLORS.lightGrayBg}` }}>
                      <div style={styles.nameCell}>
                        <Avatar name={g.fullName} size={26} />
                        {g.fullName}
                      </div>
                    </Td>
                    <Td align="right" style={{ padding: '8px', borderBottom: `1px solid ${COLORS.lightGrayBg}` }}>{g.targetQuantity}</Td>
                    <Td align="right" style={{ padding: '8px', borderBottom: `1px solid ${COLORS.lightGrayBg}` }}>{g.fact}</Td>
                    <td style={{ ...styles.td, textAlign: 'right', ...rateStyle(g.rate) }}>
                      {g.rate === null ? '—' : `${Math.round(g.rate * 100)}%`}
                    </td>
                    <Td style={{ padding: '8px', borderBottom: `1px solid ${COLORS.lightGrayBg}` }}>
                      {notMet || g.missReason ? (
                        <input
                          style={styles.reasonInput}
                          placeholder="почему не выполнено"
                          defaultValue={g.missReason ?? ''}
                          onChange={(e) => setReasons((p) => ({ ...p, [g.id]: e.target.value }))}
                          onBlur={() =>
                            saveReason(g.userId, g.targetQuantity, reasons[g.id] ?? g.missReason ?? '')
                          }
                        />
                      ) : (
                        <span style={styles.muted}>—</span>
                      )}
                    </Td>
                    <Td align="right" style={{ padding: '8px', borderBottom: `1px solid ${COLORS.lightGrayBg}` }}>
                      <button style={styles.linkDanger} onClick={() => handleDelete(g.id)}>
                        Удалить
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </SiteLeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0 },
  form: { display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '14px' },
  dateLabel: { display: 'flex', flexDirection: 'column', gap: '4px' },
  caption: { fontSize: '12px', color: COLORS.mutedText },
  input: {
    padding: '9px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '14px',
  },
  summary: { display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '12px', fontSize: '14px', color: COLORS.mutedText },
  tableWrap: {
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
    padding: '8px 12px',
    overflowX: 'auto',
  },
  td: { padding: '8px', borderBottom: `1px solid ${COLORS.lightGrayBg}` },
  nameCell: { display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap' },
  reasonInput: {
    width: '100%',
    minWidth: '180px',
    padding: '6px 10px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '13px',
  },
  muted: { color: COLORS.mutedText },
  linkDanger: { border: 'none', background: 'none', color: COLORS.error, cursor: 'pointer', fontSize: '13px' },
};
