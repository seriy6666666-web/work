import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type EligibleUser, type Transfer } from '../../api/client';
import { SiteLeadLayout } from './SiteLeadLayout';
import { Avatar } from '../../components/Avatar';
import { Badge, type BadgeVariant } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { Select } from '../../components/Select';
import { COLORS, RADIUS } from '../../theme';
import { useTableControls, SortHeader } from '../../components/TableControls';

const STATUS_LABELS: Record<Transfer['status'], string> = {
  PENDING: 'Ожидает решения',
  APPROVED: 'Подтверждён',
  REJECTED: 'Отклонён',
};

const STATUS_BADGE: Record<Transfer['status'], BadgeVariant> = {
  PENDING: 'priority-medium',
  APPROVED: 'accent',
  REJECTED: 'danger',
};

export function TransfersPage() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [eligibleUsers, setEligibleUsers] = useState<EligibleUser[]>([]);
  const [incoming, setIncoming] = useState<Transfer[]>([]);
  const [outgoing, setOutgoing] = useState<Transfer[]>([]);

  // Две таблицы — два набора настроек: порядок в «отдаём» и «принимаем» человек
  // выбирает независимо, и запоминаются они тоже порознь.
  const outControls = useTableControls(outgoing, {
    searchText: (t) => `${t.user.fullName} ${t.toSite.name}`,
    sortAccessors: {
      user: (t) => t.user.fullName,
      site: (t) => t.toSite.name,
      period: (t) => t.startDate,
    },
    defaultSortKey: 'period',
    defaultSortDir: 'desc',
    storageKey: 'site-lead-transfers-out',
  });
  const inControls = useTableControls(incoming, {
    searchText: (t) => `${t.user.fullName} ${t.fromSite.name}`,
    sortAccessors: {
      user: (t) => t.user.fullName,
      site: (t) => t.fromSite.name,
      period: (t) => t.startDate,
      status: (t) => t.status,
    },
    defaultSortKey: 'period',
    defaultSortDir: 'desc',
    storageKey: 'site-lead-transfers-in',
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({ userId: '', startDate: '', endDate: '' });

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const [eligibleData, incomingData, outgoingData] = await Promise.all([
        api.listEligibleTransferUsers(token),
        api.listTransfersIncoming(token),
        api.listTransfersOutgoing(token),
      ]);
      setEligibleUsers(eligibleData);
      setIncoming(incomingData);
      setOutgoing(outgoingData);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить переводы');
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
    if (!token || !user?.siteId) return;
    // Раньше обязательность держалась на нативном required у <select>.
    if (!form.userId || !form.startDate || !form.endDate) {
      toast.error('Выберите сотрудника и обе даты');
      return;
    }
    setCreating(true);
    try {
      await api.createTransfer(token, {
        userId: form.userId,
        toSiteId: user.siteId,
        startDate: form.startDate,
        endDate: form.endDate,
      });
      setForm({ userId: '', startDate: '', endDate: '' });
      toast.success('Запрос на перевод отправлен');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось запросить перевод');
    } finally {
      setCreating(false);
    }
  }

  async function handleRespond(id: string, approve: boolean) {
    if (!token) return;
    try {
      await api.respondTransfer(token, id, { approve });
      toast.success(approve ? 'Перевод подтверждён' : 'Перевод отклонён');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось обработать запрос');
    }
  }

  return (
    <SiteLeadLayout title="Переводы между участками" breadcrumb="Начальник участка">

      <form onSubmit={handleCreate} style={styles.createForm}>
        <Select
          width="300px"
          ariaLabel="Сотрудник"
          placeholder="Выберите сотрудника с другого участка"
          value={form.userId}
          onChange={(userId) => setForm({ ...form, userId })}
          options={eligibleUsers.map((u) => ({
            value: u.id,
            label: u.fullName,
            hint: u.site.name,
          }))}
        />
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
          Запросить перевод
        </button>
      </form>

      {loading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : (
        <>
          <h3 style={styles.subheading}>Ожидают вашего решения (ваши сотрудники)</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <SortHeader label="Сотрудник" sortKey="user" activeKey={outControls.sortKey} dir={outControls.sortDir} onSort={outControls.toggleSort} />
                <SortHeader label="Запросил участок" sortKey="site" activeKey={outControls.sortKey} dir={outControls.sortDir} onSort={outControls.toggleSort} />
                <SortHeader label="Период" sortKey="period" activeKey={outControls.sortKey} dir={outControls.sortDir} onSort={outControls.toggleSort} />
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {outControls.result.map((t) => (
                <tr key={t.id}>
                  <td style={styles.td}>
                    <div style={styles.nameCell}>
                      <Avatar name={t.user.fullName} size={26} />
                      {t.user.fullName}
                    </div>
                  </td>
                  <td style={styles.td}>{t.toSite.name}</td>
                  <td style={styles.td}>
                    {new Date(t.startDate).toLocaleDateString('ru-RU')} –{' '}
                    {new Date(t.endDate).toLocaleDateString('ru-RU')}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <button style={styles.linkButton} onClick={() => handleRespond(t.id, true)}>
                      Подтвердить
                    </button>
                    <button style={styles.linkButtonDanger} onClick={() => handleRespond(t.id, false)}>
                      Отклонить
                    </button>
                  </td>
                </tr>
              ))}
              {outgoing.length === 0 && (
                <tr>
                  <td style={styles.td} colSpan={4}>
                    Нет ожидающих запросов
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <h3 style={styles.subheading}>Ваши запросы</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <SortHeader label="Сотрудник" sortKey="user" activeKey={inControls.sortKey} dir={inControls.sortDir} onSort={inControls.toggleSort} />
                <SortHeader label="С участка" sortKey="site" activeKey={inControls.sortKey} dir={inControls.sortDir} onSort={inControls.toggleSort} />
                <SortHeader label="Период" sortKey="period" activeKey={inControls.sortKey} dir={inControls.sortDir} onSort={inControls.toggleSort} />
                <SortHeader label="Статус" sortKey="status" activeKey={inControls.sortKey} dir={inControls.sortDir} onSort={inControls.toggleSort} />
              </tr>
            </thead>
            <tbody>
              {inControls.result.map((t) => (
                <tr key={t.id}>
                  <td style={styles.td}>
                    <div style={styles.nameCell}>
                      <Avatar name={t.user.fullName} size={26} />
                      {t.user.fullName}
                    </div>
                  </td>
                  <td style={styles.td}>{t.fromSite.name}</td>
                  <td style={styles.td}>
                    {new Date(t.startDate).toLocaleDateString('ru-RU')} –{' '}
                    {new Date(t.endDate).toLocaleDateString('ru-RU')}
                  </td>
                  <td style={styles.td}>
                    <Badge variant={STATUS_BADGE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                  </td>
                </tr>
              ))}
              {incoming.length === 0 && (
                <tr>
                  <td style={styles.td} colSpan={4}>
                    Запросов пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </SiteLeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  subheading: {
    marginTop: '32px',
  },
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
  linkButton: {
    border: 'none',
    background: 'none',
    color: COLORS.accentDark,
    cursor: 'pointer',
    fontSize: '14px',
    marginLeft: '12px',
  },
  linkButtonDanger: {
    border: 'none',
    background: 'none',
    color: COLORS.error,
    cursor: 'pointer',
    fontSize: '14px',
    marginLeft: '12px',
  },
};
