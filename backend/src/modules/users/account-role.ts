/**
 * Site roles — what someone is allowed to do on TapTim.
 *
 * Not to be confused with `TEAM_ROLES`, which is the profession a
 * participant practises on a team. Nothing in the matching engine reads this
 * file, and nothing in the console reads that one.
 */
export const ACCOUNT_ROLES = ['user', 'moderator', 'admin'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

/**
 * Roles are ordered, so a permission check is a comparison rather than a list
 * of equality tests that has to be revisited every time a tier is added.
 */
const RANK: Record<AccountRole, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
};

export function rankOf(role: AccountRole): number {
  return RANK[role] ?? 0;
}

export function atLeast(role: AccountRole, minimum: AccountRole): boolean {
  return rankOf(role) >= rankOf(minimum);
}

/** Anyone who can open the admin console at all. */
export function isStaff(role: AccountRole): boolean {
  return atLeast(role, 'moderator');
}

/**
 * What each tier can actually do. Written out so the console can describe
 * itself honestly rather than showing controls that turn out to 403.
 */
export const ROLE_CAPABILITIES: Record<AccountRole, readonly string[]> = {
  user: ['Build a profile, join and run teams, submit certificates.'],
  moderator: [
    'Everything a user can do.',
    'Open the admin console and see every account.',
    'Delete any team or any organiser-created event, regardless of who owns it.',
  ],
  admin: [
    'Everything a moderator can do.',
    'Change any account’s site role, including promoting other admins.',
  ],
};
