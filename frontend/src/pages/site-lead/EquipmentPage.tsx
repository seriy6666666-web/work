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
import { EmptyState } from '../../components/EmptyState';
import { COLORS, RADIUS, SHADOW } from '../../theme';

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

export function EquipmentPage() {
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<Equipment[]>([]);
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

      <form onSubmit={handleCreate} style={styles.createForm}>
        <input
          style={styles.input}
          placeholder="Название (например «Линия сборки №2»)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <label style={styles.dateLabel}>
          <span style={styles.dateCaption}>След. обслуживание</span>
          <input
            style={styles.input}
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
        </label>
        <button style={styles.button} type="submit" disabled={creating || !newName.trim()}>
          Добавить
        </button>
      </form>

      {loading ? (
        <SkeletonCards count={3} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="wrench"
          title="Оборудование не добавлено"
          hint="Добавьте первую единицу оборудования в форме выше."
        />
      ) : (
        <div style={styles.list}>
          {items.map((item) => {
            const dueSoon = item.status !== 'BROKEN' && maintenanceDueSoon(item.nextMaintenanceAt);
            return (
              <div key={item.id} style={styles.card}>
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
                  <select
                    style={styles.statusSelect}
                    value={item.status}
                    onChange={(e) => handleStatus(item, e.target.value as EquipmentStatus)}
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_META[s].label}
                      </option>
                    ))}
                  </select>
                  <button style={styles.linkDanger} onClick={() => handleDelete(item)}>
                    Удалить
                  </button>
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
  input: {
    padding: '10px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '15px',
  },
  dateLabel: { display: 'flex', flexDirection: 'column', gap: '4px' },
  dateCaption: { fontSize: '12px', color: COLORS.mutedText },
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
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
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
  statusSelect: {
    padding: '8px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '14px',
  },
  linkDanger: { border: 'none', background: 'none', color: COLORS.error, cursor: 'pointer', fontSize: '13px' },
};
