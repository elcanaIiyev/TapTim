import { useState } from 'react';
import { adminApi, ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import type { AccountRole, AdminAccount } from '../../lib/types';
import { atLeastRole } from '../../lib/types';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

/**
 * Suspend, reinstate and delete, for one row.
 *
 * The server is the authority on all of this — it refuses any action against an
 * account at or above the caller's rank, and refuses deletion to anyone below
 * admin. The UI mirrors those rules only so that buttons which would fail are
 * not offered in the first place.
 */

const DURATIONS = [
  { days: 1, label: '1 day' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

function formatUntil(value: string | null): string {
  if (!value) return '';
  if (value === 'infinity') return 'permanently';
  return `until ${new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}

export function ModerationActions({
  account,
  viewerRole,
  isSelf,
  onChange,
  onDeleted,
}: {
  account: AdminAccount;
  viewerRole: AccountRole;
  isSelf: boolean;
  onChange: (updated: AdminAccount) => void;
  onDeleted: (id: string) => void;
}) {
  const [mode, setMode] = useState<'idle' | 'banning' | 'deleting'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reason, setReason] = useState('');
  const [permanent, setPermanent] = useState(false);
  const [days, setDays] = useState(7);
  const [confirmEmail, setConfirmEmail] = useState('');

  // Mirrors the server: you can only act on someone strictly below you.
  const outranks =
    !isSelf &&
    (viewerRole === 'admin' ? account.accountRole !== 'admin' : account.accountRole === 'user');
  const canDelete = atLeastRole(viewerRole, 'admin') && outranks;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setMode('idle');
      setReason('');
      setConfirmEmail('');
      setPermanent(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not go through.');
    } finally {
      setBusy(false);
    }
  };

  if (!outranks) {
    return (
      <p className="text-xs text-ink-500 dark:text-ink-400">
        {isSelf ? 'Your own account' : 'Same level or above'}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {account.suspended && (
        <p className="text-xs font-medium text-signal-bad">
          Suspended {formatUntil(account.bannedUntil)}
          {account.bannedReason ? ` — ${account.bannedReason}` : ''}
        </p>
      )}

      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          {account.suspended ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void run(async () => onChange(await adminApi.unbanAccount(account.id)))}
            >
              {busy && <Spinner />}
              Reinstate
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setMode('banning')}>
              Suspend
            </Button>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={() => setMode('deleting')}
              className="cursor-pointer rounded-full border border-ink-200 px-2.5 py-1 text-xs text-ink-500 transition-colors hover:border-signal-bad hover:text-signal-bad dark:border-ink-700 dark:text-ink-400"
            >
              Delete
            </button>
          )}
        </div>
      )}

      {mode === 'banning' && (
        <div className="space-y-2.5 rounded-[var(--radius-soft-sm)] border border-signal-bad/40 bg-signal-bad/5 p-3">
          <p className="type-label text-signal-bad">Suspend {account.fullName}</p>

          <input
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason — they are shown this"
            className="w-full rounded-[var(--radius-soft-sm)] border border-ink-300 bg-white px-2.5 py-1.5 text-sm dark:border-ink-700 dark:bg-ink-950 dark:text-white"
          />

          <div className="flex flex-wrap gap-1.5">
            {DURATIONS.map((option) => (
              <button
                key={option.days}
                type="button"
                aria-pressed={!permanent && days === option.days}
                onClick={() => {
                  setPermanent(false);
                  setDays(option.days);
                }}
                className={cn(
                  'cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors',
                  !permanent && days === option.days
                    ? 'border-signal-bad bg-signal-bad text-white'
                    : 'border-ink-300 text-ink-600 dark:border-ink-700 dark:text-ink-400',
                )}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={permanent}
              onClick={() => setPermanent(true)}
              className={cn(
                'cursor-pointer rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                permanent
                  ? 'border-signal-bad bg-signal-bad text-white'
                  : 'border-ink-300 text-ink-600 dark:border-ink-700 dark:text-ink-400',
              )}
            >
              Permanent
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || reason.trim().length < 3}
              onClick={() =>
                void run(async () =>
                  onChange(
                    await adminApi.banAccount(account.id, {
                      reason: reason.trim(),
                      ...(permanent ? { permanent: true } : { durationDays: days }),
                    }),
                  ),
                )
              }
            >
              {busy && <Spinner />}
              {permanent ? 'Suspend permanently' : `Suspend for ${days} day${days === 1 ? '' : 's'}`}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('idle')}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {mode === 'deleting' && (
        <div className="space-y-2.5 rounded-[var(--radius-soft-sm)] border border-signal-bad bg-signal-bad/10 p-3">
          <p className="type-label text-signal-bad">Delete permanently</p>
          <p className="text-xs leading-relaxed text-ink-700 dark:text-ink-300">
            This erases the account, its profile, certificates, experience, connected logins and
            any team it owns. It cannot be undone.
          </p>

          {/* Retyping the address is what separates this from a misclick. */}
          <label className="block text-xs text-ink-600 dark:text-ink-400">
            Type <span className="font-mono font-semibold">{account.email}</span> to confirm
            <input
              type="text"
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              autoComplete="off"
              className="mt-1.5 w-full rounded-[var(--radius-soft-sm)] border border-ink-300 bg-white px-2.5 py-1.5 text-sm dark:border-ink-700 dark:bg-ink-950 dark:text-white"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || confirmEmail.trim().toLowerCase() !== account.email}
              onClick={() =>
                void run(async () => {
                  await adminApi.deleteAccount(account.id, confirmEmail.trim().toLowerCase());
                  onDeleted(account.id);
                })
              }
            >
              {busy && <Spinner />}
              Delete for good
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('idle')}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-signal-bad">
          {error}
        </p>
      )}
    </div>
  );
}
