import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';
import { ADMIN_CONSOLE_PATH } from '../../lib/routes';
import { Button } from '../ui/Button';
import { Container } from '../ui/Container';
import { AdminModeSwitch } from './AdminModeSwitch';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';

/** Shown to everyone. */
const PUBLIC_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Events', to: '/events' },
];

/**
 * Added once signed in. Teams and Connections are meaningless signed out — one
 * lists teams you are on, the other is a directory that needs a session — so
 * they appear rather than sitting there as a prompt to log in.
 */
const MEMBER_LINKS = [
  { label: 'Teams', to: '/teams' },
  { label: 'Connections', to: '/connections' },
  { label: 'Compatibility', to: '/compatibility' },
];

interface NavbarProps {
  onOpenAuth: (mode: 'login' | 'signup') => void;
}

export function Navbar({ onOpenAuth }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastSitePath, setLastSitePath] = useState('/');
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * Signing out always lands on the landing page.
   *
   * Staying put is wrong for any page that needed the session to render: the
   * admin console answers a signed-out viewer with its 404, so logging out
   * there left you stranded on "this page did not make the team". Going home is
   * also simply what people expect from a log-out button.
   */
  const handleLogout = useCallback(() => {
    logout();
    navigate('/');
  }, [logout, navigate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Any navigation closes the mobile drawer.
  useEffect(() => setMobileOpen(false), [location.pathname]);

  // Remember where on the site the admin was, so switching back returns them
  // there rather than dumping them on the home page. The Navbar outlives every
  // route change, so plain state is enough to hold this.
  useEffect(() => {
    if (!location.pathname.startsWith(ADMIN_CONSOLE_PATH)) {
      setLastSitePath(`${location.pathname}${location.search}`);
    }
  }, [location.pathname, location.search]);

  // Active state is a solid block, not an underline gradient. Mono + uppercase
  // keeps the bar reading as a control strip rather than a marketing header.
  const navLinks = user ? [...PUBLIC_LINKS, ...MEMBER_LINKS] : PUBLIC_LINKS;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'type-label border px-2.5 py-2 transition-colors duration-150',
      isActive
        ? 'border-ink-950 bg-ink-950 text-ink-50 dark:border-ink-700 dark:bg-ink-100 dark:text-ink-900'
        : 'border-transparent text-ink-600 hover:border-ink-950 hover:text-ink-900 dark:text-ink-400 dark:hover:border-ink-100 dark:hover:text-white',
    );

  return (
    <header
      className={cn(
        // Always opaque: a translucent blur bar over a hard-edged page reads as
        // a different design system. Scroll only thickens the bottom rule.
        'sticky top-0 z-40 bg-ink-100 transition-shadow duration-150 dark:bg-ink-950',
        'border-b border-ink-200 dark:border-ink-700',
        scrolled && 'shadow-[0_4px_0_0_var(--color-iris-600)]',
      )}
    >
      <Container>
        <nav className="flex h-16 items-center justify-between gap-4" aria-label="Main">
          <Logo />

          <div className="hidden items-center gap-1.5 md:flex">
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClass} end={link.to === '/'}>
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Renders only for admins; nothing else in the bar links to the
                console, so this is the only way in short of typing the URL. */}
            <AdminModeSwitch siteHref={lastSitePath} className="hidden md:grid" />

            <ThemeToggle />

            <div className="hidden items-center gap-2 md:flex">
              {user ? (
                <>
                  {/* The name is the link to the profile — a signed-in person
                      looking for their own settings clicks their name first. */}
                  <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                      cn(
                        'type-label flex max-w-[12rem] items-center gap-2 truncate rounded-full border px-2.5 py-1.5 transition-colors',
                        isActive
                          ? 'border-iris-600 text-accent-text'
                          : 'border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-900 dark:text-ink-300 dark:hover:border-ink-600 dark:hover:text-white',
                      )
                    }
                  >
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-iris-600 text-[0.6rem] font-bold text-white"
                      >
                        {user.firstName?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    )}
                    <span className="truncate">{user.firstName}</span>
                  </NavLink>

                  <NotificationBell />

                  {/* Icon-only, because the label would be the third word in a
                      row that is already name + action. The accessible name
                      carries it instead. */}
                  <NavLink
                    to="/settings"
                    aria-label="Settings"
                    title="Settings"
                    className={({ isActive }) =>
                      cn(
                        'grid h-8 w-8 place-items-center rounded-full border transition-colors',
                        isActive
                          ? 'border-iris-600 text-accent-text'
                          : 'border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-900 dark:text-ink-300 dark:hover:border-ink-600 dark:hover:text-white',
                      )
                    }
                  >
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                    </svg>
                  </NavLink>

                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    Log out
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => onOpenAuth('login')}>
                    Log in
                  </Button>
                  <Button size="sm" onClick={() => onOpenAuth('signup')}>
                    Get Started
                  </Button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-label="Toggle navigation menu"
              className="icon-btn grid h-9 w-9 cursor-pointer place-items-center rounded-[var(--radius-soft-sm)] border border-ink-200 text-ink-900 transition-colors duration-150 hover:bg-ink-950 hover:text-ink-50 md:hidden dark:border-ink-700 dark:text-ink-100 dark:hover:bg-ink-100 dark:hover:text-ink-900"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                {mobileOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
              </svg>
            </button>
          </div>
        </nav>
      </Container>

      {mobileOpen && (
        <div className="border-t border-ink-200 bg-ink-100 md:hidden dark:border-ink-700 dark:bg-ink-950">
          <Container className="space-y-1.5 py-4">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'type-label block border px-3 py-3',
                    isActive
                      ? 'border-ink-950 bg-iris-600 text-white dark:border-ink-700'
                      : 'border-ink-950 text-ink-800 dark:border-ink-700 dark:text-ink-200',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}

            <AdminModeSwitch siteHref={lastSitePath} className="mt-3 grid w-full" />

            <div className="flex flex-col gap-2 pt-3">
              {user ? (
                <>
                  <Button variant="outline" to="/profile">
                    My profile
                  </Button>
                  <Button variant="outline" to="/settings">
                    Settings
                  </Button>
                  <Button variant="outline" onClick={handleLogout}>
                    Log out ({user.fullName})
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => onOpenAuth('login')}>
                    Log in
                  </Button>
                  <Button onClick={() => onOpenAuth('signup')}>Get Started</Button>
                </>
              )}
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
