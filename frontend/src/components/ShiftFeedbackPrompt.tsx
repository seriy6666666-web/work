import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, type FeedbackMood } from '../api/client';
import { COLORS, RADIUS } from '../theme';

const MOODS: { value: FeedbackMood; label: string; face: string }[] = [
  { value: 'GOOD', label: 'Нормально', face: ':)' },
  { value: 'SO_SO', label: 'Были заминки', face: ':|' },
  { value: 'BAD', label: 'Мешало работать', face: ':(' },
];

/**
 * Спрашиваем сразу после ухода: человек только что закончил и помнит, что его
 * тормозило. Не блокирует — уходит по «Пропустить» одним нажатием.
 */
export function ShiftFeedbackPrompt({ onClose }: { onClose: () => void }) {
  const { token } = useAuth();
  const location = useLocation();
  const [mood, setMood] = useState<FeedbackMood | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!token || !mood) return;
    setSending(true);
    try {
      await api.createFeedback(token, {
        type: 'SHIFT',
        mood,
        message: message.trim() || undefined,
        screen: location.pathname,
      });
      setSent(true);
      setTimeout(onClose, 1200);
    } catch {
      onClose();
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div style={styles.card}>
        <p style={styles.thanks}>Спасибо, записали.</p>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <p style={styles.title}>Как прошла смена?</p>
      <div style={styles.moods}>
        {MOODS.map((m) => (
          <button
            key={m.value}
            style={mood === m.value ? styles.moodActive : styles.mood}
            onClick={() => setMood(m.value)}
          >
            <span style={styles.face}>{m.face}</span>
            {m.label}
          </button>
        ))}
      </div>

      {mood && (
        <textarea
          style={styles.textarea}
          rows={2}
          placeholder="Что именно мешало? (необязательно)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      )}

      <div style={styles.actions}>
        <button style={styles.skip} onClick={onClose}>
          Пропустить
        </button>
        <button style={styles.send} onClick={send} disabled={!mood || sending}>
          {sending ? 'Отправляем...' : 'Отправить'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: COLORS.white,
    borderRadius: '16px',
    padding: '16px 20px',
    marginBottom: '16px',
  },
  title: { margin: '0 0 12px', fontSize: '17px', fontWeight: 600, color: COLORS.darkText },
  thanks: { margin: 0, fontSize: '16px', color: COLORS.darkText },
  moods: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  mood: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '15px',
    cursor: 'pointer',
    color: COLORS.darkText,
  },
  moodActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: RADIUS.sm,
    border: `2px solid ${COLORS.accent}`,
    background: COLORS.lightGreenBg,
    fontSize: '15px',
    cursor: 'pointer',
    color: COLORS.darkText,
  },
  face: { fontFamily: 'monospace', fontSize: '16px' },
  textarea: {
    width: '100%',
    marginTop: '12px',
    padding: '12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '15px',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' },
  skip: {
    padding: '10px 18px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: 'none',
    color: COLORS.mutedText,
    fontSize: '15px',
    cursor: 'pointer',
  },
  send: {
    padding: '10px 20px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
