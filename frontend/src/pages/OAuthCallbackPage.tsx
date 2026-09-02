import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import type { NextStep } from '../lib/types';

/**
 * Where a provider drops the browser after sign-in.
 *
 * The token arrives in the URL *fragment* rather than the query string:
 * fragments are never sent to a server, so it stays out of access logs and
 * `Referer` headers. This page reads it, hands it to the auth context, and
 * immediately rewrites the address bar so the token is not left sitting in
 * history for the next person to use the machine.
 */
export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { adoptSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // StrictMode double-mounts effects; the fragment is cleared on the first run
  // so the second would otherwise read nothing and report a failure.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const failure = fragment.get('error');
    const token = fragment.get('token');
    const next = (fragment.get('next') as NextStep | null) ?? 'dashboard';

    // Clear it before doing anything else, so a thrown error cannot leave the
    // token visible in the address bar.
    window.history.replaceState(null, '', window.location.pathname);

    if (failure) {
      setError(failure);
      return;
    }
    if (!token) {
      setError('That sign-in did not complete. Please try again.');
      return;
    }

    adoptSession(token, next)
      .then(() => {
        const destination =
          next === 'verify-email' ? '/verify-email' : next === 'onboarding' ? '/onboarding' : '/';
        navigate(destination, { replace: true });
      })
      .catch(() => setError('We signed you in but could not load your profile. Try again.'));
  }, [adoptSession, navigate]);

  return (
    <Container className="flex min-h-[70vh] items-center py-14">
      <div className="hud hud-ticks relative mx-auto w-full max-w-lg overflow-hidden p-8 sm:p-10">
        <div className="grid-floor pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />

        <div className="relative">
          <p className="type-label text-accent-text">Signing you in</p>

          {error ? (
            <>
              <h1 className="type-section mt-4 text-ink-900 dark:text-white">
                That didn't go through
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{error}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button to="/signup">Try again</Button>
                <Button variant="outline" to="/">
                  Back to home
                </Button>
              </div>
            </>
          ) : (
            <>
              <h1 className="type-section mt-4 text-ink-900 dark:text-white">One moment…</h1>
              <div className="mt-6 flex items-center gap-3 text-sm text-ink-600 dark:text-ink-300">
                <Spinner className="text-iris-600 dark:text-iris-400" />
                Setting up your session.
              </div>
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
