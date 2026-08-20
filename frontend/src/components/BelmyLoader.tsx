import { LOADER_SVG } from './belmy-marks';

/**
 * Индикатор загрузки: знак BELMY, по которому идёт волна.
 *
 * Для случаев, когда ждать приходится целиком — вход в систему, тяжёлый отчёт.
 * Списки по-прежнему показывают серые заготовки строк: там человеку полезнее
 * видеть, сколько всего придёт и какой оно формы, чем крутящийся знак.
 *
 * Размер задаётся одной переменной; проверено вплоть до 28 px, где знак ещё
 * читается и годится для строки таблицы.
 */
export function BelmyLoader({ size = 72, label }: { size?: number; label?: string }) {
  return (
    <div style={styles.wrap} role="status" aria-live="polite">
      <div
        className="belmy-loader"
        style={{ ['--belmy-loader-h' as string]: `${size}px` }}
        dangerouslySetInnerHTML={{ __html: LOADER_SVG }}
      />
      {label && <p style={styles.label}>{label}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '32px 0',
  },
  label: {
    margin: 0,
    fontSize: '13px',
    color: 'var(--tx3)',
  },
};
