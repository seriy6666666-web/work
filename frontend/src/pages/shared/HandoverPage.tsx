import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Handover } from '../../api/client';
import { ManagerLayout } from './ManagerLayout';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { SkeletonCards } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { COLORS, RADIUS, SHADOW } from '../../theme';
import { Button } from '../../components/ui';

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('ru-RU')} ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

export function HandoverPage() {
  const { token, user } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState<Handover[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const canSend = user?.role === 'SITE_LEAD';

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      setItems(await api.listHandovers(token));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить журнал передачи дел');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!token || !message.trim()) return;
    setSending(true);
    try {
      await api.createHandover(token, { message: message.trim() });
      setMessage('');
      toast.success('Дела переданы — адресат и начальник производства уведомлены');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось передать дела');
    } finally {
      setSending(false);
    }
  }

  return (
    <ManagerLayout title="Пересменка" breadcrumb="Работа">
      <p style={styles.hint}>
        Передача дел при смене: что важно знать следующей смене. Запись уходит старшему следующей
        смены и дублем начальнику производства.
      </p>

      {canSend && (
        <form onSubmit={handleSend} style={styles.form}>
          <textarea
            style={styles.textarea}
            rows={3}
            placeholder="Что передать: незавершённые операции, проблемы с оборудованием, материалы…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button style={{ fontSize: '14px' }} type="submit" disabled={sending || !message.trim()}>
            {sending ? 'Отправляем...' : 'Передать дела'}
          </Button>
        </form>
      )}

      {loading ? (
        <SkeletonCards count={3} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="swap"
          title="Записей о передаче дел нет"
          hint={canSend ? 'Опишите обстановку и передайте дела.' : 'Записи появятся после пересменки.'}
        />
      ) : (
        <div style={styles.list}>
          {items.map((h) => (
            <div key={h.id} style={styles.card}>
              <div style={styles.head}>
                <div style={styles.nameCell}>
                  <Avatar name={h.fromUser.fullName} size={26} />
                  <strong>{h.fromUser.fullName}</strong>
                  <span style={styles.arrow}>→</span>
                  {h.toUser ? (
                    <span>{h.toUser.fullName}</span>
                  ) : (
                    <Badge variant="muted">адресат не определён</Badge>
                  )}
                </div>
                <span style={styles.time}>
                  {h.site.name} · {when(h.createdAt)}
                </span>
              </div>
              <p style={styles.message}>{h.message}</p>
            </div>
          ))}
        </div>
      )}
    </ManagerLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px', alignItems: 'flex-start' },
  textarea: {
    width: '100%',
    padding: '12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '15px',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  card: {
    padding: '14px 16px',
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  nameCell: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', flexWrap: 'wrap' },
  arrow: { color: COLORS.mutedText },
  time: { fontSize: '13px', color: COLORS.mutedText },
  message: { margin: '10px 0 0', fontSize: '14px', color: COLORS.darkText, whiteSpace: 'pre-wrap' },
};
