import { certificateStore } from '../../data/certificate.store.js';
import { teamStore } from '../../data/team.store.js';
import { LastAdminError, userStore } from '../../data/user.store.js';
import { deleteAvatar } from '../../services/storage.js';
import { HttpError } from '../../utils/http-error.js';
import { atLeast, rankOf, type AccountRole } from '../users/account-role.js';
import { isBanned, isPermanentBan, type UserRecord } from '../users/user.model.js';
import type {
  BanAccountInput,
  DeleteAccountInput,
  ListAccountsQuery,
  UpdateAccountInput,
} from './admin.schema.js';

/**
 * The console's view of an account. Unlike the public directory this includes
 * the email and the site role — that is the whole point of the screen — so
 * every route reaching this service must be behind `requireRole`.
 */
export interface AdminAccount {
  id: string;
  email: string;
  fullName: string;
  /** Authority on the site: user, moderator, or admin. The only editable field. */
  accountRole: AccountRole;
  verified: boolean;
  lookingForTeam: boolean;
  verifiedCertificates: number;
  teamCount: number;
  createdAt: string;

  // -- moderation ------------------------------------------------------------
  /** True only while a suspension is actually in force. */
  suspended: boolean;
  bannedUntil: string | null;
  bannedReason: string | null;
  permanentBan: boolean;
}

function toAdminAccount(user: UserRecord, certificates: number, teamCount: number): AdminAccount {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    accountRole: user.accountRole,
    verified: user.verified,
    lookingForTeam: user.lookingForTeam,
    verifiedCertificates: certificates,
    teamCount,
    createdAt: user.createdAt,
    suspended: isBanned(user),
    bannedUntil: user.bannedUntil,
    bannedReason: user.bannedReason,
    permanentBan: isPermanentBan(user),
  };
}

/**
 * Nobody may act on someone at or above their own rank.
 *
 * One rule covers the cases that would otherwise each need their own check: a
 * moderator cannot ban an admin, an admin cannot ban another admin out of a
 * disagreement, and nobody can moderate themselves. Without it, "staff" would
 * be a single tier that could turn on itself.
 */
function assertOutranks(actor: UserRecord, target: UserRecord, verb: string): void {
  if (target.id === actor.id) {
    throw HttpError.badRequest(`You cannot ${verb} your own account.`);
  }
  if (rankOf(target.accountRole) >= rankOf(actor.accountRole)) {
    throw HttpError.forbidden(
      `You cannot ${verb} an account at your own level or above. Ask someone with a higher role.`,
    );
  }
}

export interface ListAccountsResult {
  items: AdminAccount[];
  total: number;
  limit: number;
  offset: number;
  /** Totals across the whole table, not just this page. */
  summary: {
    accounts: number;
    verified: number;
    byRole: Record<AccountRole, number>;
  };
}

export async function listAccounts(query: ListAccountsQuery): Promise<ListAccountsResult> {
  const { items, total } = await userStore.list({
    search: query.search,
    // The console is the one place where searching by address is right: an
    // admin acting on a report has the email, not the display name.
    searchEmail: true,
    accountRole: query.accountRole,
    staffOnly: query.staffOnly,
    verified: query.verified,
    limit: query.limit,
    offset: query.offset,
  });

  const ids = items.map((user) => user.id);
  const [certificateCounts, teamCounts, accounts, verified, counts] = await Promise.all([
    certificateStore.verifiedCountsFor(ids),
    teamStore.teamCountsFor(ids),
    userStore.count(),
    userStore.countVerified(),
    userStore.countByRole(),
  ]);

  return {
    items: items.map((user) =>
      toAdminAccount(user, certificateCounts.get(user.id) ?? 0, teamCounts.get(user.id) ?? 0),
    ),
    total,
    limit: query.limit,
    offset: query.offset,
    summary: {
      accounts,
      verified,
      byRole: {
        user: counts.user ?? 0,
        moderator: counts.moderator ?? 0,
        admin: counts.admin ?? 0,
      },
    },
  };
}

export async function updateAccount(
  id: string,
  input: UpdateAccountInput,
  actor: UserRecord,
): Promise<AdminAccount> {
  const target = await userStore.findById(id);
  if (!target) {
    throw HttpError.notFound(`No account found with id "${id}".`);
  }

  // Handing out authority is an admin's job. A moderator who could promote
  // people could promote themselves, which would make the middle tier
  // indistinguishable from the top one.
  if (!atLeast(actor.accountRole, 'admin')) {
    throw HttpError.forbidden('Only an admin can change site roles.');
  }

  // Demoting yourself is refused outright. It is the one mistake a lone admin
  // can make that costs them the console, and "ask a colleague" is a cheaper
  // answer than "get a shell on the server and run the CLI".
  if (input.accountRole !== 'admin' && target.id === actor.id) {
    throw HttpError.badRequest(
      'You cannot lower your own site role. Ask another admin to do it.',
    );
  }

  let updated = target;

  if (input.accountRole !== target.accountRole) {
    try {
      const result = await userStore.setAccountRoleGuarded(id, input.accountRole);
      if (!result) throw HttpError.notFound(`No account found with id "${id}".`);
      updated = result;
    } catch (error) {
      if (error instanceof LastAdminError) {
        throw HttpError.badRequest(error.message);
      }
      throw error;
    }
  }

  const [certificates, teamCounts] = await Promise.all([
    certificateStore.countVerified(id),
    teamStore.teamCountsFor([id]),
  ]);

  return toAdminAccount(updated, certificates, teamCounts.get(id) ?? 0);
}


// -- moderation ---------------------------------------------------------------

/**
 * Suspends an account.
 *
 * Moderators can do this — it is the point of the tier — but only to people
 * below them, so the console cannot be used to remove the people who run it.
 */
export async function banAccount(
  id: string,
  input: BanAccountInput,
  actor: UserRecord,
): Promise<AdminAccount> {
  const target = await userStore.findById(id);
  if (!target) throw HttpError.notFound(`No account found with id "${id}".`);

  assertOutranks(actor, target, 'suspend');

  // `'infinity'` is a real timestamptz value in Postgres, so permanent bans need
  // no separate column and no special case on read.
  const until = input.permanent
    ? 'infinity'
    : new Date(Date.now() + (input.durationDays as number) * 24 * 60 * 60 * 1000).toISOString();

  const banned = await userStore.banUser(id, until, input.reason, actor.id);
  if (!banned) throw HttpError.notFound(`No account found with id "${id}".`);

  const [certificates, teamCounts] = await Promise.all([
    certificateStore.countVerified(id),
    teamStore.teamCountsFor([id]),
  ]);
  return toAdminAccount(banned, certificates, teamCounts.get(id) ?? 0);
}

export async function unbanAccount(id: string, actor: UserRecord): Promise<AdminAccount> {
  const target = await userStore.findById(id);
  if (!target) throw HttpError.notFound(`No account found with id "${id}".`);

  // Lifting a ban is the safe direction, but it still must not be a way to
  // reach up the hierarchy.
  assertOutranks(actor, target, 'reinstate');

  const restored = await userStore.unbanUser(id);
  if (!restored) throw HttpError.notFound(`No account found with id "${id}".`);

  const [certificates, teamCounts] = await Promise.all([
    certificateStore.countVerified(id),
    teamStore.teamCountsFor([id]),
  ]);
  return toAdminAccount(restored, certificates, teamCounts.get(id) ?? 0);
}

/**
 * Erases an account and everything attached to it.
 *
 * Admin-only: a ban is reversible and a deletion is not, so the irreversible
 * one sits a tier higher. The caller must also retype the account's email,
 * which no misclick produces.
 */
export async function deleteAccount(
  id: string,
  input: DeleteAccountInput,
  actor: UserRecord,
): Promise<{ email: string }> {
  if (!atLeast(actor.accountRole, 'admin')) {
    throw HttpError.forbidden('Only an admin can delete an account.');
  }

  const target = await userStore.findById(id);
  if (!target) throw HttpError.notFound(`No account found with id "${id}".`);

  assertOutranks(actor, target, 'delete');

  if (input.confirmEmail !== target.email) {
    throw HttpError.badRequest(
      'That email does not match this account. Deletion was not carried out.',
      [{ field: 'confirmEmail', message: `Type ${target.email} exactly to confirm.` }],
    );
  }

  const removed = await userStore.deleteUser(id);
  if (!removed) throw HttpError.notFound(`No account found with id "${id}".`);

  // The one piece of their data that is not in Postgres, so not covered by the
  // cascade. Failure here leaves an orphaned file, not a half-deleted account.
  if (removed.avatarPath) void deleteAvatar(removed.avatarPath);

  return { email: removed.email };
}
