import { certificateStore } from '../../data/certificate.store.js';
import { teamStore } from '../../data/team.store.js';
import { LastAdminError, userStore } from '../../data/user.store.js';
import { HttpError } from '../../utils/http-error.js';
import { atLeast, type AccountRole } from '../users/account-role.js';
import type { UserRecord } from '../users/user.model.js';
import type { ListAccountsQuery, UpdateAccountInput } from './admin.schema.js';

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
  };
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
