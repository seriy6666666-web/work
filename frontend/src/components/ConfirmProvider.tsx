import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { COLORS, RADIUS, SHADOW } from '../theme';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function close(result: boolean) {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div style={styles.overlay} onClick={() => close(false)}>
          <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
            {options.title && <h3 style={styles.title}>{options.title}</h3>}
            <p style={styles.message}>{options.message}</p>
            <div style={styles.actions}>
              <button style={styles.cancel} onClick={() => close(false)}>
                {options.cancelLabel ?? 'Отмена'}
              </button>
              <button
                style={{ ...styles.confirm, ...(options.danger ? styles.confirmDanger : {}) }}
                onClick={() => close(true)}
                autoFocus
              >
                {options.confirmLabel ?? 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2100,
    background: 'rgba(26,46,59,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  dialog: {
    background: COLORS.white,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.raised,
    padding: '24px',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '17px',
    color: COLORS.darkText,
  },
  message: {
    margin: '0 0 20px',
    fontSize: '14px',
    color: COLORS.darkText,
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  },
  cancel: {
    padding: '9px 18px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    color: COLORS.darkText,
    fontSize: '14px',
    cursor: 'pointer',
  },
  confirm: {
    padding: '9px 18px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmDanger: {
    background: COLORS.error,
  },
};
