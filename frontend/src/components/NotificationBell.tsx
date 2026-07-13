import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, type AppNotification } from '../api/client';
import { useNotificationUpdates } from '../realtime';
import { Icon } from './Icon';
import { COLORS, RADIUS, SHADOW } from '../theme';

export function NotificationBell() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [list, count] = await Promise.all([api.getNotifications(token), api.getUnreadCount(token)]);
      setItems(list);
      setUnread(count.count);
    } catch {
      /* ignore transient errors */
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useNotificationUpdates(user?.id, refresh);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  async function handleItemClick(n: AppNotification) {
    if (!token) return;
    if (!n.read) {
      await api.markNotificationRead(token, n.id);
      await refresh();
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  async function handleReadAll() {
    if (!token) return;
    await api.markAllNotificationsRead(token);
    await refresh();
  }

  return (
    <div ref={wrapRef} style={styles.wrap}>
      <button style={styles.bellButton} onClick={() => setOpen((v) => !v)} title="Уведомления" aria-label="Уведомления">
        <Icon name="bell" size={18} />
        {unread > 0 && <span style={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <span style={styles.panelTitle}>Уведомления</span>
            {unread > 0 && (
              <button style={styles.readAll} onClick={handleReadAll}>
                Прочитать все
              </button>
            )}
          </div>
          <div style={styles.list}>
            {items.length === 0 && <p style={styles.empty}>Уведомлений нет</p>}
            {items.map((n) => (
              <button
                key={n.id}
                style={{ ...styles.item, ...(n.read ? {} : styles.itemUnread) }}
                onClick={() => handleItemClick(n)}
              >
                {!n.read && <span style={styles.dot} />}
                <span style={styles.itemBody}>
                  <span style={styles.itemMessage}>{n.message}</span>
                  <span style={styles.itemTime}>{new Date(n.createdAt).toLocaleString('ru-RU')}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative',
  },
  bellButton: {
    position: 'relative',
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    color: COLORS.mutedText,
    cursor: 'pointer',
    padding: '8px',
    borderRadius: RADIUS.sm,
    display: 'flex',
  },
  badge: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    minWidth: '18px',
    height: '18px',
    padding: '0 4px',
    borderRadius: RADIUS.pill,
    background: COLORS.error,
    color: '#fff',
    fontSize: '11px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '340px',
    maxWidth: '90vw',
    background: COLORS.white,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.raised,
    border: `1px solid ${COLORS.lightGreenBg}`,
    zIndex: 60,
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderBottom: `1px solid ${COLORS.lightGreenBg}`,
  },
  panelTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: COLORS.darkText,
  },
  readAll: {
    border: 'none',
    background: 'transparent',
    color: COLORS.accentDark,
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
  },
  list: {
    maxHeight: '360px',
    overflowY: 'auto',
  },
  empty: {
    margin: 0,
    padding: '24px',
    textAlign: 'center',
    color: COLORS.mutedText,
    fontSize: '14px',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    width: '100%',
    textAlign: 'left',
    border: 'none',
    borderBottom: `1px solid ${COLORS.lightGreenBg}`,
    background: 'transparent',
    cursor: 'pointer',
    padding: '12px 14px',
  },
  itemUnread: {
    background: COLORS.lightGreenBg,
  },
  dot: {
    marginTop: '5px',
    width: '8px',
    height: '8px',
    borderRadius: RADIUS.pill,
    background: COLORS.accent,
    flexShrink: 0,
  },
  itemBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    minWidth: 0,
  },
  itemMessage: {
    fontSize: '13px',
    color: COLORS.darkText,
  },
  itemTime: {
    fontSize: '11px',
    color: COLORS.mutedText,
  },
};
