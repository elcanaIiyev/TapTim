import { z } from 'zod';
import { ACCOUNT_ROLES } from '../users/account-role.js';

export const listAccountsQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  /** Site role — user, moderator, or admin. */
  accountRole: z.enum(ACCOUNT_ROLES).optional(),
  verified: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  staffOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * What staff may change about someone else's account: the site role, and
 * nothing else.
 *
 * Profession, skills, bio, and availability are all profile data — the
 * participant's own description of themselves — and are no more an
 * administrator's to rewrite than their skill list is. The console is about
 * authority, not about editing people's profiles.
 */
export const updateAccountSchema = z.object({
  accountRole: z.enum(ACCOUNT_ROLES, {
    errorMap: () => ({ message: `Site role must be one of: ${ACCOUNT_ROLES.join(', ')}` }),
  }),
});

export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
