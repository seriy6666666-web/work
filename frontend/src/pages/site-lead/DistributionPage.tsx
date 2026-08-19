import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
  api,
  ApiError,
  type Assignment,
  type CompetencyMatrix,
  type DistributionOperation,
  type DistributionSummary,
  type DowntimeReasonCode,
} from '../../api/client';
import { DOWNTIME_REASON_CODES, DOWNTIME_REASON_LABELS, DOWNTIME_REASON_ZONE } from '../../constants/downtimeReasons';
import { SiteLeadLayout } from './SiteLeadLayout';
import { StatCard } from '../../components/StatCard';
import { AlertBanner } from '../../components/AlertBanner';
import { Badge } from '../../components/Badge';
import { ProgressBar } from '../../components/ProgressBar';
import { Avatar } from '../../components/Avatar';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonCards } from '../../components/Skeleton';
import { SearchSelect } from '../../components/SearchSelect';
import { Select } from '../../components/Select';
import { useDistributionUpdates } from '../../realtime';
import { useIsMobile } from '../../responsive';
import { COLORS, RADIUS, SHADOW } from '../../theme';

const UNDERPERFORMING_THRESHOLD = 0.7;

/**
 * Дни считаем строками, а не через местное время.
 *
 * `new Date('2026-08-18T00:00:00')` — это местная полночь, а `toISOString()`
 * переводит её обратно в UTC. На UTC+3 стрелка «вперёд» не двигала день вовсе,
 * а «назад» перепрыгивала через два: прибавленные сутки съедал часовой пояс.
 *
 * Здесь всё в UTC от начала и до конца, поэтому арифметика точная. А «сегодня»
 * берём по местному календарю: у ночной смены в час ночи UTC ещё вчерашний день,
 * и доска открывалась бы на вчера.
 */
function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** «сегодня», «завтра», «вчера» — иначе дату приходится сверять с календарём. */
function dayLabel(iso: string): string {
  const diff = Math.round(
    (new Date(`${iso}T00:00:00Z`).getTime() - new Date(`${todayIso()}T00:00:00Z`).getTime()) / 86400000,
  );
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === -1) return 'вчера';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function DistributionPage() {
  const { token, user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [operations, setOperations] = useState<DistributionOperation[]>([]);
  const [matrix, setMatrix] = useState<CompetencyMatrix | null>(null);
  const [summary, setSummary] = useState<DistributionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignForms, setAssignForms] = useState<Record<string, { userId: string; quantity: string }>>(
    {},
  );
  const [reasonCorrections, setReasonCorrections] = useState<Record<string, DowntimeReasonCode>>({});
  // По операциям, где начальник участка раскрыл сотрудников без нужного навыка.
  const [showUnskilled, setShowUnskilled] = useState<Record<string, boolean>>({});

  /**
   * День доски. Начальник участка расставляет людей и на завтра, поэтому день
   * выбирается, а не берётся всегда сегодняшний. Назначения показываются за
   * выбранный день: раньше даты не было вовсе и вчерашние висели вперемешку с
   * сегодняшними.
   */
  const [date, setDate] = useState(todayIso);

  /**
   * Свёрнутые заказы. Держим в localStorage, а не в памяти: доска сама
   * обновляется при каждой отметке рабочего, и без этого группы распахивались бы
   * по десять раз за смену.
   */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('belmy_collapsed_orders') ?? '{}');
    } catch {
      return {};
    }
  });

  function toggleOrder(orderId: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [orderId]: !prev[orderId] };
      localStorage.setItem('belmy_collapsed_orders', JSON.stringify(next));
      return next;
    });
  }
  const operationsRef = useRef<HTMLDivElement>(null);

  async function refresh(showLoader = true) {
    if (!token) return;
    if (showLoader) setLoading(true);
    try {
      const [ops, matrixData, summaryData] = await Promise.all([
        api.listDistributionOperations(token, date),
        api.getCompetencyMatrix(token),
        api.getDistributionSummary(token),
      ]);
      setOperations(ops);
      setMatrix(matrixData);
      setSummary(summaryData);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить операции участка');
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, date]);

  // Live updates: when a worker marks a task done (or the board changes),
  // silently refresh without a loading flash or a toast (avoids echoing the
  // site lead's own actions back as redundant notifications).
  const { connected: liveConnected } = useDistributionUpdates(user?.siteId, () => refresh(false));

  /**
   * На телефоне колонки идут друг под другом, а не рядом.
   *
   * Раньше раскладка была жёстко в две колонки: у панели состава смены минимум
   * 260 точек, поэтому на экране 375 точек карточке операции оставалось 60 —
   * название рассыпалось в столбик по букве, а панель наезжала на список.
   * Горизонтальной прокрутки при этом не появлялось, то есть по формальным
   * признакам всё было в порядке, и заметно это только глазами.
   *
   * Порядок важен: сначала операции — ради них экран и открывают.
   */
  const isMobile = useIsMobile();

  /**
   * Кандидаты на операцию, разделённые по владению навыком. Раньше список был общий:
   * владеющие шли с префиксом «✓», остальные с подписью «нет навыка» — одно и то же
   * помечалось дважды, а выбрать неподходящего человека было так же легко, как нужного.
   * Теперь по умолчанию видны только владеющие навыком, остальные — по ссылке.
   *
   * `skillId === null` — операция не требует квалификации, её умеют все. Делить
   * людей в этом случае не на что: все идут одним списком как подходящие, иначе
   * начальник участка искал бы «владеющих» там, где владеть нечем.
   */
  function candidatesFor(skillId: string | null) {
    if (!matrix) return { skilled: [], unskilled: [] };
    const available = matrix.users
      .filter((u) => !u.isAbsentToday)
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru'));
    if (skillId === null) return { skilled: available, unskilled: [] };

    const competentIds = new Set(
      matrix.competencies.filter((c) => c.skillId === skillId).map((c) => c.userId),
    );
    return {
      skilled: available.filter((u) => competentIds.has(u.id)),
      unskilled: available.filter((u) => !competentIds.has(u.id)),
    };
  }

  async function handleAssign(e: FormEvent, operationId: string) {
    e.preventDefault();
    if (!token) return;
    const form = assignForms[operationId];
    if (!form?.userId) return;
    try {
      await api.createAssignment(token, {
        operationId,
        userId: form.userId,
        assignedQuantity: form.quantity ? Number(form.quantity) : undefined,
        date,
      });
      setAssignForms((prev) => ({ ...prev, [operationId]: { userId: '', quantity: '' } }));
      toast.success('Сотрудник назначен');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось назначить операцию');
    }
  }

  /** Начальник участка тоже встаёт на операции — ставим его без поиска в списке. */
  async function handleAssignSelf(operationId: string) {
    if (!token || !user?.id) return;
    const form = assignForms[operationId];
    try {
      await api.createAssignment(token, {
        operationId,
        userId: user.id,
        assignedQuantity: form?.quantity ? Number(form.quantity) : undefined,
        date,
      });
      setAssignForms((prev) => ({ ...prev, [operationId]: { userId: '', quantity: '' } }));
      toast.success('Операция назначена вам');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось назначить операцию');
    }
  }

  /**
   * Перенести остаток задания. Человека сняли посреди смены или он не успел —
   * сделанное остаётся за ним, остаток уходит на завтра или на другого.
   *
   * По умолчанию предлагаем завтра и того же человека: это самый частый случай,
   * а начальнику участка в цеху важнее два нажатия, чем полная форма.
   */
  async function handleCarryOver(a: Assignment) {
    if (!token) return;
    const produced = (a.completionRecords?.[0]?.doneQuantity ?? 0) + (a.completionRecords?.[0]?.defectQuantity ?? 0);
    const assigned = a.assignedQuantity ?? 0;
    const ok = await confirm({
      title: 'Перенести остаток',
      message:
        `«${a.user.fullName}»: назначено ${assigned}, изготовлено ${produced}. ` +
        `Перенести остаток ${Math.max(0, assigned - produced)} шт на завтра тем же человеком? ` +
        'Сделанное останется за ним, а невыполнение не испортит его показатели — ' +
        'причина «переведён на другую работу» проставится сама.',
      confirmLabel: 'Перенести',
    });
    if (!ok) return;
    try {
      const res = await api.carryOverAssignment(token, a.id, { date: shiftDay(date, 1) });
      toast.success(`Перенесено ${res.remaining} шт на завтра`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось перенести остаток');
    }
  }

  async function handleRemoveAssignment(assignmentId: string) {
    if (!token) return;
    const ok = await confirm({
      title: 'Снять назначение',
      message: 'Снять назначение с сотрудника?',
      confirmLabel: 'Снять',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteAssignment(token, assignmentId);
      toast.success('Назначение снято');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось снять назначение');
    }
  }

  async function handleConfirmReason(completionRecordId: string, reasonCode: DowntimeReasonCode) {
    if (!token) return;
    try {
      await api.confirmReason(token, completionRecordId, { reasonCode });
      toast.success('Причина подтверждена');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось подтвердить причину');
    }
  }

  if (loading) {
    return (
      <SiteLeadLayout title="Распределение операций" breadcrumb="Начальник участка">
        <SkeletonCards count={4} />
      </SiteLeadLayout>
    );
  }

  const noExecutorOp = operations.find((op) => !op.hasCompetentWorker);
  const underperformer = summary?.roster.find(
    (r) => r.loadPercent !== null && r.loadPercent < UNDERPERFORMING_THRESHOLD,
  );
  const alertText = noExecutorOp
    ? `Нет компетентного исполнителя на «${noExecutorOp.operationType.name}» (заказ «${noExecutorOp.order.name}»)`
    : underperformer
      ? `${underperformer.fullName} отстаёт — ${Math.round(underperformer.loadPercent! * 100)}% от нормы`
      : null;

  /**
   * Операции по заказам. Плоским списком их было 37 на одном экране, и он будет
   * расти с каждым запущенным заказом — искать в нём нужную операцию нельзя.
   *
   * Порядок заказов сохраняем тот же, в котором пришли операции: сервер уже
   * отсортировал их по приоритету и сроку.
   */
  const byOrder: { orderId: string; orderName: string; ops: DistributionOperation[] }[] = [];
  for (const op of operations) {
    const found = byOrder.find((g) => g.orderId === op.order.id);
    if (found) found.ops.push(op);
    else byOrder.push({ orderId: op.order.id, orderName: op.order.name, ops: [op] });
  }

  const present = summary?.roster.filter((r) => !r.absent) ?? [];
  const absent = summary?.roster.filter((r) => r.absent) ?? [];

  return (
    <SiteLeadLayout
      title="Распределение операций"
      breadcrumb={summary ? `Участок «${summary.siteName}» · Распределение` : 'Начальник участка'}
    >
      {/*
        Доска обновляется сама, и именно поэтому молчание опаснее ошибки: без связи
        она выглядит точно так же, как рабочая, только цифры на ней — на момент
        открытия страницы. Начальник участка распределял бы людей по вчерашней
        картине и не понял бы, почему она не сходится.
      */}
      {!liveConnected && (
        <div style={styles.offlineBanner} role="status">
          Нет связи с сервером — данные могли устареть. Обновление возобновится само,
          как только связь вернётся.
        </div>
      )}

      {/*
        День доски. Начальник участка расставляет людей вперёд, поэтому день
        выбирается стрелками, а не берётся всегда сегодняшний. Отдельная кнопка
        «Сегодня» — чтобы вернуться одним нажатием, а не отсчитывать назад.
      */}
      <div style={styles.dayBar}>
        <button style={styles.dayArrow} onClick={() => setDate(shiftDay(date, -1))} aria-label="Предыдущий день">
          ←
        </button>
        <input
          style={styles.dayInput}
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          aria-label="День распределения"
        />
        <button style={styles.dayArrow} onClick={() => setDate(shiftDay(date, 1))} aria-label="Следующий день">
          →
        </button>
        <span style={styles.dayLabel}>{dayLabel(date)}</span>
        {date !== todayIso() && (
          <button style={styles.todayButton} onClick={() => setDate(todayIso())}>
            Сегодня
          </button>
        )}
      </div>

      <div style={styles.statsRow}>
        <StatCard
          label="Выполнение плана"
          ring={summary?.completionRate ?? 0}
          value={`${summary?.planDone ?? 0} / ${summary?.planTotal ?? 0} шт`}
          hint="по участку за смену"
        />
        <StatCard
          label="Операций в работе"
          value={`${summary?.operationsInWork ?? 0} / ${summary?.operationsTotal ?? 0}`}
        />
        <StatCard
          label="На смене"
          value={`${present.filter((r) => r.checkedIn).length} чел.`}
          hint={`${absent.length} отсутствуют · ${present.filter((r) => r.invited).length} приглашено`}
        />
        <StatCard
          label="Риск отставания"
          value={summary?.atRiskCount ?? 0}
          hint="заказы под риском срыва срока"
          alert
        />
      </div>

      {alertText && (
        <div style={{ marginBottom: '20px' }}>
          <AlertBanner
            text={alertText}
            actionLabel="Разобрать"
            onAction={() => operationsRef.current?.scrollIntoView({ behavior: 'smooth' })}
          />
        </div>
      )}

      <div style={{ ...styles.columns, ...(isMobile ? styles.columnsStacked : {}) }}>
        <div style={styles.leftColumn} ref={operationsRef}>
          <h3 style={styles.sectionTitle}>Операции участка</h3>

          {operations.length === 0 && <p style={styles.muted}>На вашем участке пока нет операций.</p>}

          {byOrder.map((group) => {
            const uncovered = group.ops.filter((o) => o.assignments.length === 0).length;
            /**
             * Заказ с непокрытыми операциями не даём спрятать «молча»: свернуть
             * можно, но в заголовке остаётся счётчик. Иначе, свернув всё, легко
             * не заметить, что по заказу вообще никого не поставили.
             */
            const isCollapsed = Boolean(collapsed[group.orderId]);
            const doneAll = group.ops.reduce((sum, o) => sum + o.doneAllTime, 0);
            const totalAll = group.ops.reduce((sum, o) => sum + o.quantity, 0);
            return (
              <div key={group.orderId} style={styles.orderGroup}>
                <button style={styles.orderHeader} onClick={() => toggleOrder(group.orderId)}>
                  <span style={styles.orderCaret}>{isCollapsed ? '▸' : '▾'}</span>
                  <strong style={styles.orderName}>{group.orderName}</strong>
                  <span style={styles.orderSummary}>
                    {group.ops.length} оп. · сделано {doneAll} из {totalAll}
                  </span>
                  {uncovered > 0 && (
                    <span style={styles.uncovered}>без исполнителя: {uncovered}</span>
                  )}
                </button>

                {!isCollapsed && group.ops.map((op) => {
            const assignedTotal = op.assignments.reduce((sum, a) => sum + (a.assignedQuantity ?? op.quantity), 0);
            const form = assignForms[op.id] ?? { userId: '', quantity: '' };
            return (
              <div key={op.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <strong>{op.operationType.name}</strong>
                    <span style={styles.muted}> — заказ «{op.order.name}»</span>
                    {/*
                      Требуемая квалификация — отдельной строкой, а не вместо названия.
                      Раньше операция называлась именем навыка, и «что делаем» было
                      неотличимо от «что человек умеет».
                    */}
                    <div style={styles.requirement}>
                      {op.operationType.skill
                        ? `Требуется навык: ${op.operationType.skill.name}`
                        : 'Особый навык не требуется'}
                    </div>
                    {/*
                      Три числа, которые нужны, чтобы распределить смену: сколько
                      надо за день, сколько уже закрыто сегодня и сколько осталось
                      по заказу. Раньше было только «всего по заказу», и понять,
                      что делать сегодня, было не по чему.
                    */}
                    <div style={styles.dayPlan}>
                      {op.dailyQuantity !== null && (
                        <span>
                          План на смену: <strong>{op.dailyQuantity}</strong> шт ·{' '}
                        </span>
                      )}
                      <span>
                        сделано за день: <strong>{op.totalDoneQuantity}</strong>
                      </span>
                      <span style={styles.muted}>
                        {' '}
                        · всего по заказу {op.doneAllTime} из {op.quantity}, осталось{' '}
                        {Math.max(0, op.quantity - op.doneAllTime)}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {op.order.priority >= 5 && <Badge variant="priority-high">Высокий приоритет</Badge>}
                    {op.order.priority >= 1 && op.order.priority < 5 && (
                      <Badge variant="priority-medium">Средний приоритет</Badge>
                    )}
                    {op.secondarySite && <Badge variant="shared">Разделяется с «{op.secondarySite.name}»</Badge>}
                    {!op.hasCompetentWorker && <Badge variant="danger">Нет исполнителя</Badge>}
                  </div>
                </div>

                <div style={{ margin: '10px 0' }}>
                  <ProgressBar done={op.totalDoneQuantity} total={op.quantity} />
                </div>

                <p style={styles.muted}>
                  Назначено: {assignedTotal} · Срок заказа: {new Date(op.order.dueDate).toLocaleDateString('ru-RU')}
                </p>

                {op.assignments.length > 0 && (
                  <div style={styles.executorList}>
                    {op.assignments.map((a) => {
                      const record = a.completionRecords?.[0];
                      const correctionValue = record?.reasonCode
                        ? (reasonCorrections[record.id] ?? record.reasonCode)
                        : reasonCorrections[record?.id ?? ''];
                      return (
                        <div key={a.id} style={styles.executorRow}>
                          <Avatar name={a.user.fullName} size={26} />
                          <div style={{ flex: 1 }}>
                            <div style={styles.executorName}>
                              {a.user.fullName}
                              <span style={styles.muted}>
                                {' '}
                                — {a.assignedQuantity ?? `вся операция (${op.quantity})`}
                              </span>
                            </div>
                            {record && (
                              <div style={styles.reasonBlock}>
                                <span>{record.doneQuantity ?? 0} шт выполнено</span>
                                {record.reasonCode && (
                                  <>
                                    {' · '}
                                    {DOWNTIME_REASON_LABELS[record.reasonCode]} (
                                    {DOWNTIME_REASON_ZONE[record.reasonCode]})
                                    {record.reasonComment && <span> — {record.reasonComment}</span>}
                                    {record.reasonConfirmed ? (
                                      <span style={{ color: COLORS.accentDark, fontWeight: 600 }}> · Подтверждено</span>
                                    ) : (
                                      <span style={styles.reasonForm}>
                                        <Select
                                          width="220px"
                                          ariaLabel="Причина простоя"
                                          value={correctionValue ?? record.reasonCode}
                                          onChange={(code) =>
                                            setReasonCorrections((prev) => ({
                                              ...prev,
                                              [record.id]: code as DowntimeReasonCode,
                                            }))
                                          }
                                          options={DOWNTIME_REASON_CODES.map((code) => ({
                                            value: code,
                                            label: DOWNTIME_REASON_LABELS[code],
                                          }))}
                                        />
                                        <button
                                          style={styles.linkButton}
                                          onClick={() =>
                                            handleConfirmReason(record.id, correctionValue ?? record.reasonCode!)
                                          }
                                        >
                                          Подтвердить
                                        </button>
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          <button style={styles.linkButton} onClick={() => handleCarryOver(a)}>
                            Перенести остаток
                          </button>
                          <button style={styles.linkButtonDanger} onClick={() => handleRemoveAssignment(a.id)}>
                            Снять
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <form onSubmit={(e) => handleAssign(e, op.id)} style={styles.assignForm}>
                  <SearchSelect
                    width="240px"
                    value={form.userId}
                    onChange={(userId) =>
                      setAssignForms((prev) => ({ ...prev, [op.id]: { ...form, userId } }))
                    }
                    options={(() => {
                      const { skilled, unskilled } = candidatesFor(op.operationType.skill?.id ?? null);
                      const list = showUnskilled[op.id] ? [...skilled, ...unskilled] : skilled;
                      return list.map((u) => ({ value: u.id, label: u.fullName }));
                    })()}
                    placeholder="Назначить сотрудника"
                  />
                  <input
                    style={styles.input}
                    type="number"
                    min={1}
                    placeholder="Кол-во (по умолчанию — вся операция)"
                    value={form.quantity}
                    onChange={(e) =>
                      setAssignForms((prev) => ({ ...prev, [op.id]: { ...form, quantity: e.target.value } }))
                    }
                  />
                  <button style={styles.button} type="submit">
                    Назначить
                  </button>
                  <button
                    style={styles.buttonSelf}
                    type="button"
                    onClick={() => handleAssignSelf(op.id)}
                    title="Встать на эту операцию самому"
                  >
                    Себе
                  </button>
                </form>

                {(() => {
                  const { skilled, unskilled } = candidatesFor(op.operationType.skill?.id ?? null);
                  if (unskilled.length === 0) return null;
                  const shown = showUnskilled[op.id];
                  return (
                    <div style={styles.unskilledRow}>
                      {skilled.length === 0 && !shown && (
                        <span style={styles.unskilledWarn}>
                          Никто на участке не владеет этим навыком.
                        </span>
                      )}
                      <button
                        type="button"
                        style={styles.unskilledToggle}
                        onClick={() =>
                          setShowUnskilled((prev) => ({ ...prev, [op.id]: !prev[op.id] }))
                        }
                      >
                        {shown ? 'Скрыть без навыка' : `Показать без навыка (${unskilled.length})`}
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
                })}
              </div>
            );
          })}
        </div>

        <div style={styles.rightColumn}>
          <h3 style={styles.sectionTitle}>Сотрудники на смене</h3>
          {present.map((r) => (
            <div key={r.userId} style={styles.staffRow}>
              <Avatar name={r.fullName} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.executorName}>{r.fullName}</div>
                <div style={styles.muted}>
                  {r.checkedIn ? 'На смене' : 'Не отмечен'}
                  {r.invited && ' · приглашён'}
                </div>
              </div>
              {r.loadPercent !== null && (
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: r.loadPercent < UNDERPERFORMING_THRESHOLD ? COLORS.error : COLORS.accentDark,
                  }}
                >
                  {Math.round(r.loadPercent * 100)}%
                </span>
              )}
            </div>
          ))}
          {present.length === 0 && <p style={styles.muted}>Нет сотрудников на участке.</p>}

          {absent.length > 0 && (
            <>
              <h4 style={styles.subSectionTitle}>Отсутствуют</h4>
              {absent.map((r) => (
                <div key={r.userId} style={{ ...styles.staffRow, opacity: 0.6 }}>
                  <Avatar name={r.fullName} size={26} />
                  <div style={styles.executorName}>{r.fullName}</div>
                  <Icon name="calendar-x" size={16} />
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </SiteLeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  orderGroup: {
    marginBottom: '18px',
  },
  orderHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px 12px',
    marginBottom: '8px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.lightGreenBg,
    color: COLORS.darkText,
    fontSize: '15px',
    textAlign: 'left',
    cursor: 'pointer',
  },
  orderCaret: {
    color: COLORS.mutedText,
    fontSize: '13px',
  },
  orderName: {
    flexShrink: 0,
  },
  orderSummary: {
    color: COLORS.mutedText,
    fontSize: '13px',
    flex: 1,
  },
  uncovered: {
    color: COLORS.error,
    fontSize: '13px',
    fontWeight: 600,
  },
  dayBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  dayArrow: {
    padding: '8px 14px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    color: COLORS.darkText,
    fontSize: '16px',
    cursor: 'pointer',
  },
  dayInput: {
    padding: '8px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '15px',
  },
  dayLabel: {
    fontSize: '14px',
    color: COLORS.mutedText,
  },
  todayButton: {
    padding: '8px 14px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  dayPlan: {
    marginTop: '4px',
    fontSize: '13px',
    color: COLORS.darkText,
  },
  requirement: {
    marginTop: '4px',
    fontSize: '13px',
    color: COLORS.mutedText,
  },
  offlineBanner: {
    padding: '10px 14px',
    marginBottom: '16px',
    borderRadius: RADIUS.sm,
    background: COLORS.warningBg,
    color: COLORS.warning,
    border: `1px solid ${COLORS.warning}`,
    fontSize: '14px',
    lineHeight: 1.5,
  },
  statsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    marginBottom: '20px',
  },
  columns: {
    display: 'flex',
    gap: '20px',
    alignItems: 'flex-start',
  },
  columnsStacked: {
    flexDirection: 'column',
  },
  leftColumn: {
    flex: 2,
    minWidth: 0,
  },
  rightColumn: {
    flex: 1,
    // В колонку минимум не нужен: он и зажимал список операций до 60 точек.
    minWidth: 0,
    width: '100%',
    background: COLORS.lightGrayBg,
    borderRadius: RADIUS.md,
    padding: '16px',
  },
  sectionTitle: {
    margin: '0 0 12px',
    fontSize: '15px',
    color: COLORS.darkText,
  },
  subSectionTitle: {
    margin: '16px 0 8px',
    fontSize: '12px',
    fontWeight: 700,
    color: COLORS.mutedText,
    textTransform: 'uppercase',
  },
  card: {
    padding: '16px',
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
    marginBottom: '16px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
  },
  muted: {
    color: COLORS.mutedText,
    fontSize: '13px',
  },
  executorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    margin: '10px 0',
  },
  executorRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  executorName: {
    fontSize: '14px',
    fontWeight: 600,
    color: COLORS.darkText,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  reasonBlock: {
    marginTop: '2px',
    fontSize: '13px',
    color: COLORS.mutedText,
  },
  reasonForm: {
    display: 'inline-flex',
    gap: '6px',
    marginLeft: '6px',
    alignItems: 'center',
  },
  smallInput: {
    padding: '4px 8px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    fontSize: '13px',
  },
  linkButton: {
    border: 'none',
    background: 'none',
    color: COLORS.accentDark,
    cursor: 'pointer',
    fontSize: '13px',
  },
  linkButtonDanger: {
    border: 'none',
    background: 'none',
    color: COLORS.error,
    cursor: 'pointer',
    fontSize: '13px',
    alignSelf: 'flex-start',
  },
  assignForm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '10px',
  },
  unskilledRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '6px',
  },
  unskilledWarn: { fontSize: '13px', color: COLORS.warning },
  unskilledToggle: {
    border: 'none',
    background: 'none',
    padding: 0,
    fontSize: '13px',
    fontFamily: 'inherit',
    color: COLORS.mutedText,
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  input: {
    padding: '8px 10px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '14px',
  },
  button: {
    padding: '8px 16px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  buttonSelf: {
    padding: '8px 14px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.accent}`,
    background: COLORS.white,
    color: COLORS.accentDark,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  staffRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
    borderBottom: `1px solid ${COLORS.lightGreenBg}`,
  },
};
