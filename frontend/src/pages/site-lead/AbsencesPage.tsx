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
import { COLORS, RADIUS } from '../../theme';

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
    if (!token || !form.userId || !form.startDate || !form.endDate) return;
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

      <form onSubmit={handleCreate} style={styles.createForm}>
        <select
          style={styles.input}
          value={form.userId}
          onChange={(e) => setForm({ ...form, userId: e.target.value })}
          required
        >
          <option value="">Выберите сотрудника</option>
          {matrix?.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>
        <select
          style={styles.input}
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as AbsenceType })}
        >
          {ABSENCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {ABSENCE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input
          style={styles.input}
          type="date"
          value={form.startDate}
          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          required
        />
        <input
          style={styles.input}
          type="date"
          value={form.endDate}
          onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          required
        />
        <button style={styles.button} type="submit" disabled={creating}>
          Добавить
        </button>
      </form>

      {loading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : absences.length === 0 ? (
        <EmptyState icon="calendar-x" title="Отсутствий пока нет" hint="Отметьте отсутствие сотрудника в форме выше." />
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Сотрудник</th>
              <th style={styles.th}>Тип</th>
              <th style={styles.th}>Период</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {absences.map((a) => (
              <tr key={a.id}>
                <td style={styles.td}>
                  {a.user ? (
                    <div style={styles.nameCell}>
                      <Avatar name={a.user.fullName} size={26} />
                      {a.user.fullName}
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={styles.td}>
                  <Badge variant={TYPE_BADGE[a.type]}>{ABSENCE_TYPE_LABELS[a.type]}</Badge>
                </td>
                <td style={styles.td}>
                  {new Date(a.startDate).toLocaleDateString('ru-RU')} –{' '}
                  {new Date(a.endDate).toLocaleDateString('ru-RU')}
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  <button style={styles.linkButtonDanger} onClick={() => handleDelete(a.id)}>
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  input: {
    padding: '10px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '15px',
  },
  button: {
    padding: '10px 20px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
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
  linkButtonDanger: {
    border: 'none',
    background: 'none',
    color: COLORS.error,
    cursor: 'pointer',
    fontSize: '14px',
  },
};
