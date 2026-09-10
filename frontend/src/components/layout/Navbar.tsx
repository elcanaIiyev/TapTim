import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useChatDock } from '../../context/ChatDockContext';
import { cn } from '../../lib/cn';
import { ADMIN_CONSOLE_PATH } from '../../lib/routes';
import { Button } from '../ui/Button';
import { Container } from '../ui/Container';
import { AccountMenu } from './AccountMenu';
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
  { label: 'Team Lab', to: '/compatibility' },
];

interface NavbarProps {
  onOpenAuth: (mode: 'login' | 'signup') => void;
}

export function Navbar({ onOpenAuth }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastSitePath, setLastSitePath] = useState('/');
  const { user, logout } = useAuth();
  const { unread: unreadChats, toggle: toggleChat, open: chatOpen } = useChatDock();
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

  const navLinks = user ? [...PUBLIC_LINKS, ...MEMBER_LINKS] : PUBLIC_LINKS;

  /**
   * One rail, not five loose buttons.
   *
   * The links used to be hard-cornered bordered blocks, each with its own
   * frame — the shape every bootstrapped header has, and out of step with a
   * design system whose whole premise is real radii and hairlines. Grouping
   * them inside a single inset track makes the cluster read as one control,
   * and leaves the active pill as the only filled thing in the bar.
   */
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'type-label rounded-full px-3 py-1.5 transition-colors duration-150',
      isActive
        ? 'bg-iris-600 text-white'
        : 'text-ink-600 hover:bg-ink-200/70 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-white',
    );

  return (
    <header
      className={cn(
        // Always opaque: a translucent blur bar over a hard-edged page reads as
        // a different design system.
        'sticky top-0 z-40 transition-[background-color,box-shadow] duration-200',
        // The seam is a near-neighbour of the surface and a shade darker than
        // it, in both themes — see --color-seam. A contrasting rule is what
        // made this read as a bar bolted onto the page rather than the top of
        // one continuous surface.
        'border-b border-seam',
        scrolled
          ? // Something is passing underneath, so the bar lifts off the page it
            // was flush with. The separation is carried by tone and a soft
            // shadow rather than by a heavier line.
            'bg-ink-100 shadow-[0_10px_26px_-20px_rgb(26_21_40_/_0.65)] dark:bg-ink-900'
          : // At rest it is the same surface as the page behind it.
            'bg-ink-50 dark:bg-ink-950',
      )}
    >
      <Container>
        <nav className="flex h-16 items-center justify-between gap-4" aria-label="Main">
          <Logo />

          <div className="hidden items-center gap-1 rounded-full border border-ink-200/80 bg-white/70 p-1 md:flex dark:border-ink-800 dark:bg-ink-900/70">
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

            {!user && <ThemeToggle />}

            <div className="hidden items-center gap-2 md:flex">
              {user ? (
                <>
                  {/* Chat had no control of its own: the only way to a
                      conversation was to navigate to /connections and find the
                      name, which is a strange amount of work to answer a
                      message. This and the floating dock drive the same state,
                      so the count on both is one count.

                      It stays outside the account menu, as does the bell,
                      because both carry a number — and a number you need to see
                      is not something to put behind a click. */}
                  <button
                    type="button"
                    onClick={toggleChat}
                    aria-label={unreadChats > 0 ? `Chat, ${unreadChats} unread` : 'Chat'}
                    aria-expanded={chatOpen}
                    title="Chat"
                    className={cn(
                      'relative grid h-8 w-8 cursor-pointer place-items-center rounded-full border transition-colors',
                      chatOpen
                        ? 'border-iris-600 text-accent-text'
                        : 'border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-900 dark:text-ink-300 dark:hover:border-ink-600 dark:hover:text-white',
                    )}
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
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
                    </svg>

                    {unreadChats > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-fern-600 px-1 text-[0.6rem] font-bold tabular-nums text-white"
                      >
                        {unreadChats > 9 ? '9+' : unreadChats}
                      </span>
                    )}
                  </button>

                  <NotificationBell />

                  {/* Profile, settings, theme and signing out, behind the one
                      affordance people already reach for. */}
                  <AccountMenu onLogout={handleLogout} />
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
        <div className="border-t border-seam bg-ink-100 md:hidden dark:bg-ink-900">
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
                  <Button variant="outline" onClick={toggleChat}>
                    Chat{unreadChats > 0 ? ` (${unreadChats})` : ''}
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
