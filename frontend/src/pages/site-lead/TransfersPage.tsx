import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type EligibleUser, type Transfer } from '../../api/client';
import { SiteLeadLayout } from './SiteLeadLayout';
import { Avatar } from '../../components/Avatar';
import { Badge, type BadgeVariant } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { Select } from '../../components/Select';
import { COLORS } from '../../theme';
import { useTableControls, SortHeader } from '../../components/TableControls';
import { Table, Th, Td, Button, LinkButton, Input, CreateBlock } from '../../components/ui';

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

      <CreateBlock label="+ Запрос перевода">
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
            Запросить перевод
          </Button>
        </form>
      </CreateBlock>

      {loading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : (
        <>
          <h3 style={styles.subheading}>Ожидают вашего решения (ваши сотрудники)</h3>
          <Table>
            <thead>
              <tr>
                <SortHeader label="Сотрудник" sortKey="user" activeKey={outControls.sortKey} dir={outControls.sortDir} onSort={outControls.toggleSort} />
                <SortHeader label="Запросил участок" sortKey="site" activeKey={outControls.sortKey} dir={outControls.sortDir} onSort={outControls.toggleSort} />
                <SortHeader label="Период" sortKey="period" activeKey={outControls.sortKey} dir={outControls.sortDir} onSort={outControls.toggleSort} />
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {outControls.result.map((t) => (
                <tr key={t.id}>
                  <Td>
                    <div style={styles.nameCell}>
                      <Avatar name={t.user.fullName} size={26} />
                      {t.user.fullName}
                    </div>
                  </Td>
                  <Td>{t.toSite.name}</Td>
                  <Td>
                    {new Date(t.startDate).toLocaleDateString('ru-RU')} –{' '}
                    {new Date(t.endDate).toLocaleDateString('ru-RU')}
                  </Td>
                  <Td align="right">
                    <LinkButton onClick={() => handleRespond(t.id, true)}>
                      Подтвердить
                    </LinkButton>
                    <LinkButton danger onClick={() => handleRespond(t.id, false)}>
                      Отклонить
                    </LinkButton>
                  </Td>
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
          </Table>

          <h3 style={styles.subheading}>Ваши запросы</h3>
          <Table>
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
                  <Td>
                    <div style={styles.nameCell}>
                      <Avatar name={t.user.fullName} size={26} />
                      {t.user.fullName}
                    </div>
                  </Td>
                  <Td>{t.fromSite.name}</Td>
                  <Td>
                    {new Date(t.startDate).toLocaleDateString('ru-RU')} –{' '}
                    {new Date(t.endDate).toLocaleDateString('ru-RU')}
                  </Td>
                  <Td>
                    <Badge variant={STATUS_BADGE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                  </Td>
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
          </Table>
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
  td: {
    padding: '10px 8px',
    borderBottom: `1px solid ${COLORS.lightGreenBg}`,
  },
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
};
