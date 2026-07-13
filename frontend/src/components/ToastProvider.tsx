import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { COLORS, RADIUS, SHADOW } from '../theme';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = ++counter;
      setToasts((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const success = useCallback((message: string) => toast(message, 'success'), [toast]);
  const error = useCallback((message: string) => toast(message, 'error'), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error }}>
      {children}
      <div style={styles.stack}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{ ...styles.toast, ...KIND_STYLE[t.kind] }}
            onClick={() => remove(t.id)}
          >
            <span style={styles.icon}>{KIND_ICON[t.kind]}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const KIND_ICON: Record<ToastKind, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

const KIND_STYLE: Record<ToastKind, React.CSSProperties> = {
  success: { borderLeft: `4px solid ${COLORS.accent}` },
  error: { borderLeft: `4px solid ${COLORS.error}` },
  info: { borderLeft: `4px solid ${COLORS.info}` },
};

const styles: Record<string, React.CSSProperties> = {
  stack: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxWidth: '360px',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: RADIUS.sm,
    background: COLORS.white,
    color: COLORS.darkText,
    boxShadow: SHADOW.raised,
    fontSize: '14px',
    cursor: 'pointer',
    animation: 'belmy-toast-in 0.2s ease',
  },
  icon: {
    fontWeight: 700,
    fontSize: '15px',
  },
};
