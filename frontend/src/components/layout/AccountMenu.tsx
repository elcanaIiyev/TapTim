import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/cn';

/**
 * Everything about *you*, behind your own face.
 *
 * The bar's right side had grown to seven controls, three of them near-identical
 * icon circles — chat, bell, gear — sitting next to an avatar that already
 * linked to the profile. That is the one part of the redesign that made the
 * header busier rather than calmer, and the fix is not a smaller gear: it is
 * noticing that settings, the theme and signing out are all the same category
 * of thing, and that the avatar is already the affordance for that category.
 *
 * Chat and the bell stay outside, because they carry counts. A number you need
 * to see is not something to hide behind a click.
 */
export function AccountMenu({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape — a menu that can only be closed by the
  // button that opened it is a trap on a narrow screen.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const item =
    'flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm font-medium ' +
    'text-ink-700 transition-colors hover:bg-iris-50 dark:text-ink-200 dark:hover:bg-ink-800';

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Your account"
        className={cn(
          'flex max-w-[12rem] cursor-pointer items-center gap-2 truncate rounded-full border py-1.5 pl-1.5 pr-2.5 transition-colors',
          open
            ? 'border-iris-600 text-accent-text'
            : 'border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-900 dark:text-ink-300 dark:hover:border-ink-600 dark:hover:text-white',
        )}
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
        <span className="type-label truncate">{user.firstName}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn('shrink-0 transition-transform', open && 'rotate-180')}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="panel floating absolute right-0 z-50 mt-2 w-56 overflow-hidden py-1.5"
        >
          <p className="px-4 pb-2 pt-1 text-xs text-ink-500 dark:text-ink-400">
            <span className="block truncate font-semibold text-ink-800 dark:text-ink-100">
              {user.fullName}
            </span>
            <span className="block truncate">{user.email}</span>
          </p>

          <div className="my-1 h-px bg-ink-200 dark:bg-ink-800" />

          <Link role="menuitem" to="/profile" onClick={() => setOpen(false)} className={item}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Your profile
          </Link>

          <Link role="menuitem" to="/settings" onClick={() => setOpen(false)} className={item}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
            Settings
          </Link>

          <button role="menuitem" type="button" onClick={toggleTheme} className={item}>
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            )}
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </button>

          <div className="my-1 h-px bg-ink-200 dark:bg-ink-800" />

          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className={cn(item, 'text-signal-bad hover:bg-signal-bad/10 dark:text-signal-bad-bright')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
