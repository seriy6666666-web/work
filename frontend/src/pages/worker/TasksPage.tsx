import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
  api,
  ApiError,
  type Absence,
  type AbsenceType,
  type DowntimeReasonCode,
  type Handover,
  type MyTask,
  type Shift,
  type ShiftLead,
} from '../../api/client';
import { ABSENCE_TYPES, ABSENCE_TYPE_LABELS } from '../../constants/absenceTypes';
import { DOWNTIME_REASON_CODES, DOWNTIME_REASON_LABELS } from '../../constants/downtimeReasons';
import { NotificationBell } from '../../components/NotificationBell';
import { FeedbackButton } from '../../components/FeedbackButton';
import { ShiftFeedbackPrompt } from '../../components/ShiftFeedbackPrompt';
import { Select } from '../../components/Select';
import { useTableControls, SortSelect, type SortChoice } from '../../components/TableControls';

/**
 * Порядок заданий у рабочего.
 *
 * Список короткий — это то, что человеку дали на смену, — но и в нём порядок
 * бывает нужен: сначала то, что горит по сроку, или сначала неотмеченное, чтобы
 * не искать глазами, о чём ещё не отчитался.
 */
const SORT_CHOICES: SortChoice[] = [
  { key: 'due', dir: 'asc', label: 'сначала срочные' },
  { key: 'pending', dir: 'asc', label: 'сначала неотмеченные' },
  { key: 'name', dir: 'asc', label: 'по названию' },
  { key: 'order', dir: 'asc', label: 'по заказу' },
];

export function TasksPage() {
  const { user, token, logout } = useAuth();
  const [shift, setShift] = useState<Shift | null>(null);
  const [tasks, setTasks] = useState<MyTask[]>([]);

  const controls = useTableControls(tasks, {
    searchText: (t) => `${t.operation.operationType.name} ${t.operation.order.name}`,
    sortAccessors: {
      due: (t) => t.operation.order.dueDate,
      // Неотмеченные впереди: по остальным человек уже отчитался.
      pending: (t) => (t.completionRecord === null ? 0 : 1),
      name: (t) => t.operation.operationType.name,
      order: (t) => t.operation.order.name,
    },
    defaultSortKey: 'due',
    storageKey: 'worker-tasks',
  });
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [defectInputs, setDefectInputs] = useState<Record<string, string>>({});
  const [reasonOpen, setReasonOpen] = useState<Record<string, boolean>>({});
  const [reasonInputs, setReasonInputs] = useState<
    Record<string, { code: DowntimeReasonCode; comment: string }>
  >({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  // Старшим смены часто ставят рабочего — тогда ему нужна пересменка.
  const [myLeads, setMyLeads] = useState<ShiftLead[]>([]);
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [handoverText, setHandoverText] = useState('');
  const [sendingHandover, setSendingHandover] = useState(false);
  const [askAboutShift, setAskAboutShift] = useState(false);

  const [absenceForm, setAbsenceForm] = useState({
    type: 'SICK_LEAVE' as AbsenceType,
    startDate: '',
    endDate: '',
  });
  const [submittingAbsence, setSubmittingAbsence] = useState(false);

  async function handleSendHandover(e: FormEvent) {
    e.preventDefault();
    if (!token || !handoverText.trim()) return;
    setSendingHandover(true);
    try {
      await api.createHandover(token, { message: handoverText.trim() });
      setHandoverText('');
      setHandovers(await api.listHandovers(token));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось передать дела');
    } finally {
      setSendingHandover(false);
    }
  }

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const [shiftData, tasksData, absencesData, leadsData] = await Promise.all([
        api.getTodayShift(token),
        api.listMyTasks(token),
        api.listAbsencesMine(token),
        api.listMyShiftLeads(token).catch(() => [] as ShiftLead[]),
      ]);
      setShift(shiftData);
      setTasks(tasksData);
      setAbsences(absencesData);
      setMyLeads(leadsData);
      if (leadsData.length > 0) {
        setHandovers(await api.listHandovers(token).catch(() => [] as Handover[]));
      }
      setInputs((prev) => {
        const next = { ...prev };
        for (const task of tasksData) {
          if (next[task.id] === undefined) {
            next[task.id] = String(
              task.completionRecord?.doneQuantity ?? task.assignedQuantity ?? task.operation.quantity,
            );
          }
        }
        return next;
      });
      setDefectInputs((prev) => {
        const next = { ...prev };
        for (const task of tasksData) {
          if (next[task.id] === undefined) {
            next[task.id] = String(task.completionRecord?.defectQuantity ?? 0);
          }
        }
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCheckIn() {
    if (!token) return;
    setCheckingIn(true);
    setError(null);
    try {
      setShift(await api.checkIn(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отметить приход');
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleCheckOut() {
    if (!token) return;
    setCheckingIn(true);
    setError(null);
    try {
      setShift(await api.checkOut(token));
      setAskAboutShift(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отметить уход');
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleSubmit(task: MyTask) {
    if (!token) return;
    const value = inputs[task.id];
    if (value === undefined || value === '') return;
    setSubmitting((prev) => ({ ...prev, [task.id]: true }));
    setError(null);
    try {
      const reason = reasonOpen[task.id] ? reasonInputs[task.id] : undefined;
      const updated = await api.submitCompletion(token, task.id, {
        doneQuantity: Number(value),
        defectQuantity: Number(defectInputs[task.id] || 0),
        reasonCode: reason?.code,
        reasonComment: reason?.comment || undefined,
      });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      setReasonOpen((prev) => ({ ...prev, [task.id]: false }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить отметку');
    } finally {
      setSubmitting((prev) => ({ ...prev, [task.id]: false }));
    }
  }

  async function handleSubmitAbsence(e: FormEvent) {
    e.preventDefault();
    if (!token || !user || !absenceForm.startDate || !absenceForm.endDate) return;
    setSubmittingAbsence(true);
    setError(null);
    try {
      await api.createAbsence(token, {
        userId: user.id,
        type: absenceForm.type,
        startDate: absenceForm.startDate,
        endDate: absenceForm.endDate,
      });
      setAbsenceForm({ type: 'SICK_LEAVE', startDate: '', endDate: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отметить отсутствие');
    } finally {
      setSubmittingAbsence(false);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Мои задания</h1>
          <p style={styles.subtitle}>{user?.fullName}</p>
        </div>
        <div style={styles.headerActions}>
          <NotificationBell />
          <button style={styles.logoutButton} onClick={logout}>
            Выйти
          </button>
        </div>
      </header>

      <main style={styles.content}>
        <div style={styles.attendanceCard}>
          {!shift ? (
            <button style={styles.checkInButton} onClick={handleCheckIn} disabled={checkingIn}>
              {checkingIn ? 'Отмечаем...' : 'Отметить приход'}
            </button>
          ) : (
            <>
              <p style={styles.attendanceText}>
                ✓ Приход в {new Date(shift.checkInAt).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {shift.checkOutAt && (
                  <>
                    {' · Уход в '}
                    {new Date(shift.checkOutAt).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </>
                )}
              </p>
              {!shift.checkOutAt && (
                <button style={styles.checkOutButton} onClick={handleCheckOut} disabled={checkingIn}>
                  {checkingIn ? 'Отмечаем...' : 'Отметить уход'}
                </button>
              )}
            </>
          )}
        </div>

        <details style={styles.absenceCard}>
          <summary style={styles.absenceSummary}>Отметить отсутствие</summary>
          <form onSubmit={handleSubmitAbsence} style={styles.absenceForm}>
            <Select
              width="190px"
              ariaLabel="Тип отсутствия"
              value={absenceForm.type}
              onChange={(type) => setAbsenceForm({ ...absenceForm, type: type as AbsenceType })}
              options={ABSENCE_TYPES.map((t) => ({ value: t, label: ABSENCE_TYPE_LABELS[t] }))}
            />
            <input
              style={styles.smallInput}
              type="date"
              value={absenceForm.startDate}
              onChange={(e) => setAbsenceForm({ ...absenceForm, startDate: e.target.value })}
              required
            />
            <input
              style={styles.smallInput}
              type="date"
              value={absenceForm.endDate}
              onChange={(e) => setAbsenceForm({ ...absenceForm, endDate: e.target.value })}
              required
            />
            <button style={styles.smallButton} type="submit" disabled={submittingAbsence}>
              Сохранить
            </button>
          </form>
          {absences.length > 0 && (
            <ul style={styles.absenceList}>
              {absences.map((a) => (
                <li key={a.id}>
                  {ABSENCE_TYPE_LABELS[a.type]}: {new Date(a.startDate).toLocaleDateString('ru-RU')} –{' '}
                  {new Date(a.endDate).toLocaleDateString('ru-RU')}
                </li>
              ))}
            </ul>
          )}
        </details>

        {myLeads.length > 0 && (
          <details style={styles.absenceCard}>
            <summary style={styles.absenceSummary}>
              Пересменка — вы старший смены ({myLeads[0].type === 'NIGHT' ? 'ночная' : 'дневная'},{' '}
              {new Date(myLeads[0].date).toLocaleDateString('ru-RU', { timeZone: 'UTC' })})
            </summary>
            <form onSubmit={handleSendHandover} style={styles.absenceForm}>
              <textarea
                style={{ ...styles.smallInput, width: '100%', minHeight: '70px', fontFamily: 'inherit' }}
                placeholder="Что передать следующей смене: незакрытые операции, оборудование, материалы…"
                value={handoverText}
                onChange={(e) => setHandoverText(e.target.value)}
              />
              <button style={styles.smallButton} type="submit" disabled={sendingHandover || !handoverText.trim()}>
                {sendingHandover ? 'Отправляем...' : 'Передать дела'}
              </button>
            </form>
            {handovers.length > 0 && (
              <ul style={styles.absenceList}>
                {handovers.slice(0, 5).map((h) => (
                  <li key={h.id}>
                    {new Date(h.createdAt).toLocaleDateString('ru-RU')} · {h.fromUser.fullName}: {h.message}
                  </li>
                ))}
              </ul>
            )}
          </details>
        )}

        {askAboutShift && <ShiftFeedbackPrompt onClose={() => setAskAboutShift(false)} />}

        {error && <p style={styles.error}>{error}</p>}

        {loading ? (
          <p style={styles.hint}>Загрузка...</p>
        ) : tasks.length === 0 ? (
          <p style={styles.hint}>На сегодня заданий пока нет.</p>
        ) : (<>
          {/* Порядок нужен, только когда заданий больше одного. */}
          {tasks.length > 1 && (
            <div style={styles.listControls}>
              <SortSelect
                choices={SORT_CHOICES}
                sortKey={controls.sortKey}
                dir={controls.sortDir}
                onSelect={controls.setSort}
              />
            </div>
          )}
          {controls.result.map((task) => {
            const locked = task.completionRecord !== null && !task.canCorrect;
            const isSubmitting = submitting[task.id] ?? false;
            const correctionsLeft = task.completionRecord ? 2 - task.completionRecord.correctionCount : 2;
            const reason = reasonInputs[task.id] ?? { code: 'NO_MATERIAL' as DowntimeReasonCode, comment: '' };
            return (
              <div key={task.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <span style={styles.skillName}>{task.operation.operationType.name}</span>
                  {task.operation.order.priority > 0 && <span style={styles.priorityBadge}>Приоритет</span>}
                </div>
                <p style={styles.orderInfo}>
                  Заказ «{task.operation.order.name}» · Назначено:{' '}
                  {task.assignedQuantity ?? task.operation.quantity}
                </p>

                {locked ? (
                  <p style={styles.lockedText}>
                    Отмечено: {task.completionRecord?.doneQuantity} · Лимит исправлений исчерпан — изменить
                    может только начальник участка
                  </p>
                ) : (
                  <>
                    <div style={styles.form}>
                      <label style={styles.fieldLabel}>
                        Годных, шт
                        <input
                          style={styles.input}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={inputs[task.id] ?? ''}
                          onChange={(e) => setInputs((prev) => ({ ...prev, [task.id]: e.target.value }))}
                        />
                      </label>
                      <label style={styles.fieldLabel}>
                        Брак, шт
                        <input
                          style={styles.defectInput}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={defectInputs[task.id] ?? '0'}
                          onChange={(e) => setDefectInputs((prev) => ({ ...prev, [task.id]: e.target.value }))}
                        />
                      </label>
                      <button
                        style={styles.submitButton}
                        onClick={() => handleSubmit(task)}
                        disabled={isSubmitting}
                      >
                        {task.completionRecord ? 'Исправить' : 'Отметить выполнение'}
                      </button>
                    </div>
                    <button
                      style={styles.linkButton}
                      onClick={() => setReasonOpen((prev) => ({ ...prev, [task.id]: !prev[task.id] }))}
                    >
                      {reasonOpen[task.id] ? '− Убрать причину простоя' : '+ Указать причину простоя'}
                    </button>
                    {reasonOpen[task.id] && (
                      <div style={styles.reasonForm}>
                        <Select
                          width="220px"
                          ariaLabel="Причина простоя"
                          value={reason.code}
                          onChange={(code) =>
                            setReasonInputs((prev) => ({
                              ...prev,
                              [task.id]: { ...reason, code: code as DowntimeReasonCode },
                            }))
                          }
                          options={DOWNTIME_REASON_CODES.map((code) => ({
                            value: code,
                            label: DOWNTIME_REASON_LABELS[code],
                          }))}
                        />
                        <input
                          style={styles.smallInput}
                          placeholder="Комментарий (необязательно)"
                          value={reason.comment}
                          onChange={(e) =>
                            setReasonInputs((prev) => ({ ...prev, [task.id]: { ...reason, comment: e.target.value } }))
                          }
                        />
                      </div>
                    )}
                  </>
                )}
                {task.completionRecord && !locked && (
                  <p style={styles.correctionsHint}>Осталось исправлений: {correctionsLeft}</p>
                )}
              </div>
            );
          })}
        </>)}
      </main>
      <FeedbackButton />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  /** Выбор порядка над списком заданий. */
  listControls: { display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' },
  page: {
    minHeight: '100vh',
    background: '#f4f7f6',
  },
  header: {
    background: '#1a3a4a',
    color: '#fff',
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    margin: 0,
    fontSize: '22px',
  },
  subtitle: {
    margin: '4px 0 0',
    color: '#8fa8b0',
    fontSize: '15px',
  },
  logoutButton: {
    padding: '12px 20px',
    borderRadius: '10px',
    border: '1px solid #4caf82',
    background: 'transparent',
    color: '#4caf82',
    cursor: 'pointer',
    fontSize: '16px',
  },
  content: {
    maxWidth: '720px',
    margin: '0 auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  attendanceCard: {
    background: '#fff',
    borderRadius: '16px',
    padding: '20px',
    textAlign: 'center',
  },
  attendanceText: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#3d9970',
  },
  checkInButton: {
    width: '100%',
    padding: '20px',
    borderRadius: '12px',
    border: 'none',
    background: '#4caf82',
    color: '#fff',
    fontSize: '20px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  // Уход отличается от прихода визуально, чтобы в цеху не нажали случайно.
  checkOutButton: {
    width: '100%',
    marginTop: '14px',
    padding: '18px',
    borderRadius: '12px',
    border: '2px solid #4caf82',
    background: '#fff',
    color: '#3d9970',
    fontSize: '19px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  absenceCard: {
    background: '#fff',
    borderRadius: '16px',
    padding: '16px 20px',
  },
  absenceSummary: {
    cursor: 'pointer',
    fontWeight: 600,
    color: '#1a2e3b',
  },
  absenceForm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '12px',
  },
  absenceList: {
    marginTop: '12px',
    paddingLeft: '20px',
    fontSize: '14px',
    color: '#8fa8b0',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
  },
  skillName: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1a2e3b',
  },
  priorityBadge: {
    background: '#e8f5ee',
    color: '#3d9970',
    borderRadius: '999px',
    padding: '6px 14px',
    fontSize: '13px',
    fontWeight: 700,
  },
  orderInfo: {
    margin: 0,
    color: '#8fa8b0',
    fontSize: '15px',
  },
  form: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginTop: '4px',
  },
  fieldLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '13px',
    color: '#8fa8b0',
    flex: '1 1 120px',
  },
  input: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: '2px solid #e8f5ee',
    background: '#f4f7f6',
    fontSize: '20px',
    textAlign: 'center',
  },
  defectInput: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: '2px solid #fdecea',
    background: '#fff6f5',
    fontSize: '20px',
    textAlign: 'center',
    color: '#c0392b',
  },
  submitButton: {
    flex: '1 1 200px',
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    background: '#4caf82',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  linkButton: {
    alignSelf: 'flex-start',
    border: 'none',
    background: 'none',
    color: '#3d9970',
    cursor: 'pointer',
    fontSize: '14px',
    // Выглядит как ссылка, но нажимают её пальцем в перчатке на терминале в цеху.
    // При padding: 0 высота была равна одной строке — 17px, попасть трудно.
    // Вид не меняется, увеличивается только область нажатия.
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '44px',
    padding: '0 2px',
  },
  reasonForm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  smallInput: {
    flex: '1 1 160px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #e8f5ee',
    background: '#f4f7f6',
    fontSize: '15px',
  },
  smallButton: {
    padding: '10px 16px',
    borderRadius: '10px',
    border: 'none',
    background: '#4caf82',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  correctionsHint: {
    margin: 0,
    fontSize: '13px',
    color: '#8fa8b0',
  },
  lockedText: {
    margin: 0,
    fontSize: '15px',
    color: '#c0392b',
    background: '#f9ecec',
    borderRadius: '10px',
    padding: '12px',
  },
  hint: {
    color: '#8fa8b0',
    fontSize: '16px',
    textAlign: 'center',
  },
  error: {
    color: '#c0392b',
    fontSize: '14px',
    textAlign: 'center',
  },
};
