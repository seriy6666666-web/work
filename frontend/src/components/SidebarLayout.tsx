import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Logo } from './Logo';
import { Avatar } from './Avatar';
import { Icon, type IconName } from './Icon';
import { NotificationBell } from './NotificationBell';
import { FeedbackButton } from './FeedbackButton';
import { useThemeMode } from '../theme-mode';
import { useDrawerMenu } from '../responsive';
import { COLORS, RADIUS, SHADOW } from '../theme';

export interface SidebarTab {
  path: string;
  label: string;
  icon: IconName;
  /** Число рядом с пунктом: сколько дел ждёт. Ноль не показываем. */
  badge?: number;
  /** Точка без числа — там, где количество ничего не добавляет. */
  dot?: boolean;
}

export function SidebarLayout({
  roleLabel,
  tabs,
  title,
  breadcrumb,
  headerExtra,
  children,
}: {
  roleLabel: string;
  tabs: SidebarTab[];
  title: string;
  breadcrumb?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isMobile = useDrawerMenu();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [themeMode, toggleTheme] = useThemeMode();

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const showSidebar = !isMobile || drawerOpen;

  return (
    <div style={styles.page}>
      {isMobile && drawerOpen && <div style={styles.backdrop} onClick={() => setDrawerOpen(false)} />}

      {showSidebar && (
        <aside style={{ ...styles.sidebar, ...(isMobile ? styles.sidebarMobile : {}) }}>
          <div style={styles.logoWrap}>
            {/*
              В тёмном меню берём светлую надпись, а не выбеливаем логотип
              фильтром: от фильтра зелёный лист становился серым.
            */}
            <Logo height={34} dark />
          </div>
          <p style={styles.roleLabel}>{roleLabel}</p>

          <nav style={styles.nav}>
            {tabs.map((tab) => {
              const active = location.pathname.startsWith(tab.path);
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}) }}
                >
                  <Icon name={tab.icon} size={18} />
                  <span style={styles.navLabel}>{tab.label}</span>
                  {tab.badge ? (
                    <span style={styles.navBadge}>{tab.badge}</span>
                  ) : tab.dot ? (
                    <span style={styles.navDot} aria-label="есть новое" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div style={styles.userCard}>
            <Avatar name={user?.fullName ?? '?'} size={36} />
            <div style={styles.userInfo}>
              <p style={styles.userName}>{user?.fullName}</p>
              <p style={styles.userRole}>{roleLabel}</p>
            </div>
            <button style={styles.logoutButton} onClick={logout} title="Выйти">
              <Icon name="log-out" size={16} />
            </button>
          </div>
        </aside>
      )}

      <div style={styles.main}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            {isMobile && (
              <button
                style={styles.hamburger}
                onClick={() => setDrawerOpen((v) => !v)}
                title="Меню"
                aria-label="Меню"
              >
                <Icon name={drawerOpen ? 'x' : 'menu'} size={22} />
              </button>
            )}
            <div>
              {breadcrumb && <p style={styles.breadcrumb}>{breadcrumb}</p>}
              <h1 style={styles.title}>{title}</h1>
            </div>
          </div>
          <div style={styles.headerExtra}>
            {headerExtra}
            <NotificationBell />
            <button
              style={styles.themeToggle}
              onClick={toggleTheme}
              title={themeMode === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
              aria-label="Переключить тему"
            >
              <Icon name={themeMode === 'dark' ? 'sun' : 'moon'} size={18} />
            </button>
          </div>
        </header>
        {/*
          Снизу оставляем место под плавающую кнопку «Сообщить»: на телефоне она
          накрывала последнюю кнопку экрана — например «Исправить» у рабочего, —
          и до неё было не дотянуться.
        */}
        <main style={{ ...styles.content, ...(isMobile ? styles.contentMobile : {}) }}>
          {children}
        </main>
      </div>
      <FeedbackButton />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    background: 'var(--page)',
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(26,46,59,0.45)',
    zIndex: 40,
  },
  sidebar: {
    width: '236px',
    flexShrink: 0,
    background: 'var(--nav)',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 14px',
    position: 'sticky',
    top: 0,
    alignSelf: 'flex-start',
    height: '100vh',
  },
  sidebarMobile: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 50,
    height: '100%',
    boxShadow: SHADOW.raised,
  },
  logoWrap: {
    padding: '4px 8px 16px',
  },
  roleLabel: {
    margin: '0 0 10px',
    padding: '0 10px',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--navtx2)',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    // Цель нажатия 40px: по меню попадают и пальцем на планшете.
    minHeight: '40px',
    padding: '10px 12px',
    borderRadius: '12px',
    textDecoration: 'none',
    color: 'var(--navtx)',
    fontSize: '14px',
    fontWeight: 500,
  },
  navItemActive: {
    background: 'var(--navact)',
    color: '#fff',
    fontWeight: 600,
  },
  navLabel: {
    flex: 1,
  },
  navDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: COLORS.error,
    flexShrink: 0,
  },
  navBadge: {
    background: COLORS.error,
    color: COLORS.white,
    fontSize: '11px',
    fontWeight: 700,
    borderRadius: RADIUS.pill,
    padding: '1px 7px',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.06)',
    marginTop: '12px',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    margin: 0,
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--navtx)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userRole: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--navtx2)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logoutButton: {
    border: 'none',
    background: 'transparent',
    color: 'var(--navtx2)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: RADIUS.sm,
    display: 'flex',
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '26px 24px 18px',
    gap: '16px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    minWidth: 0,
  },
  hamburger: {
    border: '1px solid var(--line)',
    background: 'var(--surf)',
    color: 'var(--tx)',
    cursor: 'pointer',
    // 44px — в перчатках по мелкому не попасть.
    minWidth: '44px',
    minHeight: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  breadcrumb: {
    margin: '0 0 4px',
    fontSize: '13px',
    color: 'var(--tx3)',
  },
  title: {
    margin: 0,
    // 28/600 с плотным межбуквенным — из макета: заголовок задаёт весь строй экрана.
    fontSize: '28px',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: 'var(--tx)',
  },
  headerExtra: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
  },
  themeToggle: {
    border: '1px solid var(--line)',
    background: 'var(--surf)',
    color: 'var(--tx2)',
    cursor: 'pointer',
    minWidth: '40px',
    minHeight: '40px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentMobile: {
    paddingBottom: '76px',
  },
  /*
   * Содержимое лежит прямо на фоне страницы, а не в одной общей белой коробке.
   * Коробка склеивала разные по смыслу блоки в одно пятно: панель со списком,
   * форма и подсказка выглядели частями одного целого. Теперь каждый блок сам
   * решает, быть ему панелью или нет.
   */
  content: {
    margin: '0 24px 24px',
    color: 'var(--tx)',
    flex: 1,
    overflowX: 'auto',
  },
};
