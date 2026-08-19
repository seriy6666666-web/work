import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, ApiError, type FeedbackType } from '../api/client';
import { useToast } from './ToastProvider';
import { Icon } from './Icon';
import { useDrawerMenu } from '../responsive';
import { COLORS, RADIUS, SHADOW } from '../theme';

const TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'PROBLEM', label: 'Проблема' },
  { value: 'IDEA', label: 'Идея' },
  { value: 'COMPLAINT', label: 'Жалоба' },
];

/**
 * Кнопка «Сообщить» на всех экранах руководителей и админа: человек пишет в момент
 * раздражения, а не вспоминает вечером. Экран подставляем сами — без него
 * «кнопка не работает» невозможно починить.
 */
export function FeedbackButton() {
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  /**
   * На телефоне кнопка сжимается до одного значка: подпись «Сообщить» занимала
   * заметную часть узкого экрана и накрывала содержимое под собой. Название
   * остаётся в aria-label, поэтому для чтения с экрана ничего не теряется.
   */
  const isMobile = useDrawerMenu();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('PROBLEM');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !message.trim()) return;
    setSending(true);
    try {
      await api.createFeedback(token, {
        type,
        message: message.trim(),
        screen: location.pathname,
        anonymous,
      });
      setMessage('');
      setAnonymous(false);
      setOpen(false);
      toast.success('Спасибо — обращение отправлено');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось отправить');
    } finally {
      setSending(false);
    }
  }

  if (!token) return null;

  return (
    <>
      <button
        style={{ ...styles.fab, ...(isMobile ? styles.fabMobile : {}) }}
        onClick={() => setOpen(true)}
        aria-label="Сообщить о проблеме"
      >
        <Icon name="message" size={18} />
        {!isMobile && 'Сообщить'}
      </button>

      {open && (
        <div style={styles.overlay} onClick={() => setOpen(false)}>
          <form style={styles.dialog} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <div style={styles.head}>
              <strong style={styles.title}>Что происходит?</strong>
              <button type="button" style={styles.close} onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            <div style={styles.types}>
              {TYPES.map((t) => (
                <button
                  type="button"
                  key={t.value}
                  style={type === t.value ? styles.typeActive : styles.type}
                  onClick={() => setType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <textarea
              style={styles.textarea}
              rows={4}
              autoFocus
              placeholder="Например: не могу отметить выполнение — кнопка не нажимается"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <label style={styles.anon}>
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
              />
              Анонимно — не сохранять, кто написал
            </label>

            <div style={styles.actions}>
              <span style={styles.hint}>Читает только администратор</span>
              <button style={styles.submit} type="submit" disabled={sending || !message.trim()}>
                {sending ? 'Отправляем...' : 'Отправить'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  fabMobile: {
    padding: '12px',
    right: '16px',
    bottom: '16px',
  },
  fab: {
    position: 'fixed',
    right: '24px',
    bottom: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderRadius: '999px',
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    color: COLORS.darkText,
    fontSize: '14px',
    cursor: 'pointer',
    boxShadow: SHADOW.card,
    zIndex: 40,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20, 30, 35, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 50,
  },
  dialog: {
    width: '100%',
    maxWidth: '440px',
    background: COLORS.white,
    borderRadius: RADIUS.md,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    boxShadow: SHADOW.card,
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: '17px', color: COLORS.darkText },
  close: { border: 'none', background: 'none', fontSize: '16px', cursor: 'pointer', color: COLORS.mutedText },
  types: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  type: {
    padding: '8px 14px',
    borderRadius: '999px',
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    color: COLORS.mutedText,
    fontSize: '14px',
    cursor: 'pointer',
  },
  typeActive: {
    padding: '8px 14px',
    borderRadius: '999px',
    border: `1px solid ${COLORS.accent}`,
    background: COLORS.lightGreenBg,
    color: COLORS.darkText,
    fontSize: '14px',
    cursor: 'pointer',
  },
  textarea: {
    padding: '12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '15px',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  anon: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: COLORS.mutedText },
  actions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' },
  hint: { fontSize: '13px', color: COLORS.mutedText },
  submit: {
    padding: '10px 20px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
