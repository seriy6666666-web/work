import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
  api,
  ApiError,
  type Feedback,
  type FeedbackFilters,
  type FeedbackStatus,
  type FeedbackSummary,
  type Site,
} from '../../api/client';
import { AdminLayout } from './AdminLayout';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/ToastProvider';
import { SkeletonCards } from '../../components/Skeleton';
import { useTableControls, SortSelect, type SortChoice } from '../../components/TableControls';
import { EmptyState } from '../../components/EmptyState';
import { Select } from '../../components/Select';
import { COLORS, RADIUS, SHADOW } from '../../theme';

const TYPE_LABELS: Record<string, string> = {
  PROBLEM: 'Проблема',
  IDEA: 'Идея',
  COMPLAINT: 'Жалоба',
  SHIFT: 'Отклик о смене',
};

const MOOD_LABELS: Record<string, string> = {
  GOOD: 'Нормально',
  SO_SO: 'Были заминки',
  BAD: 'Мешало работать',
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  NEW: 'Новое',
  IN_PROGRESS: 'В работе',
  DONE: 'Сделано',
  REJECTED: 'Отклонено',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Администратор',
  PLANNER: 'Планировщик',
  PRODUCTION_HEAD: 'Начальник производства',
  SITE_LEAD: 'Начальник участка',
  WORKER: 'Сотрудник',
};

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('ru-RU')} ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Порядок обращений. По умолчанию новые сверху — так их и разбирают. Порядок по
 * состоянию нужен, когда надо добрать всё неотвеченное разом.
 */
const SORT_CHOICES: SortChoice[] = [
  { key: 'created', dir: 'desc', label: 'сначала новые' },
  { key: 'created', dir: 'asc', label: 'сначала старые' },
  { key: 'status', dir: 'asc', label: 'сначала необработанные' },
  { key: 'author', dir: 'asc', label: 'по автору' },
];

/** Необработанное впереди: остальное уже разобрано. */
const STATUS_ORDER: Record<string, number> = { NEW: 0, IN_PROGRESS: 1, DONE: 2, REJECTED: 3 };

export function FeedbackPage() {
  const { token } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState<Feedback[]>([]);
  const controls = useTableControls(items, {
    searchText: (f) => `${f.message ?? ''} ${f.author?.fullName ?? ''}`,
    sortAccessors: {
      created: (f) => f.createdAt,
      status: (f) => STATUS_ORDER[f.status] ?? 9,
      // Анонимные уходят в конец: сортировать их по автору не по чему.
      author: (f) => f.author?.fullName ?? null,
    },
    defaultSortKey: 'created',
    defaultSortDir: 'desc',
    storageKey: 'admin-feedback',
  });
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FeedbackFilters>({});
  const [replies, setReplies] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        api.listFeedback(token, filters),
        api.feedbackSummary(token, filters),
      ]);
      setItems(list);
      setSummary(sum);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить обращения');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    api.listSites(token).then(setSites).catch(() => setSites([]));
  }, [token]);

  async function setStatus(item: Feedback, status: FeedbackStatus) {
    if (!token) return;
    try {
      await api.updateFeedback(token, item.id, { status });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось изменить статус');
    }
  }

  async function sendReply(item: Feedback) {
    if (!token) return;
    const reply = (replies[item.id] ?? '').trim();
    if (!reply) return;
    try {
      await api.updateFeedback(token, item.id, { reply, status: 'DONE' });
      setReplies((prev) => ({ ...prev, [item.id]: '' }));
      toast.success(item.anonymous ? 'Ответ сохранён' : 'Ответ отправлен — человек получит уведомление');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось отправить ответ');
    }
  }

  async function handleExport() {
    if (!token) return;
    try {
      const blob = await api.exportFeedback(token, filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedback_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось выгрузить');
    }
  }

  const patch = (next: Partial<FeedbackFilters>) => setFilters((prev) => ({ ...prev, ...next }));

  return (
    <AdminLayout
      title="Обращения"
      breadcrumb="Администрирование"
      headerExtra={
        <button style={styles.exportButton} onClick={handleExport}>
          <Icon name="download" size={16} />
          Выгрузить
        </button>
      }
    >
      <p style={styles.hint}>
        Что пишут сотрудники: проблемы, идеи, жалобы и отклики о смене. Видите это только вы.
        Ответ приходит человеку уведомлением — кроме анонимных, там адресата нет.
      </p>

      {summary && (
        <div style={styles.cards}>
          <Metric label="Всего" value={summary.total} />
          <Metric label="Новых" value={summary.newCount} accent />
          <Metric label="Проблем" value={summary.byType.PROBLEM} />
          <Metric label="Идей" value={summary.byType.IDEA} />
          <Metric label="Жалоб" value={summary.byType.COMPLAINT} />
        </div>
      )}

      {summary && summary.moodByDay.length > 0 && (
        <div style={styles.moodBox}>
          <div style={styles.moodTitle}>Настроение смен по дням</div>
          <div style={styles.moodRows}>
            {summary.moodByDay.map((d) => {
              const total = d.good + d.soSo + d.bad || 1;
              return (
                <div key={d.date} style={styles.moodRow}>
                  <span style={styles.moodDate}>
                    {d.date.split('-').reverse().join('.')}
                  </span>
                  <div style={styles.bar}>
                    <div style={{ ...styles.barPart, background: COLORS.accent, width: `${(d.good / total) * 100}%` }} />
                    <div style={{ ...styles.barPart, background: '#e6b800', width: `${(d.soSo / total) * 100}%` }} />
                    <div style={{ ...styles.barPart, background: COLORS.error, width: `${(d.bad / total) * 100}%` }} />
                  </div>
                  <span style={styles.moodCount}>
                    {d.good} · {d.soSo} · {d.bad}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={styles.filters}>
        {/* Фильтры: пустой вариант — это «не фильтровать», его надо уметь выбрать обратно. */}
        <Select
          width="170px"
          ariaLabel="Тип обращения"
          value={filters.type ?? ''}
          onChange={(type) => patch({ type: type || undefined })}
          options={[
            { value: '', label: 'Любой тип' },
            { value: 'PROBLEM', label: 'Проблемы' },
            { value: 'IDEA', label: 'Идеи' },
            { value: 'COMPLAINT', label: 'Жалобы' },
            { value: 'SHIFT', label: 'Отклики о смене' },
          ]}
        />
        <Select
          width="170px"
          ariaLabel="Статус обращения"
          value={filters.status ?? ''}
          onChange={(status) => patch({ status: status || undefined })}
          options={[
            { value: '', label: 'Любой статус' },
            { value: 'NEW', label: 'Новое' },
            { value: 'IN_PROGRESS', label: 'В работе' },
            { value: 'DONE', label: 'Сделано' },
            { value: 'REJECTED', label: 'Отклонено' },
          ]}
        />
        <Select
          width="170px"
          ariaLabel="Участок"
          value={filters.siteId ?? ''}
          onChange={(siteId) => patch({ siteId: siteId || undefined })}
          options={[
            { value: '', label: 'Все участки' },
            ...sites.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
        <input style={styles.input} type="date" value={filters.from ?? ''} onChange={(e) => patch({ from: e.target.value || undefined })} />
        <input style={styles.input} type="date" value={filters.to ?? ''} onChange={(e) => patch({ to: e.target.value || undefined })} />
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : items.length === 0 ? (
        <EmptyState icon="inbox" title="Обращений нет" hint="Здесь появится то, что напишут сотрудники." />
      ) : (
        <div style={styles.list}>
          <div style={styles.listControls}>
            <SortSelect
              choices={SORT_CHOICES}
              sortKey={controls.sortKey}
              dir={controls.sortDir}
              onSelect={controls.setSort}
            />
          </div>
          {controls.result.map((f) => (
            <div key={f.id} style={styles.card}>
              <div style={styles.cardHead}>
                <div style={styles.who}>
                  {f.anonymous ? (
                    <Badge variant="muted">анонимно</Badge>
                  ) : (
                    <>
                      <Avatar name={f.author?.fullName ?? '?'} size={26} />
                      <strong>{f.author?.fullName ?? 'Сотрудник'}</strong>
                    </>
                  )}
                  <span style={styles.meta}>
                    {ROLE_LABELS[f.authorRole]}
                    {f.site ? ` · ${f.site.name}` : ''}
                  </span>
                </div>
                <span style={styles.meta}>{when(f.createdAt)}</span>
              </div>

              <div style={styles.tags}>
                <Badge variant={f.type === 'IDEA' ? 'accent' : f.type === 'SHIFT' ? 'muted' : 'shared'}>
                  {TYPE_LABELS[f.type]}
                </Badge>
                {f.mood && <Badge variant={f.mood === 'BAD' ? 'danger' : 'muted'}>{MOOD_LABELS[f.mood]}</Badge>}
                {f.screen && <span style={styles.screen}>экран {f.screen}</span>}
                <Badge variant={f.status === 'NEW' ? 'accent' : 'muted'}>{STATUS_LABELS[f.status]}</Badge>
              </div>

              {f.message && <p style={styles.message}>{f.message}</p>}

              {f.reply ? (
                <div style={styles.replyBox}>
                  <span style={styles.replyLabel}>Ваш ответ:</span> {f.reply}
                </div>
              ) : (
                <div style={styles.replyRow}>
                  <input
                    style={{ ...styles.input, flex: 1 }}
                    placeholder="Ответить сотруднику"
                    value={replies[f.id] ?? ''}
                    onChange={(e) => setReplies((prev) => ({ ...prev, [f.id]: e.target.value }))}
                  />
                  <button style={styles.replyButton} onClick={() => sendReply(f)} disabled={!(replies[f.id] ?? '').trim()}>
                    Ответить
                  </button>
                </div>
              )}

              <div style={styles.statusRow}>
                {(['NEW', 'IN_PROGRESS', 'DONE', 'REJECTED'] as FeedbackStatus[]).map((s) => (
                  <button
                    key={s}
                    style={f.status === s ? styles.statusActive : styles.statusButton}
                    onClick={() => setStatus(f, s)}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={{ ...styles.metricValue, ...(accent && value > 0 ? { color: COLORS.accent } : {}) }}>
        {value}
      </strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0 },
  cards: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' },
  metric: {
    minWidth: '110px',
    padding: '12px 16px',
    borderRadius: RADIUS.md,
    background: COLORS.lightGrayBg,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  metricLabel: { fontSize: '13px', color: COLORS.mutedText },
  metricValue: { fontSize: '22px', color: COLORS.darkText },
  moodBox: { marginBottom: '18px' },
  moodTitle: { fontSize: '13px', color: COLORS.mutedText, marginBottom: '8px' },
  moodRows: { display: 'flex', flexDirection: 'column', gap: '6px' },
  moodRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  moodDate: { fontSize: '13px', color: COLORS.mutedText, width: '80px' },
  bar: { flex: 1, display: 'flex', height: '10px', borderRadius: '999px', overflow: 'hidden', background: COLORS.lightGrayBg },
  barPart: { height: '100%' },
  moodCount: { fontSize: '13px', color: COLORS.mutedText, width: '70px', textAlign: 'right' },
  filters: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' },
  input: {
    padding: '9px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '14px',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  card: {
    padding: '14px 16px',
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
  },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  who: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', flexWrap: 'wrap' },
  meta: { fontSize: '13px', color: COLORS.mutedText },
  tags: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', margin: '10px 0' },
  screen: { fontSize: '12px', color: COLORS.mutedText, fontFamily: 'monospace' },
  message: { margin: '4px 0 12px', fontSize: '15px', color: COLORS.darkText, whiteSpace: 'pre-wrap' },
  replyRow: { display: 'flex', gap: '8px', alignItems: 'center' },
  replyButton: {
    padding: '9px 16px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '14px',
    cursor: 'pointer',
  },
  replyBox: { padding: '10px 12px', background: COLORS.lightGrayBg, borderRadius: RADIUS.sm, fontSize: '14px' },
  replyLabel: { color: COLORS.mutedText },
  statusRow: { display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' },
  statusButton: {
    padding: '6px 12px',
    borderRadius: '999px',
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    color: COLORS.mutedText,
    fontSize: '13px',
    cursor: 'pointer',
  },
  statusActive: {
    padding: '6px 12px',
    borderRadius: '999px',
    border: `1px solid ${COLORS.accent}`,
    background: COLORS.lightGreenBg,
    color: COLORS.darkText,
    fontSize: '13px',
    cursor: 'pointer',
  },
  exportButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 16px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    color: COLORS.darkText,
    fontSize: '14px',
    cursor: 'pointer',
  },
};
