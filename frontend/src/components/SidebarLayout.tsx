import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Logo } from './Logo';
import { Avatar } from './Avatar';
import { Icon, type IconName } from './Icon';
import { useThemeMode } from '../theme-mode';
import { COLORS, RADIUS, SHADOW } from '../theme';

export interface SidebarTab {
  path: string;
  label: string;
  icon: IconName;
  badge?: number;
}

const MOBILE_QUERY = '(max-width: 900px)';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
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
  const isMobile = useIsMobile();
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
            <Logo height={26} />
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
                  {tab.badge ? <span style={styles.navBadge}>{tab.badge}</span> : null}
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
        <main style={styles.content}>{children}</main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    background: COLORS.lightGrayBg,
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(26,46,59,0.45)',
    zIndex: 40,
  },
  sidebar: {
    width: '240px',
    flexShrink: 0,
    background: COLORS.white,
    borderRight: `1px solid ${COLORS.lightGreenBg}`,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 16px',
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
    margin: '0 0 8px',
    padding: '0 8px',
    fontSize: '11px',
    fontWeight: 700,
    color: COLORS.mutedText,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
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
    gap: '10px',
    padding: '10px 12px',
    borderRadius: RADIUS.sm,
    textDecoration: 'none',
    color: COLORS.darkText,
    fontSize: '14px',
    fontWeight: 500,
  },
  navItemActive: {
    background: COLORS.lightGreenBg,
    color: COLORS.accentDark,
    fontWeight: 700,
  },
  navLabel: {
    flex: 1,
  },
  navBadge: {
    background: COLORS.accent,
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
    borderRadius: RADIUS.sm,
    background: COLORS.lightGrayBg,
    marginTop: '12px',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    margin: 0,
    fontSize: '13px',
    fontWeight: 700,
    color: COLORS.darkText,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userRole: {
    margin: 0,
    fontSize: '12px',
    color: COLORS.mutedText,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logoutButton: {
    border: 'none',
    background: 'transparent',
    color: COLORS.mutedText,
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
    padding: '28px 32px 20px',
    gap: '16px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    minWidth: 0,
  },
  hamburger: {
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    color: COLORS.darkText,
    cursor: 'pointer',
    padding: '8px',
    borderRadius: RADIUS.sm,
    display: 'flex',
    flexShrink: 0,
  },
  breadcrumb: {
    margin: '0 0 4px',
    fontSize: '13px',
    color: COLORS.mutedText,
  },
  title: {
    margin: 0,
    fontSize: '22px',
    color: COLORS.darkText,
  },
  headerExtra: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
  },
  themeToggle: {
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    color: COLORS.mutedText,
    cursor: 'pointer',
    padding: '8px',
    borderRadius: RADIUS.sm,
    display: 'flex',
  },
  content: {
    margin: '0 16px 24px',
    padding: '20px',
    background: COLORS.white,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
    color: COLORS.darkText,
    flex: 1,
    overflowX: 'auto',
  },
};
