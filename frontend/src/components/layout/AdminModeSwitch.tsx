import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';
import { ADMIN_CONSOLE_PATH } from '../../lib/routes';
import { atLeastRole } from '../../lib/types';

/**
 * Two-position switch between the site and the admin console.
 *
 * Renders nothing unless the signed-in account is staff (moderator or admin) —
 * and it cannot leak by accident, because `accountRole` is only ever present on
 * the viewer's *own* record. Every other profile the API returns has the field
 * stripped, so there is no shape of response that would light this up for the
 * wrong person.
 *
 * The two halves are links, not buttons: they go somewhere, so they should be
 * openable in a new tab and announced as destinations rather than as controls.
 */
export function AdminModeSwitch({
  /** The site half returns here — the last page the admin was actually on. */
  siteHref,
  /**
   * Must set a `display` — the base classes deliberately do not. The bar needs
   * `hidden md:grid` and the drawer needs a plain `grid`, and baking one in
   * would leave two display utilities of equal specificity fighting over which
   * came last in the stylesheet rather than in the class string.
   */
  className,
}: {
  siteHref: string;
  className?: string;
}) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (!atLeastRole(user?.accountRole, 'moderator')) return null;

  const inAdmin = pathname.startsWith(ADMIN_CONSOLE_PATH);

  const half = (active: boolean) =>
    cn(
      'type-label px-3 py-1.5 text-center transition-colors duration-150',
      active
        ? 'bg-iris-600 text-white'
        : 'text-ink-600 hover:bg-iris-50 hover:text-iris-700 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-iris-300',
    );

  return (
    <div
      role="group"
      aria-label="View"
      className={cn(
        'grid-cols-2 overflow-hidden rounded-[var(--radius-soft-sm)] border',
        'border-ink-950 dark:border-ink-700',
        className,
      )}
    >
      <Link
        to={siteHref}
        className={half(!inAdmin)}
        aria-current={!inAdmin ? 'page' : undefined}
      >
        Site
      </Link>
      <Link
        to={ADMIN_CONSOLE_PATH}
        className={half(inAdmin)}
        aria-current={inAdmin ? 'page' : undefined}
      >
        {user?.accountRole === 'moderator' ? 'Mod' : 'Admin'}
      </Link>
    </div>
  );
}
