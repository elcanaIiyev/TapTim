import { createHash, randomBytes } from 'node:crypto';
import { query, queryOne } from '../db/pool.js';
import { toIso } from '../utils/dates.js';

/**
 * Email confirmation tokens and OAuth identities.
 *
 * Both are "how does this person prove who they are" rather than profile data,
 * so they live together and away from `user.store`.
 */

/** How long a confirmation link stays usable. */
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Only the hash is ever stored.
 *
 * A confirmation token is a bearer credential: anyone holding it can confirm
 * that address. Storing it in plaintext means a database dump hands out working
 * links, so the row keeps a SHA-256 and the raw value exists only in the email.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface VerificationToken {
  /** The raw token — returned once, at creation, and never readable again. */
  token: string;
  expiresAt: string;
}

export interface OAuthIdentity {
  provider: 'google' | 'linkedin';
  providerAccountId: string;
  userId: string;
  email: string | null;
  profileUrl: string | null;
  createdAt: string;
}

interface OAuthIdentityRow {
  provider: string;
  provider_account_id: string;
  user_id: string;
  email: string | null;
  profile_url: string | null;
  created_at: Date;
}

function mapIdentity(row: OAuthIdentityRow): OAuthIdentity {
  return {
    provider: row.provider as 'google' | 'linkedin',
    providerAccountId: row.provider_account_id,
    userId: row.user_id,
    email: row.email,
    profileUrl: row.profile_url,
    createdAt: toIso(row.created_at),
  };
}

class IdentityStore {
  // -- email confirmation ---------------------------------------------------

  /**
   * Issues a fresh confirmation token, invalidating any earlier unused one for
   * the same account so a forwarded older email cannot still be used.
   */
  async createVerificationToken(userId: string, email: string): Promise<VerificationToken> {
    await query(
      `update email_verification_tokens set consumed_at = now()
       where user_id = $1 and consumed_at is null`,
      [userId],
    );

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    await query(
      `insert into email_verification_tokens (token_hash, user_id, email, expires_at)
       values ($1, $2, $3, $4)`,
      [hashToken(token), userId, email.toLowerCase(), expiresAt],
    );

    return { token, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Spends a token, returning the account it belonged to.
   *
   * The update is the check: `consumed_at is null and expires_at > now()` in
   * the WHERE clause means two simultaneous clicks on the same link cannot both
   * succeed, which a read-then-write would allow.
   */
  async consumeVerificationToken(token: string): Promise<{ userId: string; email: string } | null> {
    const row = await queryOne<{ user_id: string; email: string }>(
      `update email_verification_tokens
          set consumed_at = now()
        where token_hash = $1 and consumed_at is null and expires_at > now()
        returning user_id, email`,
      [hashToken(token)],
    );
    return row ? { userId: row.user_id, email: row.email } : null;
  }

  // -- OAuth ----------------------------------------------------------------

  async findIdentity(provider: string, providerAccountId: string): Promise<OAuthIdentity | null> {
    const row = await queryOne<OAuthIdentityRow>(
      `select provider, provider_account_id, user_id, email, profile_url, created_at
         from oauth_identities where provider = $1 and provider_account_id = $2`,
      [provider, providerAccountId],
    );
    return row ? mapIdentity(row) : null;
  }

  async listIdentitiesFor(userId: string): Promise<OAuthIdentity[]> {
    const rows = await query<OAuthIdentityRow>(
      `select provider, provider_account_id, user_id, email, profile_url, created_at
         from oauth_identities where user_id = $1 order by provider`,
      [userId],
    );
    return rows.map(mapIdentity);
  }

  async linkIdentity(input: {
    provider: string;
    providerAccountId: string;
    userId: string;
    email: string | null;
    profileUrl: string | null;
  }): Promise<OAuthIdentity> {
    const row = await queryOne<OAuthIdentityRow>(
      `insert into oauth_identities (provider, provider_account_id, user_id, email, profile_url)
       values ($1, $2, $3, $4, $5)
       on conflict (provider, provider_account_id)
         do update set email = excluded.email, profile_url = excluded.profile_url
       returning provider, provider_account_id, user_id, email, profile_url, created_at`,
      [input.provider, input.providerAccountId, input.userId, input.email, input.profileUrl],
    );
    if (!row) throw new Error('Insert returned no oauth_identity row.');
    return mapIdentity(row);
  }

  async unlinkIdentity(userId: string, provider: string): Promise<boolean> {
    const rows = await query<{ provider: string }>(
      'delete from oauth_identities where user_id = $1 and provider = $2 returning provider',
      [userId, provider],
    );
    return rows.length > 0;
  }
}

export const identityStore = new IdentityStore();
