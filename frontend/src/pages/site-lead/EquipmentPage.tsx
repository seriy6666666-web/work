import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
  api,
  ApiError,
  type Equipment,
  type EquipmentStatus,
} from '../../api/client';
import { SiteLeadLayout } from './SiteLeadLayout';
import { Badge, type BadgeVariant } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonCards } from '../../components/Skeleton';
import { useTableControls, SortSelect, type SortChoice } from '../../components/TableControls';
import { EmptyState } from '../../components/EmptyState';
import { Select } from '../../components/Select';
import { COLORS, RADIUS, SHADOW } from '../../theme';
import { Button, Input, LinkButton, CreateBlock, FilterChips } from '../../components/ui';

const STATUS_META: Record<EquipmentStatus, { label: string; variant: BadgeVariant }> = {
  OPERATIONAL: { label: 'В работе', variant: 'accent' },
  MAINTENANCE: { label: 'На обслуживании', variant: 'priority-medium' },
  BROKEN: { label: 'Поломка', variant: 'danger' },
};

const STATUS_ORDER: EquipmentStatus[] = ['OPERATIONAL', 'MAINTENANCE', 'BROKEN'];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU');
}

/** Returns true when maintenance is due within 7 days or overdue. */
function maintenanceDueSoon(iso: string | null): boolean {
  if (!iso) return false;
  const due = new Date(iso).getTime();
  return due - Date.now() < 7 * 24 * 60 * 60 * 1000;
}

/**
 * Порядок оборудования. По сроку обслуживания — чтобы не пропустить то, что
 * скоро встанет; по состоянию — чтобы сломанное было сверху.
 */
const SORT_CHOICES: SortChoice[] = [
  { key: 'name', dir: 'asc', label: 'по алфавиту' },
  { key: 'maintenance', dir: 'asc', label: 'по сроку обслуживания' },
  { key: 'status', dir: 'asc', label: 'сначала неисправное' },
  { key: 'created', dir: 'desc', label: 'сначала новое' },
];

/** Сломанное впереди: с ним надо что-то делать сегодня. */
const STATUS_SEVERITY: Record<string, number> = { BROKEN: 0, MAINTENANCE: 1, OPERATIONAL: 2 };

export function EquipmentPage() {
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<'all' | 'broken' | 'maintenance' | 'ok'>('all');
  const [items, setItems] = useState<Equipment[]>([]);

  const controls = useTableControls(items, {
    searchText: (e) => e.name,
    sortAccessors: {
      name: (e) => e.name,
      // Без даты обслуживания элемент уходит в конец — там нечего просрочить.
      maintenance: (e) => e.nextMaintenanceAt,
      status: (e) => STATUS_SEVERITY[String(e.status)] ?? 9,
      created: (e) => e.createdAt,
    },
    defaultSortKey: 'name',
    storageKey: 'site-lead-equipment',
  });

  const counts = {
    all: items.length,
    broken: items.filter((e) => e.status === 'BROKEN').length,
    maintenance: items.filter((e) => e.status === 'MAINTENANCE').length,
    ok: items.filter((e) => e.status === 'OPERATIONAL').length,
  };
  const visible = controls.result.filter((e) => {
    if (filter === 'broken') return e.status === 'BROKEN';
    if (filter === 'maintenance') return e.status === 'MAINTENANCE';
    if (filter === 'ok') return e.status === 'OPERATIONAL';
    return true;
  });
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [creating, setCreating] = useState(false);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      setItems(await api.listEquipment(token));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить оборудование');
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
    if (!token || !newName.trim()) return;
    setCreating(true);
    try {
      await api.createEquipment(token, {
        name: newName.trim(),
        nextMaintenanceAt: newDate ? new Date(newDate).toISOString() : null,
      });
      setNewName('');
      setNewDate('');
      toast.success('Оборудование добавлено');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось добавить оборудование');
    } finally {
      setCreating(false);
    }
  }

  async function handleStatus(item: Equipment, status: EquipmentStatus) {
    if (!token || status === item.status) return;
    // optimistic update
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status } : it)));
    try {
      await api.updateEquipment(token, item.id, { status });
      if (status === 'BROKEN') {
        toast.toast('Начальник производства уведомлён о поломке', 'info');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось изменить статус');
      await refresh();
    }
  }

  async function handleDate(item: Equipment, value: string) {
    if (!token) return;
    const iso = value ? new Date(value).toISOString() : null;
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, nextMaintenanceAt: iso } : it)));
    try {
      await api.updateEquipment(token, item.id, { nextMaintenanceAt: iso });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось сохранить дату обслуживания');
      await refresh();
    }
  }

  async function handleDelete(item: Equipment) {
    if (!token) return;
    const ok = await confirm({
      title: 'Удаление оборудования',
      message: `Удалить «${item.name}» из списка участка?`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteEquipment(token, item.id);
      toast.success('Оборудование удалено');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить оборудование');
    }
  }

  return (
    <SiteLeadLayout title="Оборудование" breadcrumb="Участок">
      <p style={styles.hint}>
        Ведите список оборудования участка, отмечайте статус и дату следующего обслуживания. При
        переводе в статус «Поломка» начальник производства получает уведомление.
      </p>

      <CreateBlock label="+ Оборудование">
        <form onSubmit={handleCreate} style={styles.createForm}>
          <Input
            placeholder="Название (например «Линия сборки №2»)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <label style={styles.dateLabel}>
            <span style={styles.dateCaption}>След. обслуживание</span>
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </label>
          <Button style={{ padding: '10px 18px', fontSize: '14px' }} type="submit" disabled={creating || !newName.trim()}>
            Добавить
          </Button>
        </form>
      </CreateBlock>

      {loading ? (
        <SkeletonCards count={3} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="wrench"
          title="Оборудование не добавлено"
          hint="Добавьте оборудование кнопкой «+ Оборудование»."
        />
      ) : (
        <div style={styles.list}>
          <div style={styles.listControls}>
            <SortSelect
              choices={SORT_CHOICES}
              sortKey={controls.sortKey}
              dir={controls.sortDir}
              onSelect={controls.setSort}
            />
            <FilterChips
              options={[
                { key: 'all', label: 'Всё' },
                { key: 'broken', label: 'Поломка' },
                { key: 'maintenance', label: 'Обслуживание' },
                { key: 'ok', label: 'В работе' },
              ]}
              value={filter}
              counts={counts}
              onChange={setFilter}
            />
          </div>
          {visible.length === 0 && (
            <EmptyState icon="search" title="Ничего не найдено" hint="Измените поиск или фильтр." />
          )}
          {visible.map((item) => {
            const dueSoon = item.status !== 'BROKEN' && maintenanceDueSoon(item.nextMaintenanceAt);
            return (
              <div
                key={item.id}
                style={{
                  ...styles.card,
                  // Цвет слева несёт смысл: красное — стоит, янтарное — на
                  // обслуживании. В цеху карточки просматривают, а не читают.
                  borderLeft: `4px solid ${
                    item.status === 'BROKEN'
                      ? 'var(--err)'
                      : item.status === 'MAINTENANCE'
                        ? 'var(--warn)'
                        : 'var(--acc)'
                  }`,
                }}
              >
                <div style={styles.cardMain}>
                  <div style={styles.nameRow}>
                    <strong>{item.name}</strong>
                    <Badge variant={STATUS_META[item.status].variant}>
                      {STATUS_META[item.status].label}
                    </Badge>
                    {dueSoon && <Badge variant="priority-medium">Обслуживание скоро</Badge>}
                  </div>
                  <div style={styles.metaRow}>
                    <span style={styles.metaItem}>
                      След. обслуживание:{' '}
                      <input
                        style={styles.inlineDate}
                        type="date"
                        value={item.nextMaintenanceAt ? item.nextMaintenanceAt.slice(0, 10) : ''}
                        onChange={(e) => handleDate(item, e.target.value)}
                      />
                      <span style={styles.metaMuted}>({formatDate(item.nextMaintenanceAt)})</span>
                    </span>
                  </div>
                </div>
                <div style={styles.actions}>
                  {/*
                    Заявка в ремонт — одной кнопкой, а не выбором в списке.
                    Станок встаёт посреди смены, и в этот момент человек стоит у
                    него с телефоном: чем меньше шагов, тем выше шанс, что о
                    поломке вообще узнают. Начальнику производства уходит
                    оповещение сразу.
                  */}
                  {item.status === 'BROKEN' ? (
                    <Button variant="ghost" onClick={() => handleStatus(item, 'OPERATIONAL')}>
                      Вернуть в работу
                    </Button>
                  ) : (
                    <Button variant="danger" onClick={() => handleStatus(item, 'BROKEN')}>
                      Заявка в ремонт
                    </Button>
                  )}
                  <Select
                    width="170px"
                    ariaLabel="Состояние оборудования"
                    value={item.status}
                    onChange={(status) => handleStatus(item, status as EquipmentStatus)}
                    options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label }))}
                  />
                  <LinkButton danger onClick={() => handleDelete(item)}>
                    Удалить
                  </LinkButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SiteLeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0 },
  createForm: { display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' },
  dateLabel: { display: 'flex', flexDirection: 'column', gap: '4px' },
  dateCaption: { fontSize: '12px', color: COLORS.mutedText },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  /** Выбор порядка прижат вправо, чтобы не спорить с карточками. */
  listControls: { display: 'flex', justifyContent: 'flex-end' },
  card: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
    flexWrap: 'wrap',
  },
  cardMain: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '240px', flex: 1 },
  nameRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  metaRow: { display: 'flex', gap: '16px', flexWrap: 'wrap' },
  metaItem: { fontSize: '13px', color: COLORS.mutedText, display: 'flex', alignItems: 'center', gap: '6px' },
  metaMuted: { color: COLORS.mutedText },
  inlineDate: {
    padding: '4px 8px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '13px',
  },
  actions: { display: 'flex', alignItems: 'center', gap: '12px' },
  linkDanger: { border: 'none', background: 'none', color: COLORS.error, cursor: 'pointer', fontSize: '13px' },
};
