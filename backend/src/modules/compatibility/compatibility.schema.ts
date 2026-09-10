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

/**
 * A roster to try out: two to eight participants against one event.
 *
 * Nobody has to be on a team or have agreed to anything; nothing is written.
 * Eight is where a pairwise matrix (28 cells) stops being readable at a glance.
 */
export const labSchema = z.object({
  eventId: z.string().trim().min(1, 'Pick an event.').max(64),
  userIds: z
    .array(z.string().uuid('Participant ids must be UUIDs.'))
    .min(2, 'Add at least two people.')
    .max(8, 'The lab compares at most eight people at once.'),
});

export type CompatibilityInput = z.infer<typeof compatibilitySchema>;
export type LabInput = z.infer<typeof labSchema>;
export type MatchesQuery = z.infer<typeof matchesQuerySchema>;
