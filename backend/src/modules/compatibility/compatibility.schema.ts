import { z } from 'zod';

/**
 * Two participants to compare. Passing a single id scores that person against
 * the caller, which is what the profile page needs; passing two scores any
 * pair, which is what a team owner comparing candidates needs.
 */
export const compatibilitySchema = z.object({
  userIds: z
    .array(z.string().uuid('Participant ids must be UUIDs.'))
    .min(1, 'Provide one or two participant ids.')
    .max(2, 'Compatibility is scored between two participants.'),
});

export const matchesQuerySchema = z.object({
  /** Restricts candidates to people not yet on a team for this event. */
  eventId: z.string().trim().max(64).optional(),
  roles: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) =>
      value === undefined
        ? undefined
        : (Array.isArray(value) ? value : value.split(','))
            .map((entry) => entry.trim())
            .filter(Boolean),
    ),
  minScore: z.coerce.number().int().min(0).max(100).optional().default(0),
  limit: z.coerce.number().int().min(1).max(25).optional().default(10),
});

export type CompatibilityInput = z.infer<typeof compatibilitySchema>;
export type MatchesQuery = z.infer<typeof matchesQuerySchema>;
