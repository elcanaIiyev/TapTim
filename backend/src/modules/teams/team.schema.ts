import { z } from 'zod';
import { PRIMARY_ROLES } from '../users/user.model.js';
import { TEAM_STATUSES } from './team.model.js';

const roleList = z
  .array(
    z.enum(PRIMARY_ROLES, {
      errorMap: () => ({ message: `Roles must be from: ${PRIMARY_ROLES.join(', ')}` }),
    }),
  )
  .max(10);

const skillList = z.array(z.string().trim().min(1).max(40)).max(20);

export const createTeamSchema = z.object({
  eventId: z.string().trim().min(1, 'An event id is required.').max(64),
  name: z
    .string()
    .trim()
    .min(3, 'Team name must be at least 3 characters.')
    .max(60, 'Team name must be at most 60 characters.'),
  description: z.string().trim().max(600).nullable().default(null),
  lookingFor: roleList.default([]),
  requiredSkills: skillList.default([]),
  maxSize: z
    .number()
    .int('Team size must be a whole number.')
    .min(2, 'A team needs room for at least 2 people.')
    .max(12, 'A team can hold at most 12 people.'),
});

export const updateTeamSchema = z
  .object({
    name: z.string().trim().min(3).max(60),
    description: z.string().trim().max(600).nullable(),
    lookingFor: roleList,
    requiredSkills: skillList,
    maxSize: z.number().int().min(2).max(12),
    status: z.enum(TEAM_STATUSES, {
      errorMap: () => ({ message: `Status must be one of: ${TEAM_STATUSES.join(', ')}` }),
    }),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export const listTeamsQuerySchema = z.object({
  eventId: z.string().trim().max(64).optional(),
  status: z.enum(TEAM_STATUSES).optional(),
  lookingForRole: z.enum(PRIMARY_ROLES).optional(),
  search: z.string().trim().max(80).optional(),
  hasOpenSeats: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  /** `mine=true` narrows the list to teams the caller belongs to. */
  mine: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/** A participant asking to join a team. */
export const applyToTeamSchema = z.object({
  message: z.string().trim().max(400).nullable().default(null),
});

/** A team owner inviting a participant. */
export const inviteToTeamSchema = z.object({
  userId: z.string().uuid('Provide the UUID of the participant to invite.'),
  message: z.string().trim().max(400).nullable().default(null),
});

export const respondToRequestSchema = z.object({
  action: z.enum(['accept', 'decline', 'cancel'], {
    errorMap: () => ({ message: 'Action must be accept, decline, or cancel.' }),
  }),
});

export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid('Provide the UUID of the member to hand the team to.'),
});

export const listRequestsQuerySchema = z.object({
  kind: z.enum(['invite', 'application']).optional(),
  status: z.enum(['pending', 'accepted', 'declined', 'cancelled']).optional(),
  /** `incoming` = aimed at me or my teams; `outgoing` = raised by me. */
  direction: z.enum(['incoming', 'outgoing']).optional().default('incoming'),
});

export const suggestionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(25).optional().default(10),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>;
export type ApplyToTeamInput = z.infer<typeof applyToTeamSchema>;
export type InviteToTeamInput = z.infer<typeof inviteToTeamSchema>;
export type RespondToRequestInput = z.infer<typeof respondToRequestSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;
export type SuggestionsQuery = z.infer<typeof suggestionsQuerySchema>;
