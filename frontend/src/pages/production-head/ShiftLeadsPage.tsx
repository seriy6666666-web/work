import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Role, type ShiftLead, type Site } from '../../api/client';
import { ProductionHeadLayout } from './ProductionHeadLayout';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { SearchSelect } from '../../components/SearchSelect';
import { Select } from '../../components/Select';
import { COLORS, RADIUS, SHADOW } from '../../theme';
import { useTableControls, SortHeader } from '../../components/TableControls';
import { Table, Th, Td, Button, Input, CreateBlock } from '../../components/ui';

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

  const controls = useTableControls(leads, {
    searchText: (l) => `${l.user.fullName} ${l.site.name}`,
    sortAccessors: {
      date: (l) => l.date,
      type: (l) => l.type,
      site: (l) => l.site.name,
      user: (l) => l.user.fullName,
    },
    defaultSortKey: 'date',
    defaultSortDir: 'desc',
    storageKey: 'head-shift-leads',
  });
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
    if (!token) return;
    // Раньше обязательность держалась на нативном required у <select>.
    if (!form.siteId || !form.userId) {
      toast.error('Выберите участок и сотрудника');
      return;
    }
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

      <CreateBlock label="+ Старший смены">
        <form onSubmit={handleSet} style={styles.form}>
          <Select
            width="180px"
            ariaLabel="Участок"
            placeholder="Участок"
            value={form.siteId}
            // Сотрудник выбирается из выбранного участка, поэтому при смене участка
            // ранее выбранный человек сбрасывается.
            onChange={(siteId) => setForm({ ...form, siteId, userId: '' })}
            options={sites.map((s) => ({ value: s.id, label: s.name }))}
          />
          <SearchSelect
            width="240px"
            value={form.userId}
            onChange={(userId) => setForm({ ...form, userId })}
            options={candidates.map((c) => ({ value: c.id, label: c.fullName }))}
            placeholder={form.siteId ? 'Найти сотрудника' : 'Сначала выберите участок'}
            disabled={!form.siteId}
          />
          <Input style={{ padding: '9px 12px', fontSize: '14px' }}
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
          <Select
            width="140px"
            ariaLabel="Тип смены"
            value={form.type}
            onChange={(type) => setForm({ ...form, type })}
            options={[
              { value: 'NIGHT', label: 'Ночная' },
              { value: 'DAY', label: 'Дневная' },
            ]}
          />
          <Button style={{ padding: '10px 18px', fontSize: '14px' }} type="submit">
            Назначить
          </Button>
        </form>
      </CreateBlock>

      <div style={styles.period}>
        <span style={styles.periodTitle}>Показать назначения</span>
        <label style={styles.dateLabel}>
          <span style={styles.caption}>с</span>
          <Input style={{ padding: '9px 12px', fontSize: '14px' }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label style={styles.dateLabel}>
          <span style={styles.caption}>по</span>
          <Input style={{ padding: '9px 12px', fontSize: '14px' }} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {loading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : leads.length === 0 ? (
        <EmptyState icon="calendar" title="Назначений нет" hint="Назначьте старшего кнопкой «+ Старший смены»." />
      ) : (
        <div style={styles.tableWrap}>
          <Table style={{ fontSize: '14px' }}>
            <thead>
              <tr>
                <SortHeader label="Дата" sortKey="date" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <SortHeader label="Смена" sortKey="type" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <SortHeader label="Участок" sortKey="site" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <SortHeader label="Старший" sortKey="user" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
                <Th style={{ fontWeight: 600, borderBottom: `1px solid ${COLORS.lightGreenBg}`, whiteSpace: 'nowrap' }}></Th>
              </tr>
            </thead>
            <tbody>
              {controls.result.map((l) => (
                <tr key={l.id}>
                  <Td style={{ padding: '8px', borderBottom: `1px solid ${COLORS.lightGrayBg}`, whiteSpace: 'nowrap' }}>{new Date(l.date).toLocaleDateString('ru-RU', { timeZone: 'UTC' })}</Td>
                  <Td style={{ padding: '8px', borderBottom: `1px solid ${COLORS.lightGrayBg}`, whiteSpace: 'nowrap' }}>
                    <Badge variant={l.type === 'NIGHT' ? 'shared' : 'accent'}>
                      {l.type === 'NIGHT' ? 'Ночная' : 'Дневная'}
                    </Badge>
                  </Td>
                  <Td style={{ padding: '8px', borderBottom: `1px solid ${COLORS.lightGrayBg}`, whiteSpace: 'nowrap' }}>{l.site.name}</Td>
                  <Td style={{ padding: '8px', borderBottom: `1px solid ${COLORS.lightGrayBg}`, whiteSpace: 'nowrap' }}>
                    <div style={styles.nameCell}>
                      <Avatar name={l.user.fullName} size={26} />
                      {l.user.fullName}
                    </div>
                  </Td>
                  <Td align="right" style={{ padding: '8px', borderBottom: `1px solid ${COLORS.lightGrayBg}`, whiteSpace: 'nowrap' }}>
                    <button style={styles.linkDanger} onClick={() => handleDelete(l.id)}>
                      Снять
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </ProductionHeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0 },
  form: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' },
  period: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
    marginBottom: '14px',
    paddingTop: '14px',
    borderTop: `1px solid ${COLORS.lightGrayBg}`,
  },
  periodTitle: { fontSize: '13px', color: COLORS.mutedText, alignSelf: 'center' },
  dateLabel: { display: 'flex', flexDirection: 'column', gap: '4px' },
  caption: { fontSize: '12px', color: COLORS.mutedText },
  tableWrap: {
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
    padding: '8px 12px',
    overflowX: 'auto',
  },
  nameCell: { display: 'flex', alignItems: 'center', gap: '10px' },
  linkDanger: { border: 'none', background: 'none', color: COLORS.error, cursor: 'pointer', fontSize: '13px' },
};
