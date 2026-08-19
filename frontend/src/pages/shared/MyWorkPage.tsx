import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type MyTask, type Shift } from '../../api/client';
import { ManagerLayout } from './ManagerLayout';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { SkeletonCards } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { ShiftFeedbackPrompt } from '../../components/ShiftFeedbackPrompt';
import { COLORS, RADIUS, SHADOW } from '../../theme';
import { Button, Input } from '../../components/ui';

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Экран «моей работы» для руководителя: он тоже встаёт на операции и отмечает
 * приход/уход. Отличается от экрана рабочего — здесь компактная вёрстка, а не
 * крупные кнопки под планшет в цеху.
 */
export function MyWorkPage() {
  const { token } = useAuth();
  const toast = useToast();

  const [askAboutShift, setAskAboutShift] = useState(false);
  const [shift, setShift] = useState<Shift | null>(null);
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inputs, setInputs] = useState<Record<string, { done: string; defect: string }>>({});

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const [shiftData, tasksData] = await Promise.all([
        api.getTodayShift(token),
        api.listMyTasks(token),
      ]);
      setShift(shiftData);
      setTasks(tasksData);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleAttendance(kind: 'in' | 'out') {
    if (!token) return;
    setBusy(true);
    try {
      setShift(kind === 'in' ? await api.checkIn(token) : await api.checkOut(token));
      if (kind === 'out') setAskAboutShift(true);
      toast.success(kind === 'in' ? 'Приход отмечен' : 'Уход отмечен');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось отметить');
    } finally {
      setBusy(false);
    }
  }

  async function submit(task: MyTask) {
    if (!token) return;
    const form = inputs[task.id] ?? { done: '', defect: '' };
    const doneQuantity = Number(form.done);
    if (!form.done || Number.isNaN(doneQuantity) || doneQuantity < 0) {
      toast.error('Укажите количество годных');
      return;
    }
    try {
      await api.submitCompletion(token, task.id, {
        doneQuantity,
        defectQuantity: form.defect ? Number(form.defect) : 0,
      });
      toast.success('Выполнение записано');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось записать выполнение');
    }
  }

  return (
    <ManagerLayout title="Моя работа" breadcrumb="Работа">
      <p style={styles.hint}>
        Ваши собственные задания на операциях и отметки прихода/ухода — наравне с рабочими.
      </p>

      {askAboutShift && <ShiftFeedbackPrompt onClose={() => setAskAboutShift(false)} />}

      <div style={styles.attendance}>
        {!shift ? (
          <>
            <span style={styles.attText}>Смена не начата</span>
            <Button style={{ padding: '10px 18px', fontSize: '14px' }} disabled={busy} onClick={() => handleAttendance('in')}>
              Отметить приход
            </Button>
          </>
        ) : (
          <>
            <span style={styles.attText}>
              Приход в <strong>{timeOf(shift.checkInAt)}</strong>
              {shift.checkOutAt && (
                <>
                  {' · Уход в '}
                  <strong>{timeOf(shift.checkOutAt)}</strong>
                </>
              )}
            </span>
            {!shift.checkOutAt && (
              <button style={styles.buttonOutline} disabled={busy} onClick={() => handleAttendance('out')}>
                Отметить уход
              </button>
            )}
          </>
        )}
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon="checklist"
          title="Заданий на операциях нет"
          hint="Начальник участка может назначить операцию на вас — она появится здесь."
        />
      ) : (
        <div style={styles.list}>
          {tasks.map((t) => {
            const form = inputs[t.id] ?? { done: '', defect: '' };
            const rec = t.completionRecord;
            return (
              <div key={t.id} style={styles.card}>
                <div style={styles.cardHead}>
                  <strong>{t.operation.operationType.name}</strong>
                  {rec && <Badge variant="accent">{rec.doneQuantity ?? 0} шт записано</Badge>}
                </div>
                <p style={styles.sub}>
                  Заказ «{t.operation.order.name}» · Назначено: {t.assignedQuantity ?? t.operation.quantity}
                </p>
                <div style={styles.inputs}>
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Годных, шт</span>
                    <Input style={{ width: '110px', padding: '9px 12px' }}
                      type="number"
                      min="0"
                      value={form.done}
                      onChange={(e) => setInputs((p) => ({ ...p, [t.id]: { ...form, done: e.target.value } }))}
                    />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Брак, шт</span>
                    <Input style={{ width: '110px', padding: '9px 12px' }}
                      type="number"
                      min="0"
                      value={form.defect}
                      onChange={(e) => setInputs((p) => ({ ...p, [t.id]: { ...form, defect: e.target.value } }))}
                    />
                  </label>
                  <Button style={{ padding: '10px 18px', fontSize: '14px' }} disabled={!t.canCorrect} onClick={() => submit(t)}>
                    {rec ? 'Исправить' : 'Записать'}
                  </Button>
                </div>
                {!t.canCorrect && <p style={styles.limit}>Лимит исправлений исчерпан</p>}
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
  attendance: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
    padding: '14px 18px',
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
    marginBottom: '18px',
  },
  attText: { fontSize: '15px', color: COLORS.darkText },
  buttonOutline: {
    padding: '10px 18px',
    borderRadius: RADIUS.sm,
    border: `2px solid ${COLORS.accent}`,
    background: COLORS.white,
    color: COLORS.accentDark,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  card: {
    padding: '16px',
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
  },
  cardHead: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  sub: { margin: '6px 0 12px', fontSize: '13px', color: COLORS.mutedText },
  inputs: { display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  fieldLabel: { fontSize: '12px', color: COLORS.mutedText },
  limit: { margin: '10px 0 0', fontSize: '13px', color: COLORS.error },
};
