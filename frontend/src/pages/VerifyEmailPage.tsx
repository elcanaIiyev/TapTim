import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../lib/api';
import { ApiError } from '../lib/api';

type Phase = 'checking' | 'confirmed' | 'failed' | 'waiting';

/**
 * Both halves of email confirmation live here.
 *
 * Arriving with `?token=` means someone clicked the link, so it is spent
 * immediately. Arriving without one means they have just signed up and the
 * email is on its way, so the page becomes a waiting room with a resend button.
 * One route, because from a person's point of view it is one step.
 */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, adoptSession } = useAuth();

  const token = params.get('token');
  const [phase, setPhase] = useState<Phase>(token ? 'checking' : 'waiting');
  const [error, setError] = useState<string | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [resendNote, setResendNote] = useState<string | null>(null);

  // React 18 mounts effects twice in StrictMode. A confirmation token is
  // single-use, so without this guard the second run spends a token that the
  // first already consumed and the page reports a failure on success.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    authApi
      .verifyEmail(token)
      .then(async (result) => {
        // The server hands back a fresh session, so confirming also signs you
        // in — there is no reason to make someone log in again immediately
        // after proving they own the address.
        //
        // `next` is deliberately not passed on: handing it to the auth context
        // would arm PostAuthRedirect and bounce straight past this screen. The
        // whole point of the success state is that it is seen, so moving on is
        // a click, not a timer someone can blink through.
        await adoptSession(result.accessToken);
        setPhase('confirmed');
      })
      .catch((caught) => {
        setError(
          caught instanceof ApiError ? caught.message : 'That link could not be checked.',
        );
        setPhase('failed');
      });
  }, [token, adoptSession, navigate]);

  async function resend() {
    if (!user?.email) return;
    setResendState('sending');
    setResendNote(null);
    try {
      const result = await authApi.resendVerification(user.email);
      setResendState(result.sent ? 'sent' : 'failed');
      setResendNote(result.error);
    } catch {
      setResendState('failed');
      setResendNote('We could not reach the server.');
    }
  }

  return (
    <Container className="flex min-h-[70vh] items-center py-14">
      <div className="hud hud-ticks relative mx-auto w-full max-w-lg overflow-hidden p-8 sm:p-10">
        <div className="grid-floor pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />

        <div className="relative">
          <p className="type-label text-accent-text">Account · Step 2</p>

          {phase === 'checking' && (
            <>
              <h1 className="type-section mt-4 text-ink-900 dark:text-white">
                Confirming your email…
              </h1>
              <div className="mt-6 flex items-center gap-3 text-sm text-ink-600 dark:text-ink-300">
                <Spinner className="text-iris-600 dark:text-iris-400" />
                One moment.
              </div>
            </>
          )}

          {phase === 'confirmed' && (
            <div role="status">
              <div
                aria-hidden="true"
                className="mt-4 grid h-16 w-16 place-items-center rounded-full border-2 border-fern-600 bg-fern-600 text-3xl font-bold text-white pulse-cta"
                style={{ boxShadow: '0 0 30px -2px rgb(16 185 129 / 0.75)' }}
              >
                ✓
              </div>

              <h1 className="type-section mt-5 text-ink-900 dark:text-white">
                Email confirmed
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
                {user?.email ? (
                  <>
                    <span className="font-mono font-semibold text-success-text">{user.email}</span>{' '}
                    is verified and you're signed in.
                  </>
                ) : (
                  <>Your address is verified and you're signed in.</>
                )}{' '}
                One thing left: your profile is what the matching actually runs on.
              </p>

              {/* The three states of registration, with this one struck through,
                  so the success reads as progress rather than a dead end. */}
              <ol className="mt-6 space-y-2 text-sm">
                {[
                  { label: 'Account created', done: true },
                  { label: 'Email confirmed', done: true },
                  { label: 'Build your profile', done: false },
                ].map((entry) => (
                  <li
                    key={entry.label}
                    className={
                      entry.done
                        ? 'flex items-center gap-2.5 text-success-text'
                        : 'flex items-center gap-2.5 font-semibold text-ink-900 dark:text-white'
                    }
                  >
                    <span
                      aria-hidden="true"
                      className={
                        entry.done
                          ? 'grid h-5 w-5 place-items-center rounded-full border border-fern-600 bg-fern-600 text-[11px] font-bold text-white'
                          : 'grid h-5 w-5 place-items-center rounded-full border-2 border-iris-500 text-[11px] font-bold text-accent-text'
                      }
                    >
                      {entry.done ? '✓' : '3'}
                    </span>
                    {entry.label}
                  </li>
                ))}
              </ol>

              <div className="mt-7 flex flex-wrap gap-3">
                <Button
                  className="pulse-cta"
                  onClick={() => navigate('/onboarding', { replace: true })}
                >
                  Build my profile
                </Button>
                <Button variant="ghost" onClick={() => navigate('/', { replace: true })}>
                  Later
                </Button>
              </div>
            </div>
          )}

          {phase === 'failed' && (
            <>
              <h1 className="type-section mt-4 text-ink-900 dark:text-white">
                That link didn't work
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{error}</p>
              {user ? (
                <Button className="mt-7" onClick={() => void resend()} disabled={resendState === 'sending'}>
                  {resendState === 'sending' && <Spinner />}
                  Send a new link
                </Button>
              ) : (
                <Button to="/login" className="mt-7">
                  Log in to try again
                </Button>
              )}
            </>
          )}

          {phase === 'waiting' && (
            <>
              <h1 className="type-section mt-4 text-ink-900 dark:text-white">Check your inbox</h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
                We sent a confirmation link
                {user?.email ? (
                  <>
                    {' '}
                    to <span className="font-mono font-semibold text-accent-text">{user.email}</span>
                  </>
                ) : null}
                . Click it and we'll take you straight to building your profile.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => void resend()}
                  disabled={resendState === 'sending' || !user}
                >
                  {resendState === 'sending' && <Spinner />}
                  {resendState === 'sent' ? 'Sent again' : 'Resend the email'}
                </Button>
                <Button variant="ghost" to="/">
                  Back to home
                </Button>
              </div>

              {resendState === 'sent' && (
                <p role="status" className="mt-4 text-xs font-medium text-success-text">
                  On its way. It can take a minute to arrive — check spam too.
                </p>
              )}
              {resendState === 'failed' && (
                <p role="alert" className="mt-4 text-xs font-medium text-signal-bad">
                  {resendNote ?? 'We could not send it. Try again shortly.'}
                </p>
              )}

              <p className="mt-8 border-t border-ink-200 pt-5 text-xs leading-relaxed text-ink-500 dark:border-ink-800 dark:text-ink-400">
                Wrong address? Log out and sign up again — nothing is saved to your profile yet.
              </p>
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
