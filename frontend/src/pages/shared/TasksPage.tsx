import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type CurrentUser, type Task } from '../../api/client';
import { ManagerLayout } from './ManagerLayout';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonCards } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { Select } from '../../components/Select';
import { COLORS, RADIUS, SHADOW } from '../../theme';
import { Button } from '../../components/ui';

interface Assignable {
  id: string;
  fullName: string;
  role: CurrentUser['role'];
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('ru-RU') : '';
}

/** Просрочена ли открытая задача. */
function isOverdue(task: Task): boolean {
  if (task.status === 'DONE' || !task.dueDate) return false;
  const due = new Date(task.dueDate);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

export function TasksPage() {
  const { token, user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<Assignable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);

  const [form, setForm] = useState({ title: '', description: '', dueDate: '', assigneeId: '' });
  const [creating, setCreating] = useState(false);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const [tasksData, peopleData] = await Promise.all([
        api.listTasks(token),
        api.listAssignableForTasks(token),
      ]);
      setTasks(tasksData);
      setPeople(peopleData);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить задачи');
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
    if (!token || !form.title.trim()) return;
    setCreating(true);
    try {
      await api.createTask(token, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        assigneeId: form.assigneeId || undefined,
      });
      setForm({ title: '', description: '', dueDate: '', assigneeId: '' });
      toast.success('Задача создана');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось создать задачу');
    } finally {
      setCreating(false);
    }
  }

  async function toggleDone(task: Task) {
    if (!token) return;
    try {
      await api.setTaskStatus(token, task.id, task.status !== 'DONE');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось изменить статус');
    }
  }

  async function handleDelete(task: Task) {
    if (!token) return;
    const ok = await confirm({
      title: 'Удаление задачи',
      message: `Удалить задачу «${task.title}»?`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteTask(token, task.id);
      toast.success('Задача удалена');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить задачу');
    }
  }

  const visible = tasks.filter((t) => showDone || t.status !== 'DONE');
  const openCount = tasks.filter((t) => t.status !== 'DONE').length;
  const overdueCount = tasks.filter(isOverdue).length;

  return (
    <ManagerLayout title="Задачи" breadcrumb="Работа">
      <p style={styles.hint}>
        Задачи себе и другим руководителям. Поставленную вам задачу видно здесь же — и в
        уведомлениях.
      </p>

      <form onSubmit={handleCreate} style={styles.form}>
        <input
          style={{ ...styles.input, flex: 2, minWidth: '220px' }}
          placeholder="Что нужно сделать"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <Select
          width="200px"
          ariaLabel="Исполнитель"
          value={form.assigneeId}
          onChange={(assigneeId) => setForm({ ...form, assigneeId })}
          // Пустое значение означает «себе» — это осмысленный выбор, а не отсутствие его.
          options={[
            { value: '', label: 'Себе' },
            ...people.filter((p) => p.id !== user?.id).map((p) => ({ value: p.id, label: p.fullName })),
          ]}
        />
        <input
          style={{ ...styles.input, maxWidth: '170px' }}
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
        />
        <Button style={{ fontSize: '14px' }} type="submit" disabled={creating || !form.title.trim()}>
          Добавить
        </Button>
      </form>

      <div style={styles.toolbar}>
        <span style={styles.counter}>
          Открытых: <strong>{openCount}</strong>
        </span>
        {overdueCount > 0 && <Badge variant="danger">Просрочено: {overdueCount}</Badge>}
        <label style={styles.toggle}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Показывать выполненные
        </label>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="checklist"
          title={openCount === 0 ? 'Открытых задач нет' : 'Ничего не найдено'}
          hint="Добавьте задачу в форме выше."
        />
      ) : (
        <div style={styles.list}>
          {visible.map((t) => {
            const done = t.status === 'DONE';
            const overdue = isOverdue(t);
            const mine = t.assignee.id === user?.id;
            return (
              <div key={t.id} style={{ ...styles.card, ...(done ? styles.cardDone : null) }}>
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggleDone(t)}
                  style={styles.checkbox}
                  title={done ? 'Вернуть в работу' : 'Отметить выполненной'}
                />
                <div style={styles.body}>
                  <div style={styles.titleRow}>
                    <span style={{ ...styles.title, ...(done ? styles.titleDone : null) }}>{t.title}</span>
                    {overdue && <Badge variant="danger">Просрочена</Badge>}
                    {done && <Badge variant="accent">Выполнена</Badge>}
                  </div>
                  {t.description && <p style={styles.desc}>{t.description}</p>}
                  <div style={styles.meta}>
                    <span style={styles.metaItem}>
                      <Avatar name={t.assignee.fullName} size={20} />
                      {mine ? 'Мне' : t.assignee.fullName}
                    </span>
                    {t.createdBy.id !== t.assignee.id && (
                      <span style={styles.metaItem}>от {t.createdBy.fullName}</span>
                    )}
                    {t.dueDate && (
                      <span style={{ ...styles.metaItem, ...(overdue ? styles.overdueText : null) }}>
                        срок {formatDate(t.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
                {t.createdBy.id === user?.id && (
                  <button style={styles.linkDanger} onClick={() => handleDelete(t)}>
                    Удалить
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ManagerLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0 },
  form: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' },
  input: {
    flex: 1,
    minWidth: '150px',
    padding: '10px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '15px',
  },
  toolbar: { display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' },
  counter: { fontSize: '14px', color: COLORS.mutedText },
  toggle: { display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: COLORS.mutedText, cursor: 'pointer' },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  card: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    padding: '14px 16px',
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
  },
  cardDone: { opacity: 0.65 },
  checkbox: { width: '20px', height: '20px', marginTop: '2px', cursor: 'pointer', flexShrink: 0 },
  body: { flex: 1, minWidth: 0 },
  titleRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  title: { fontSize: '15px', fontWeight: 600, color: COLORS.darkText },
  titleDone: { textDecoration: 'line-through', color: COLORS.mutedText },
  desc: { margin: '6px 0 0', fontSize: '13px', color: COLORS.mutedText, whiteSpace: 'pre-wrap' },
  meta: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px', fontSize: '13px', color: COLORS.mutedText },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
  overdueText: { color: COLORS.error, fontWeight: 600 },
  linkDanger: { border: 'none', background: 'none', color: COLORS.error, cursor: 'pointer', fontSize: '13px' },
};
