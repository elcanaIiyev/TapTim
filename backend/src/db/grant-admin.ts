import { userStore } from '../data/user.store.js';
import { ACCOUNT_ROLES, type AccountRole } from '../modules/users/account-role.js';
import { closePool } from './pool.js';

/**
 * Sets an account's site role from the command line.
 *
 *   npm run admin:grant  --workspace backend -- ada@taptim.dev
 *   npm run admin:grant  --workspace backend -- ada@taptim.dev moderator
 *   npm run admin:revoke --workspace backend -- ada@taptim.dev
 *
 * This exists because authority cannot be granted over the API: the console
 * needs an admin to sign in, and a brand-new database has none. Running it
 * requires shell access to the machine holding `DATABASE_URL`, which is the
 * right bar for creating the first admin. After that, admins promote each other
 * from the console.
 *
 * Unlike the console, this deliberately skips the last-admin guard — it is the
 * escape hatch, and it can grant access back.
 */

const [, , emailArg, roleArg] = process.argv;
const revoking = process.env.npm_lifecycle_event === 'admin:revoke' || roleArg === '--revoke';

function targetRole(): AccountRole | null {
  if (revoking) return 'user';
  if (!roleArg) return 'admin';
  return ACCOUNT_ROLES.includes(roleArg as AccountRole) ? (roleArg as AccountRole) : null;
}

async function main(): Promise<void> {
  if (!emailArg) {
    console.error('Usage: npm run admin:grant --workspace backend -- <email> [role]');
    console.error(`       role is one of: ${ACCOUNT_ROLES.join(', ')} (default: admin)`);
    process.exitCode = 1;
    return;
  }

  const role = targetRole();
  if (!role) {
    console.error(`"${roleArg}" is not a site role. Use one of: ${ACCOUNT_ROLES.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const email = emailArg.trim().toLowerCase();
  const user = await userStore.findByEmail(email);

  if (!user) {
    console.error(`No account found for ${email}. Sign up first, then run this again.`);
    process.exitCode = 1;
    return;
  }

  if (user.accountRole === role) {
    console.log(`${email} is already "${role}". Nothing to do.`);
    return;
  }

  // Recoverable — this same script grants it back — so a warning, not a refusal.
  if (user.accountRole === 'admin' && role !== 'admin' && (await userStore.countAdmins()) <= 1) {
    console.warn('Warning: this was the last admin. Nobody can reach the console until');
    console.warn('you run `npm run admin:grant --workspace backend -- <email>` again.');
  }

  await userStore.setAccountRole(user.id, role);
  console.log(`${user.fullName} (${email}): ${user.accountRole} -> ${role}`);

  const counts = await userStore.countByRole();
  console.log(
    `Now ${counts.admin ?? 0} admin, ${counts.moderator ?? 0} moderator, ${counts.user ?? 0} user.`,
  );
}

try {
  await main();
} catch (error) {
  console.error('Failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closePool();
}
