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

/**
 * A suspension. Either a duration in days, or explicitly permanent — never
 * both, and never neither, so "banned but for how long?" cannot be ambiguous.
 */
export const banAccountSchema = z
  .object({
    permanent: z.boolean().default(false),
    durationDays: z
      .number()
      .int('Give a whole number of days.')
      .min(1, 'A suspension lasts at least a day.')
      .max(3650, 'Use a permanent ban rather than ten years.')
      .optional(),
    // Required, not optional: the reason is shown to the person when they try
    // to sign in, and "suspended, no reason given" is not something anyone
    // should be able to issue by accident.
    reason: z
      .string()
      .trim()
      .min(3, 'Give a reason — the person is shown it when they try to sign in.')
      .max(300),
  })
  .refine((value) => value.permanent || value.durationDays !== undefined, {
    message: 'Set a duration in days, or mark the ban permanent.',
    path: ['durationDays'],
  })
  .refine((value) => !(value.permanent && value.durationDays !== undefined), {
    message: 'A permanent ban has no duration.',
    path: ['durationDays'],
  });

/**
 * Deleting an account is irreversible and takes everything with it, so the
 * caller has to type the email back. A stray click on the wrong row cannot
 * satisfy this.
 */
export const deleteAccountSchema = z.object({
  confirmEmail: z.string().trim().toLowerCase().email('Type the account email to confirm.'),
});

export type BanAccountInput = z.infer<typeof banAccountSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
