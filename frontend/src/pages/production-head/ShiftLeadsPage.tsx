import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Role, type ShiftLead, type Site } from '../../api/client';
import { ProductionHeadLayout } from './ProductionHeadLayout';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { COLORS, RADIUS, SHADOW } from '../../theme';

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function ShiftLeadsPage() {
  const { token } = useAuth();
  const toast = useToast();

  const [from, setFrom] = useState(() => ymd(new Date()));
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return ymd(d);
  });
  const [leads, setLeads] = useState<ShiftLead[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [people, setPeople] = useState<{ id: string; fullName: string; role: Role }[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ siteId: '', userId: '', date: ymd(new Date()), type: 'NIGHT' });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [leadsData, sitesData] = await Promise.all([
        api.listShiftLeads(token, from, to),
        api.listSites(token),
      ]);
      setLeads(leadsData);
      setSites(sitesData);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить смены');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  // Список людей участка нужен, чтобы выбрать старшего: обычно это рабочий.
  useEffect(() => {
    if (!token || !form.siteId) {
      setPeople([]);
      return;
    }
    api
      .listShiftLeadCandidates(token, form.siteId)
      .then(setPeople)
      .catch(() => setPeople([]));
  }, [token, form.siteId]);

  async function handleSet(e: FormEvent) {
    e.preventDefault();
    if (!token || !form.siteId || !form.userId) return;
    try {
      await api.setShiftLead(token, {
        siteId: form.siteId,
        userId: form.userId,
        date: form.date,
        type: form.type as ShiftLead['type'],
      });
      setForm({ ...form, userId: '' });
      toast.success('Старший смены назначен');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось назначить');
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    try {
      await api.deleteShiftLead(token, id);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось снять назначение');
    }
  }

  const candidates = people;

  return (
    <ProductionHeadLayout title="Старшие смен" breadcrumb="Производство">
      <p style={styles.hint}>
        Кто главный на участке в смену, когда начальника участка нет (например ночью). Назначенный
        получает уведомление и может передавать дела при пересменке.
      </p>

      <form onSubmit={handleSet} style={styles.form}>
        <select
          style={styles.input}
          value={form.siteId}
          onChange={(e) => setForm({ ...form, siteId: e.target.value, userId: '' })}
          required
        >
          <option value="">Участок</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          style={{ ...styles.input, flex: 1, minWidth: '200px' }}
          value={form.userId}
          onChange={(e) => setForm({ ...form, userId: e.target.value })}
          required
          disabled={!form.siteId}
        >
          <option value="">{form.siteId ? 'Сотрудник' : 'Сначала выберите участок'}</option>
          {candidates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </select>
        <input
          style={styles.input}
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          required
        />
        <select style={styles.input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="NIGHT">Ночная</option>
          <option value="DAY">Дневная</option>
        </select>
        <button style={styles.button} type="submit">
          Назначить
        </button>
      </form>

      <div style={styles.period}>
        <label style={styles.dateLabel}>
          <span style={styles.caption}>С</span>
          <input style={styles.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label style={styles.dateLabel}>
          <span style={styles.caption}>По</span>
          <input style={styles.input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {loading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : leads.length === 0 ? (
        <EmptyState icon="calendar" title="Назначений нет" hint="Назначьте старшего смены в форме выше." />
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Дата</th>
                <th style={styles.th}>Смена</th>
                <th style={styles.th}>Участок</th>
                <th style={styles.th}>Старший</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td style={styles.td}>{new Date(l.date).toLocaleDateString('ru-RU', { timeZone: 'UTC' })}</td>
                  <td style={styles.td}>
                    <Badge variant={l.type === 'NIGHT' ? 'shared' : 'accent'}>
                      {l.type === 'NIGHT' ? 'Ночная' : 'Дневная'}
                    </Badge>
                  </td>
                  <td style={styles.td}>{l.site.name}</td>
                  <td style={styles.td}>
                    <div style={styles.nameCell}>
                      <Avatar name={l.user.fullName} size={26} />
                      {l.user.fullName}
                    </div>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <button style={styles.linkDanger} onClick={() => handleDelete(l.id)}>
                      Снять
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ProductionHeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0 },
  form: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' },
  period: { display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '14px' },
  dateLabel: { display: 'flex', flexDirection: 'column', gap: '4px' },
  caption: { fontSize: '12px', color: COLORS.mutedText },
  input: {
    padding: '9px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '14px',
  },
  button: {
    padding: '10px 18px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tableWrap: {
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
    padding: '8px 12px',
    overflowX: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    color: COLORS.mutedText,
    fontWeight: 600,
    fontSize: '13px',
    borderBottom: `1px solid ${COLORS.lightGreenBg}`,
    whiteSpace: 'nowrap',
  },
  td: { padding: '8px', borderBottom: `1px solid ${COLORS.lightGrayBg}`, whiteSpace: 'nowrap' },
  nameCell: { display: 'flex', alignItems: 'center', gap: '10px' },
  linkDanger: { border: 'none', background: 'none', color: COLORS.error, cursor: 'pointer', fontSize: '13px' },
};
