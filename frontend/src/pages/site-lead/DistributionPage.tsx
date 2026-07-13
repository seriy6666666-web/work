import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
  api,
  ApiError,
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
import { useDistributionUpdates } from '../../realtime';
import { COLORS, RADIUS, SHADOW } from '../../theme';

const UNDERPERFORMING_THRESHOLD = 0.7;

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
  const operationsRef = useRef<HTMLDivElement>(null);

  async function refresh(showLoader = true) {
    if (!token) return;
    if (showLoader) setLoading(true);
    try {
      const [ops, matrixData, summaryData] = await Promise.all([
        api.listDistributionOperations(token),
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
  }, [token]);

  // Live updates: when a worker marks a task done (or the board changes),
  // silently refresh without a loading flash or a toast (avoids echoing the
  // site lead's own actions back as redundant notifications).
  useDistributionUpdates(user?.siteId, () => refresh(false));

  function candidatesFor(skillId: string) {
    if (!matrix) return [];
    const competentIds = new Set(
      matrix.competencies.filter((c) => c.skillId === skillId).map((c) => c.userId),
    );
    return matrix.users
      .filter((u) => !u.isAbsentToday)
      .sort((a, b) => {
        const aCompetent = competentIds.has(a.id);
        const bCompetent = competentIds.has(b.id);
        if (aCompetent !== bCompetent) return aCompetent ? -1 : 1;
        return a.fullName.localeCompare(b.fullName, 'ru');
      })
      .map((u) => ({ ...u, competent: competentIds.has(u.id) }));
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
      });
      setAssignForms((prev) => ({ ...prev, [operationId]: { userId: '', quantity: '' } }));
      toast.success('Сотрудник назначен');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось назначить операцию');
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
    ? `Нет компетентного исполнителя на «${noExecutorOp.skill.name}» (заказ «${noExecutorOp.order.name}»)`
    : underperformer
      ? `${underperformer.fullName} отстаёт — ${Math.round(underperformer.loadPercent! * 100)}% от нормы`
      : null;

  const present = summary?.roster.filter((r) => !r.absent) ?? [];
  const absent = summary?.roster.filter((r) => r.absent) ?? [];

  return (
    <SiteLeadLayout
      title="Распределение операций"
      breadcrumb={summary ? `Участок «${summary.siteName}» · Распределение` : 'Начальник участка'}
    >
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

      <div style={styles.columns}>
        <div style={styles.leftColumn} ref={operationsRef}>
          <h3 style={styles.sectionTitle}>Операции участка</h3>

          {operations.length === 0 && <p style={styles.muted}>На вашем участке пока нет операций.</p>}

          {operations.map((op) => {
            const assignedTotal = op.assignments.reduce((sum, a) => sum + (a.assignedQuantity ?? op.quantity), 0);
            const form = assignForms[op.id] ?? { userId: '', quantity: '' };
            return (
              <div key={op.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <strong>{op.skill.name}</strong>
                    <span style={styles.muted}> — заказ «{op.order.name}»</span>
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
                                        <select
                                          style={styles.smallInput}
                                          value={correctionValue ?? record.reasonCode}
                                          onChange={(e) =>
                                            setReasonCorrections((prev) => ({
                                              ...prev,
                                              [record.id]: e.target.value as DowntimeReasonCode,
                                            }))
                                          }
                                        >
                                          {DOWNTIME_REASON_CODES.map((code) => (
                                            <option key={code} value={code}>
                                              {DOWNTIME_REASON_LABELS[code]}
                                            </option>
                                          ))}
                                        </select>
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
                          <button style={styles.linkButtonDanger} onClick={() => handleRemoveAssignment(a.id)}>
                            Снять
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <form onSubmit={(e) => handleAssign(e, op.id)} style={styles.assignForm}>
                  <select
                    style={styles.input}
                    value={form.userId}
                    onChange={(e) =>
                      setAssignForms((prev) => ({ ...prev, [op.id]: { ...form, userId: e.target.value } }))
                    }
                    required
                  >
                    <option value="">Назначить сотрудника...</option>
                    {candidatesFor(op.skillId).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.competent ? '✓ ' : ''}
                        {u.fullName}
                        {!u.competent ? ' (нет навыка)' : ''}
                      </option>
                    ))}
                  </select>
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
                </form>
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
  leftColumn: {
    flex: 2,
    minWidth: 0,
  },
  rightColumn: {
    flex: 1,
    minWidth: '260px',
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
  staffRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
    borderBottom: `1px solid ${COLORS.lightGreenBg}`,
  },
};
