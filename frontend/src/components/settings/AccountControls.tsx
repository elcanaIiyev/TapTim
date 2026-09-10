import { useState } from 'react';
import { ApiError, authApi, profileApi } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';

/**
 * The two account actions Settings used to describe instead of offering:
 * "changing it from here is not built yet", and "deleting your account is
 * handled by an administrator". Both are now just things you can do.
 */

function fieldErrors(caught: unknown): Record<string, string> {
  if (!(caught instanceof ApiError)) return {};
  return Object.fromEntries(caught.issues.map((issue) => [issue.field, issue.message]));
}

export function ChangePassword({
  hasPassword,
  onChanged,
}: {
  hasPassword: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setIssues({});
    setError(null);
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setIssues({});
    setError(null);
    if (next !== confirm) {
      setIssues({ confirm: 'These do not match.' });
      return;
    }
    setBusy(true);
    try {
      await authApi.changePassword({
        currentPassword: hasPassword ? current : undefined,
        newPassword: next,
      });
      reset();
      setOpen(false);
      setDone(true);
      onChanged();
    } catch (caught) {
      const byField = fieldErrors(caught);
      setIssues(byField);
      if (Object.keys(byField).length === 0) {
        setError(caught instanceof ApiError ? caught.message : 'That did not go through.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-ink-900 dark:text-white">Password</p>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
            {done
              ? 'Changed. Use the new one next time you sign in.'
              : hasPassword
                ? 'Set. You will need the current one to change it.'
                : 'None — you sign in through a linked account. You can add one as a way back in.'}
          </p>
        </div>
        {!open && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDone(false);
              setOpen(true);
            }}
          >
            {hasPassword ? 'Change' : 'Set a password'}
          </Button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="mt-4 grid max-w-md gap-4" noValidate>
          {hasPassword && (
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              error={issues.currentPassword}
            />
          )}
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            hint="At least 10 characters, with a lower-case letter, an upper-case letter, and a number."
            error={issues.newPassword}
          />
          <Input
            label="New password, again"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            error={issues.confirm}
          />
          {error && (
            <p role="alert" className="text-sm font-medium text-signal-bad">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !next || (hasPassword && !current)}>
              {busy && <Spinner />}
              Save password
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Deleting your own account.
 *
 * The address is typed back rather than a box ticked: it is the one step that
 * cannot be done on autopilot. The server refuses on its own if deleting would
 * take anyone else's team with it, and that refusal is shown as-is — it names
 * the teams to hand over first.
 */
export function DeleteAccount({ email, onDeleted }: { email: string; onDeleted: () => void }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await profileApi.deleteMe(typed.trim());
      onDeleted();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not go through.');
      setBusy(false);
    }
  }

  return (
    <div className="py-4">
      <p className="font-semibold text-signal-bad">Delete your account</p>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600 dark:text-ink-300">
        Permanent. Your profile, experience, certificates, connections, messages, and endorsements
        go with it, as does any team you are the only member of. If you own a team other people are
        on, hand it over to one of them first.
      </p>
      <div className="mt-4 flex max-w-xl flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <Input
            label={`Type ${email} to confirm`}
            value={typed}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!matches || busy}
          onClick={() => void remove()}
          className="border-signal-bad text-signal-bad hover:bg-signal-bad hover:text-white"
        >
          {busy && <Spinner />}
          Delete for good
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-signal-bad">
          {error}
        </p>
      )}
    </div>
  );
}
