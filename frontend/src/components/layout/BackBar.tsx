import { useLocation, useNavigate } from 'react-router-dom';
import { Container } from '../ui/Container';

/**
 * The return control, top-left of every page but the landing one.
 *
 * `history.back()` alone is not enough. Half the ways into this site are deep
 * links — a shared recruiting page, an email confirmation, a notification — and
 * on those there is nothing behind the current entry, so a back button would
 * either do nothing or throw the person out of the site entirely onto whatever
 * they were reading before.
 *
 * So it does both: go back when there is somewhere to go back to, and
 * otherwise go *up*, to the page this one belongs under. React Router marks
 * the first entry of a session with `key === 'default'`, which is exactly the
 * "nothing behind us" signal needed to choose between the two.
 */

/**
 * Where a path sits when there is no history.
 *
 * The rule is the first segment — `/teams/abc` is under `/teams` — with two
 * exceptions where the URL's own shape is not the parent anyone means: a
 * participant is reached from the people directory, and a recruiting page from
 * the board that lists them.
 */
const PARENT_OVERRIDES: Record<string, string> = {
  participants: '/connections',
  r: '/recruiting',
  onboarding: '/profile',
  // Neither of these first segments is a page. `/staff/ops-console` is the
  // admin console, whose parent `/staff` is nothing at all, and `/auth/callback`
  // is the OAuth landing strip — going "up" from either would be a 404.
  staff: '/',
  auth: '/',
};

export function parentOf(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 1) return '/';
  return PARENT_OVERRIDES[segments[0]] ?? `/${segments[0]}`;
}

export function BackBar() {
  const navigate = useNavigate();
  const location = useLocation();

  // Nothing to return from on the landing page — it is the destination.
  if (location.pathname === '/') return null;

  const canGoBack = location.key !== 'default';
  const fallback = parentOf(location.pathname);

  return (
    <Container className="pt-5">
      <button
        type="button"
        onClick={() => (canGoBack ? navigate(-1) : navigate(fallback))}
        className="group/back inline-flex cursor-pointer items-center gap-2 rounded-full border border-transparent px-2.5 py-1.5 text-sm font-semibold text-ink-600 transition-colors hover:border-ink-200 hover:bg-white hover:text-ink-900 dark:text-ink-400 dark:hover:border-ink-700 dark:hover:bg-ink-900 dark:hover:text-white"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="transition-transform duration-150 group-hover/back:-translate-x-0.5"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back
      </button>
    </Container>
  );
}
