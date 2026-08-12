import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { EmptyState } from '../components/EmptyState';
import { Logo } from '../components/Logo';
import { COLORS, RADIUS } from '../theme';

/**
 * Раньше несуществующего маршрута не было вовсе: любая опечатка в адресе давала
 * пустой белый экран без единого слова — человек не понимал, сломалась система или
 * он не туда попал. Отсюда ведём обратно: вошедшего — на его раздел, остальных — на вход.
 */
export function NotFoundPage() {
  const { user } = useAuth();
  const backTo = user ? '/dashboard' : '/login';
  const backLabel = user ? 'Вернуться в свой раздел' : 'На страницу входа';

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <Logo height={34} />
        <EmptyState
          icon="search"
          title="Страница не найдена"
          hint="Такого адреса в системе нет. Возможно, в ссылке опечатка или раздел переехал."
          action={
            <Link to={backTo} style={styles.button}>
              {backLabel}
            </Link>
          }
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: COLORS.lightGrayBg,
  },
  card: {
    width: '100%',
    maxWidth: '520px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '32px 24px',
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.lg,
  },
  button: {
    display: 'inline-block',
    padding: '10px 20px',
    borderRadius: RADIUS.sm,
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '15px',
    fontWeight: 600,
    textDecoration: 'none',
  },
};
