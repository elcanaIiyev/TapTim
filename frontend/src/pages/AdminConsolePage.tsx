import { useCallback, useEffect, useState } from 'react';
import { ModerationActions } from '../components/admin/ModerationActions';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { Input, Select } from '../components/ui/Input';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { adminApi, ApiError } from '../lib/api';
import { formatDate } from '../lib/format';
import { cn } from '../lib/cn';
import { ACCOUNT_ROLES, atLeastRole, ROLE_SUMMARY } from '../lib/types';
import type { AccountRole, AdminAccount, AdminSummary } from '../lib/types';
import { NotFoundPage } from './NotFoundPage';

interface LoadState {
  accounts: AdminAccount[];
  summary: AdminSummary | null;
  loading: boolean;
  error: string | null;
}

const ROLE_TONE: Record<AccountRole, 'accent' | 'warning' | 'neutral'> = {
  admin: 'accent',
  moderator: 'warning',
  user: 'neutral',
};

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="panel panel-soft px-5 py-4">
      <p className="type-label text-ink-600 dark:text-ink-400">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-ink-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

/**
 * The site-role control for one account. Lifted out of the table body so a row
 * owns its own saving and error state — a failed change on one person must not
 * blank the whole table or roll back edits made to anyone else.
 *
 * Site role is the only thing here. Profession, skills and bio are profile
 * data; an admin has no more business rewriting someone's job title than their
 * skill list.
 */
function AccountControls({
  account,
  isSelf,
  canSetRole,
  onChange,
}: {
  account: AdminAccount;
  isSelf: boolean;
  /** Only admins may hand out authority; moderators see the role read-only. */
  canSetRole: boolean;
  onChange: (id: string, accountRole: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const apply = async (accountRole: string) => {
    setSaving(true);
    setError(null);
    try {
      await onChange(account.id, accountRole);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 1400);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save that change.');
    } finally {
      setSaving(false);
    }
  };

  if (!canSetRole || isSelf) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={ROLE_TONE[account.accountRole]}>{account.accountRole}</Badge>
        <span className="text-xs text-ink-600 dark:text-ink-400">
          {isSelf ? 'your own account' : 'admins only'}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`site-${account.id}`}>
          Site role for {account.fullName}
        </label>
        <select
          id={`site-${account.id}`}
          value={account.accountRole}
          disabled={saving}
          onChange={(event) => void apply(event.target.value)}
          className={cn(
            'w-40 cursor-pointer rounded-[var(--radius-soft-sm)] border bg-white px-2.5 py-1.5 text-sm',
            'text-ink-900 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
            'dark:bg-ink-950 dark:text-white',
            flash
              ? 'border-signal-ok dark:border-signal-ok'
              : 'border-ink-950 hover:border-iris-600 dark:border-ink-700 dark:hover:border-iris-500',
          )}
        >
          {ACCOUNT_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        {saving && <Spinner className="text-iris-600 dark:text-iris-400" />}
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-signal-bad">
          {error}
        </p>
      )}
    </div>
  );
}

export function AdminConsolePage() {
  const { user, initialising } = useAuth();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [state, setState] = useState<LoadState>({
    accounts: [],
    summary: null,
    loading: true,
    error: null,
  });
  const [denied, setDenied] = useState(false);

  const isStaff = atLeastRole(user?.accountRole, 'moderator');
  const canSetRole = atLeastRole(user?.accountRole, 'admin');

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const response = await adminApi.accounts({
        search: search.trim() || undefined,
        accountRole: roleFilter,
      });
      setState({
        accounts: response.data,
        summary: response.meta.summary,
        loading: false,
        error: null,
      });
    } catch (caught) {
      // The API answers non-staff with 404 rather than 403, so a NOT_FOUND here
      // means authority was lost (demoted, or a stale token) — drop to the same
      // not-found page an ordinary visitor sees rather than explaining.
      if (caught instanceof ApiError && caught.status === 404) {
        setDenied(true);
        return;
      }
      setState({
        accounts: [],
        summary: null,
        loading: false,
        error: caught instanceof Error ? caught.message : 'Could not load accounts.',
      });
    }
  }, [search, roleFilter]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    if (!isStaff) return;
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [isStaff, load]);

  /** Replaces one row in place after a moderation action. */
  const replaceAccount = useCallback((updated: AdminAccount) => {
    setState((previous) => ({
      ...previous,
      accounts: previous.accounts.map((a) => (a.id === updated.id ? updated : a)),
    }));
  }, []);

  const removeAccount = useCallback((id: string) => {
    setState((previous) => ({
      ...previous,
      accounts: previous.accounts.filter((a) => a.id !== id),
      // The totals include the deleted account, so they are re-read rather
      // than decremented — a guess here would drift from the database.
      summary: previous.summary,
    }));
  }, []);

  const updateAccount = useCallback(
    async (id: string, accountRole: string) => {
      const updated = await adminApi.updateAccount(id, { accountRole });
      setState((previous) => ({
        ...previous,
        accounts: previous.accounts.map((account) => (account.id === id ? updated : account)),
      }));
      // A role change moves the summary counts, so refresh them from the server
      // rather than trying to keep a running tally in the client.
      void load();
    },
    [load],
  );

  // Nothing about this page acknowledges its own existence to the wrong viewer:
  // no "please sign in", no "staff only". Anonymous visitors, ordinary users and
  // demoted staff all get the same 404 the router gives an unknown URL.
  if (initialising) {
    return (
      <Container className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="text-iris-600 dark:text-iris-400" />
      </Container>
    );
  }
  if (!isStaff || denied) return <NotFoundPage />;

  const rows = state.accounts;

  return (
    <Container className="py-14">
      <SectionHeading
        overline={`${user?.accountRole} console`}
        title="Accounts"
        description="Everyone who has created an account, and what each of them is allowed to do on the site."
      />

      {state.summary && (
        <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Accounts" value={state.summary.accounts} />
          <Stat label="Admins" value={state.summary.byRole.admin} />
          <Stat label="Moderators" value={state.summary.byRole.moderator} />
          <Stat label="Users" value={state.summary.byRole.user} />
          <Stat label="Verified" value={state.summary.verified} />
        </div>
      )}

      <div className="mt-9 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Input
          label="Search"
          placeholder="Name, bio, or skill"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          label="Site role"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className="sm:w-56"
        >
          <option value="All">All site roles</option>
          {ACCOUNT_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-9">
        {state.loading ? (
          <div className="panel panel-soft flex items-center gap-3 px-6 py-14">
            <Spinner className="text-iris-600 dark:text-iris-400" />
            <span className="text-sm text-ink-600 dark:text-ink-300">Loading accounts…</span>
          </div>
        ) : state.error ? (
          <div className="panel panel-soft px-6 py-14 text-center">
            <p className="type-label text-signal-bad">Could not load accounts</p>
            <p className="mx-auto mt-3 max-w-sm text-sm text-ink-600 dark:text-ink-300">
              {state.error}
            </p>
            <Button variant="outline" className="mt-7" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="panel panel-soft px-6 py-14 text-center">
            <p className="type-label text-ink-600 dark:text-ink-400">No accounts match</p>
            <p className="mx-auto mt-3 max-w-sm text-sm text-ink-600 dark:text-ink-300">
              Nobody matches those filters. Clear them to see everyone.
            </p>
            <Button
              variant="outline"
              className="mt-7"
              onClick={() => {
                setSearch('');
                setRoleFilter('All');
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop: a real table. Wide content scrolls inside its own
                container so the page body never scrolls sideways. */}
            <div className="hidden overflow-x-auto rounded-[var(--radius-soft-lg)] border border-ink-200 lg:block dark:border-ink-700">
              <table className="w-full min-w-[68rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-900">
                    {['Participant', 'Joined', 'Signals', 'Site role', 'Moderation'].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="type-label px-5 py-3.5 text-ink-600 dark:text-ink-400"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((account) => (
                    <tr
                      key={account.id}
                      className="border-b border-ink-200 last:border-0 dark:border-ink-800"
                    >
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold text-ink-900 dark:text-white">
                          {account.fullName}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-ink-600 dark:text-ink-400">
                          {account.email}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top whitespace-nowrap text-ink-600 dark:text-ink-300">
                        {formatDate(account.createdAt)}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {account.suspended && (
                            <Badge tone="warning">
                              {account.permanentBan ? 'Banned' : 'Suspended'}
                            </Badge>
                          )}
                          {account.accountRole !== 'user' && (
                            <Badge tone={ROLE_TONE[account.accountRole]}>
                              {account.accountRole}
                            </Badge>
                          )}
                          {account.verified && <Badge tone="success">Verified</Badge>}
                          {account.teamCount > 0 && (
                            <Badge>
                              {account.teamCount} team{account.teamCount === 1 ? '' : 's'}
                            </Badge>
                          )}
                          {account.lookingForTeam && <Badge tone="brand">Open to teams</Badge>}
                        </div>
                      </td>
                      <td className="w-52 px-5 py-4 align-top">
                        <AccountControls
                          account={account}
                          isSelf={account.id === user?.id}
                          canSetRole={canSetRole}
                          onChange={updateAccount}
                        />
                      </td>
                      <td className="w-64 px-5 py-4 align-top">
                        <ModerationActions
                          account={account}
                          viewerRole={user?.accountRole ?? 'user'}
                          isSelf={account.id === user?.id}
                          onChange={replaceAccount}
                          onDeleted={(id) => {
                            removeAccount(id);
                            void load();
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Below lg a table cannot stay readable, so each account becomes a
                card with the same information stacked. */}
            <ul className="space-y-3 lg:hidden">
              {rows.map((account) => (
                <li key={account.id} className="panel panel-soft p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900 dark:text-white">
                        {account.fullName}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-ink-600 dark:text-ink-400">
                        {account.email}
                      </p>
                    </div>
                    <span className="type-label whitespace-nowrap text-ink-600 dark:text-ink-400">
                      {formatDate(account.createdAt)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {account.suspended && (
                      <Badge tone="warning">
                        {account.permanentBan ? 'Banned' : 'Suspended'}
                      </Badge>
                    )}
                    {account.accountRole !== 'user' && (
                      <Badge tone={ROLE_TONE[account.accountRole]}>{account.accountRole}</Badge>
                    )}
                    {account.verified && <Badge tone="success">Verified</Badge>}
                    {account.teamCount > 0 && (
                      <Badge>
                        {account.teamCount} team{account.teamCount === 1 ? '' : 's'}
                      </Badge>
                    )}
                    {account.lookingForTeam && <Badge tone="brand">Open to teams</Badge>}
                  </div>

                  <div className="mt-4 space-y-4 border-t border-ink-200 pt-4 dark:border-ink-800">
                    <AccountControls
                      account={account}
                      isSelf={account.id === user?.id}
                      canSetRole={canSetRole}
                      onChange={updateAccount}
                    />
                    <ModerationActions
                      account={account}
                      viewerRole={user?.accountRole ?? 'user'}
                      isSelf={account.id === user?.id}
                      onChange={replaceAccount}
                      onDeleted={(id) => {
                        removeAccount(id);
                        void load();
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="mt-10 max-w-2xl space-y-2 text-xs leading-relaxed text-ink-600 dark:text-ink-400">
        <p className="type-label text-ink-700 dark:text-ink-300">What the site roles mean</p>
        {ACCOUNT_ROLES.map((role) => (
          <p key={role}>
            <span className="font-mono font-bold text-ink-800 dark:text-ink-200">{role}</span> —{' '}
            {ROLE_SUMMARY[role]}
          </p>
        ))}
        <p className="pt-2">
          {canSetRole
            ? 'You cannot lower your own site role, and the last admin cannot be demoted — either would lock this console for everyone.'
            : 'Only admins can change site roles.'}
        </p>
      </div>
    </Container>
  );
}
