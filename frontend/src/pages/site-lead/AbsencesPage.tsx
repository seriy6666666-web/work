import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Absence, type AbsenceType, type CompetencyMatrix } from '../../api/client';
import { ABSENCE_TYPES, ABSENCE_TYPE_LABELS } from '../../constants/absenceTypes';
import { SiteLeadLayout } from './SiteLeadLayout';
import { Avatar } from '../../components/Avatar';
import { Badge, type BadgeVariant } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { Select } from '../../components/Select';
import { useTableControls, SortHeader } from '../../components/TableControls';
import { Table, Th, Td, Button, LinkButton, Input, CreateBlock } from '../../components/ui';

const TYPE_BADGE: Record<AbsenceType, BadgeVariant> = {
  SICK_LEAVE: 'danger',
  VACATION: 'accent',
  UNPAID_LEAVE: 'muted',
};

export function AbsencesPage() {
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [absences, setAbsences] = useState<Absence[]>([]);

  const controls = useTableControls(absences, {
    searchText: (a) => a.user?.fullName ?? '',
    sortAccessors: {
      user: (a) => a.user?.fullName ?? null,
      type: (a) => a.type,
      period: (a) => a.startDate,
    },
    defaultSortKey: 'period',
    defaultSortDir: 'desc',
    storageKey: 'site-lead-absences',
  });
  const [matrix, setMatrix] = useState<CompetencyMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({ userId: '', type: 'SICK_LEAVE' as AbsenceType, startDate: '', endDate: '' });

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const [absencesData, matrixData] = await Promise.all([
        api.listAbsencesSite(token),
        api.getCompetencyMatrix(token),
      ]);
      setAbsences(absencesData);
      setMatrix(matrixData);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить отсутствия');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    // Раньше на пустые поля ругался нативный required у <select>. Своего компонента
    // это не касается, поэтому говорим прямо, а не отменяем отправку молча.
    if (!form.userId || !form.startDate || !form.endDate) {
      toast.error('Выберите сотрудника и обе даты');
      return;
    }
    setCreating(true);
    try {
      await api.createAbsence(token, form);
      setForm({ userId: '', type: 'SICK_LEAVE', startDate: '', endDate: '' });
      toast.success('Отсутствие отмечено');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось отметить отсутствие');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    const ok = await confirm({
      title: 'Удаление отметки',
      message: 'Удалить отметку отсутствия?',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteAbsence(token, id);
      toast.success('Отметка удалена');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить отметку');
    }
  }

  return (
    <SiteLeadLayout title="Отсутствия" breadcrumb="Начальник участка">

      <CreateBlock label="+ Отсутствие">
        <form onSubmit={handleCreate} style={styles.createForm}>
          <Select
            width="220px"
            ariaLabel="Сотрудник"
            placeholder="Выберите сотрудника"
            value={form.userId}
            onChange={(userId) => setForm({ ...form, userId })}
            options={(matrix?.users ?? []).map((u) => ({ value: u.id, label: u.fullName }))}
          />
          <Select
            width="200px"
            ariaLabel="Тип отсутствия"
            value={form.type}
            onChange={(type) => setForm({ ...form, type: type as AbsenceType })}
            options={ABSENCE_TYPES.map((t) => ({ value: t, label: ABSENCE_TYPE_LABELS[t] }))}
          />
          <Input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            required
          />
          <Input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            required
          />
          <Button type="submit" disabled={creating}>
            Добавить
          </Button>
        </form>
      </CreateBlock>

      {loading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : absences.length === 0 ? (
        <EmptyState icon="calendar-x" title="Отсутствий пока нет" hint="Отметьте отсутствие кнопкой «+ Отсутствие»." />
      ) : (
        <Table>
          <thead>
            <tr>
              <SortHeader label="Сотрудник" sortKey="user" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <SortHeader label="Тип" sortKey="type" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <SortHeader label="Период" sortKey="period" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {controls.result.map((a) => (
              <tr key={a.id}>
                <Td>
                  {a.user ? (
                    <div style={styles.nameCell}>
                      <Avatar name={a.user.fullName} size={26} />
                      {a.user.fullName}
                    </div>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>
                  <Badge variant={TYPE_BADGE[a.type]}>{ABSENCE_TYPE_LABELS[a.type]}</Badge>
                </Td>
                <Td>
                  {new Date(a.startDate).toLocaleDateString('ru-RU')} –{' '}
                  {new Date(a.endDate).toLocaleDateString('ru-RU')}
                </Td>
                <Td align="right">
                  <LinkButton danger onClick={() => handleDelete(a.id)}>
                    Удалить
                  </LinkButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </SiteLeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  createForm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '24px',
    alignItems: 'center',
  },
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
};
