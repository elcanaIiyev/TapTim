import { useEffect, useState } from 'react';
import { ChangePassword, DeleteAccount } from '../components/settings/AccountControls';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Container } from '../components/ui/Container';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ApiError, authApi, profileApi } from '../lib/api';
import { cn } from '../lib/cn';
import type { ProviderStatus } from '../lib/types';

/**
 * Account settings.
 *
 * Every control here changes something real. The temptation on a page like this
 * is to fill it out with plausible-looking switches — email digests, push
 * notifications, marketing preferences — that write to nothing; a switch that
 * silently does nothing is worse than an empty section, because someone will
 * set it and believe it. So nothing is offered here that does not work.
 */

/** A labelled on/off control backed by a real setting. */
function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  busy = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="min-w-0">
        <p className="font-semibold text-ink-900 dark:text-white">{label}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled || busy}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-1 h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-150',
          checked
            ? 'border-fern-700 bg-fern-600'
            : 'border-ink-300 bg-ink-200 dark:border-ink-600 dark:bg-ink-700',
          (disabled || busy) && 'cursor-not-allowed opacity-60',
        )}
      >
        {/*
          Anchored with `left`, moved with `translate`.

          Tailwind v4 compiles `translate-x-*` to the CSS `translate` property,
          which offsets from wherever the element already sits — and for an
          absolutely positioned box with no `left`, that is its *static*
          position, not the track's edge. Using translate alone put the knob
          19px outside the track. Pinning `left` first makes the origin explicit
          and leaves translate to do only the animating.

          Track 44x24 with a 1px border, knob 18px, 3px inset each side, so the
          travel is 44 - 18 - 3 - 3 = 20px.
        */}
        <span
          aria-hidden="true"
          className={cn(
            'absolute left-[3px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow',
            'transition-transform duration-150 motion-reduce:transition-none',
            checked ? 'translate-x-[20px]' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mt-6">
      <h2 className="type-label text-accent-text">{title}</h2>
      {hint && (
        <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{hint}</p>
      )}
      <div className="mt-2 divide-y divide-ink-200 dark:divide-ink-700">{children}</div>
    </Card>
  );
}

export function SettingsPage() {
  const { user, initialising, refresh, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [busyField, setBusyField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    authApi
      .providers()
      .then(setProviders)
      .catch(() => setProviders([]));
  }, []);

  // A saved confirmation that clears itself, so the page does not accumulate
  // stale "Saved" labels as someone works down it.
  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(null), 2200);
    return () => window.clearTimeout(timer);
  }, [saved]);

  if (initialising) {
    return (
      <Container className="py-20">
        <div className="flex items-center gap-3 text-sm text-ink-600 dark:text-ink-300">
          <Spinner className="text-iris-600 dark:text-iris-400" />
          Loading your settings…
        </div>
      </Container>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  async function patch(field: string, body: Parameters<typeof profileApi.update>[0]) {
    setBusyField(field);
    setError(null);
    try {
      await profileApi.update(body);
      await refresh();
      setSaved(field);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That change did not save.');
    } finally {
      setBusyField(null);
    }
  }

  async function unlink(provider: string) {
    setBusyField(provider);
    setError(null);
    try {
      await authApi.disconnectOAuth(provider);
      await refresh();
      setSaved(provider);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not unlink that account.');
    } finally {
      setBusyField(null);
    }
  }

  const linked = new Set(user.connections.map((c) => c.provider));

  return (
    <Container className="py-14 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink-200 pb-8 dark:border-ink-700">
        <div>
          <span className="type-label text-accent-text">Account</span>
          <h1 className="type-display mt-4 text-ink-900 dark:text-white">Settings</h1>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          Everything here saves as you change it. Your skills, roles and availability live on
          your{' '}
          <Link to="/profile" className="font-semibold underline underline-offset-4">
            profile
          </Link>
          .
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-6 text-sm font-medium text-signal-bad">
          {error}
        </p>
      )}

      {/* -- appearance ------------------------------------------------------ */}
      <Section title="Appearance">
        <Toggle
          label="Dark theme"
          description="Follows your choice on this device. Nothing is stored on the server."
          checked={theme === 'dark'}
          onChange={toggleTheme}
        />
      </Section>

      {/* -- discoverability -------------------------------------------------- */}
      <Section
        title="Being found"
        hint="Controls whether teams looking for someone can see you in their suggestions."
      >
        <Toggle
          label="Open to joining a team"
          description={
            user.lookingForTeam
              ? 'You appear in team suggestions and the participant directory.'
              : 'You are hidden from team suggestions. Your profile still opens by direct link.'
          }
          checked={user.lookingForTeam}
          busy={busyField === 'lookingForTeam'}
          onChange={(next) => void patch('lookingForTeam', { lookingForTeam: next })}
        />
        {saved === 'lookingForTeam' && (
          <p className="py-3 text-xs font-medium text-success-text">Saved.</p>
        )}
      </Section>

      {/* -- linked accounts --------------------------------------------------- */}
      <Section
        title="Linked accounts"
        hint="Sign in with a provider instead of a password. Unlinking is refused if it would leave you with no way back in."
      >
        {providers.length === 0 && (
          <p className="py-4 text-sm text-ink-600 dark:text-ink-300">
            No sign-in providers are configured on this server.
          </p>
        )}

        {providers.map((provider) => {
          const isLinked = linked.has(provider.provider);
          return (
            <div
              key={provider.provider}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink-900 dark:text-white">
                  {provider.label}
                  {isLinked && (
                    <Badge tone="success" className="ml-2">
                      Linked
                    </Badge>
                  )}
                  {!provider.configured && (
                    <Badge tone="neutral" className="ml-2">
                      Not configured
                    </Badge>
                  )}
                </p>
                <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
                  {isLinked
                    ? user.connections.find((c) => c.provider === provider.provider)?.email ??
                      'Connected.'
                    : provider.configured
                      ? `Use your ${provider.label} account to sign in.`
                      : `${provider.label} sign-in is not set up on this deployment.`}
                </p>
              </div>

              {isLinked ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyField === provider.provider}
                  onClick={() => void unlink(provider.provider)}
                >
                  {busyField === provider.provider && <Spinner />}
                  Unlink
                </Button>
              ) : (
                provider.configured && (
                  <Button
                    size="sm"
                    variant="outline"
                    // A full navigation, not an XHR: the provider's consent
                    // screen has to own the tab.
                    onClick={() => {
                      window.location.href = `/api/auth/oauth/${provider.provider}/connect`;
                    }}
                  >
                    Link
                  </Button>
                )
              )}
            </div>
          );
        })}
      </Section>

      {/* -- account ----------------------------------------------------------- */}
      <Section title="Account">
        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <p className="font-semibold text-ink-900 dark:text-white">Email</p>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{user.email}</p>
          </div>
          <Badge tone={user.emailVerified ? 'success' : 'neutral'}>
            {user.emailVerified ? 'Confirmed' : 'Unconfirmed'}
          </Badge>
        </div>

        <ChangePassword hasPassword={user.hasPassword} onChanged={() => void refresh()} />

        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <p className="font-semibold text-ink-900 dark:text-white">Role on TapTim</p>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
              What you can do on the site. Separate from the roles you play on a team.
            </p>
          </div>
          <Badge tone={user.accountRole === 'user' ? 'neutral' : 'brand'}>
            {user.accountRole}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <p className="font-semibold text-ink-900 dark:text-white">Sign out</p>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
              Ends this session on this device.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={logout}>
            Sign out
          </Button>
        </div>
      </Section>

      {/* -- notifications ------------------------------------------------ */}
      <Section
        title="Notifications"
        hint="Everything that needs you arrives in the app — the bell in the header carries invitations, applications, replies, and people joining your team."
      >
        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <p className="font-semibold text-ink-900 dark:text-white">In the app</p>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
              Invitations, applications, accepted and declined requests, someone joining your
              team, and connection requests.
            </p>
          </div>
          <Badge tone="success">On</Badge>
        </div>

      </Section>

      <Section title="Danger zone">
        <DeleteAccount
          email={user.email}
          onDeleted={() => {
            logout();
            navigate('/', { replace: true });
          }}
        />
      </Section>
    </Container>
  );
}
