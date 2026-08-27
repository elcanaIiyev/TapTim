import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { Container } from '../ui/Container';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Events', to: '/events' },
  { label: 'Compatibility', to: '/compatibility' },
];

interface NavbarProps {
  onOpenAuth: (mode: 'login' | 'signup') => void;
}

export function Navbar({ onOpenAuth }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Any navigation closes the mobile drawer.
  useEffect(() => setMobileOpen(false), [location.pathname]);

  // `after:` draws the active underline, so the indicator needs no extra element.
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      'after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full',
      'after:bg-gradient-to-r after:from-brand-500 after:to-accent-400 after:transition-transform',
      'after:duration-200 after:content-[""]',
      isActive
        ? 'text-brand-600 after:scale-x-100 dark:text-brand-400'
        : 'text-ink-600 after:scale-x-0 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white',
    );

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-all duration-200',
        scrolled
          ? 'border-ink-200 bg-white/85 backdrop-blur-lg dark:border-ink-800 dark:bg-ink-950/85'
          : 'border-transparent bg-transparent',
      )}
    >
      <Container>
        <nav className="flex h-16 items-center justify-between gap-4" aria-label="Main">
          <Logo />

          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClass} end={link.to === '/'}>
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            <div className="hidden items-center gap-2 md:flex">
              {user ? (
                <>
                  <span className="max-w-[12rem] truncate text-sm text-ink-600 dark:text-ink-300">
                    {user.fullName}
                  </span>
                  <Button variant="outline" size="sm" onClick={logout}>
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
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-ink-600 hover:bg-ink-100 md:hidden dark:text-ink-300 dark:hover:bg-ink-800"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
              </svg>
            </button>
          </div>
        </nav>
      </Container>

      {mobileOpen && (
        <div className="border-t border-ink-200 bg-white md:hidden dark:border-ink-800 dark:bg-ink-950">
          <Container className="space-y-1 py-4">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'block rounded-lg px-3 py-2.5 text-sm font-medium',
                    isActive
                      ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                      : 'text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}

            <div className="flex flex-col gap-2 pt-3">
              {user ? (
                <Button variant="outline" onClick={logout}>
                  Log out ({user.fullName})
                </Button>
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
