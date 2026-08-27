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

  // Active state is a solid block, not an underline gradient. Mono + uppercase
  // keeps the bar reading as a control strip rather than a marketing header.
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'type-label border-2 px-2.5 py-2 transition-colors duration-150',
      isActive
        ? 'border-ink-950 bg-ink-950 text-ink-50 dark:border-ink-100 dark:bg-ink-100 dark:text-ink-950'
        : 'border-transparent text-ink-600 hover:border-ink-950 hover:text-ink-950 dark:text-ink-400 dark:hover:border-ink-100 dark:hover:text-white',
    );

  return (
    <header
      className={cn(
        // Always opaque: a translucent blur bar over a hard-edged page reads as
        // a different design system. Scroll only thickens the bottom rule.
        'sticky top-0 z-40 bg-ink-100 transition-shadow duration-150 dark:bg-ink-950',
        'border-b-2 border-ink-950 dark:border-ink-100',
        scrolled && 'shadow-[0_4px_0_0_var(--color-flame-600)]',
      )}
    >
      <Container>
        <nav className="flex h-16 items-center justify-between gap-4" aria-label="Main">
          <Logo />

          <div className="hidden items-center gap-1.5 md:flex">
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
                  <span className="type-label max-w-[10rem] truncate text-ink-600 dark:text-ink-300">
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
              className="icon-btn grid h-9 w-9 cursor-pointer place-items-center border-2 border-ink-950 text-ink-950 transition-colors duration-150 hover:bg-ink-950 hover:text-ink-50 md:hidden dark:border-ink-100 dark:text-ink-100 dark:hover:bg-ink-100 dark:hover:text-ink-950"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                {mobileOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
              </svg>
            </button>
          </div>
        </nav>
      </Container>

      {mobileOpen && (
        <div className="border-t-2 border-ink-950 bg-ink-100 md:hidden dark:border-ink-100 dark:bg-ink-950">
          <Container className="space-y-1.5 py-4">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'type-label block border-2 px-3 py-3',
                    isActive
                      ? 'border-ink-950 bg-flame-600 text-ink-950 dark:border-ink-100'
                      : 'border-ink-950 text-ink-800 dark:border-ink-400 dark:text-ink-200',
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
