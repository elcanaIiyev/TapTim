import { z } from 'zod';
import {
  AVAILABILITY_SLOTS,
  EXPERIENCE_LEVELS,
  PERSONALITY_TRAITS,
  PRIMARY_ROLES,
} from './user.model.js';

const skillList = z
  .array(z.string().trim().min(1, 'A skill cannot be empty.').max(40))
  .max(20, 'Keep the list to 20 skills or fewer.');

const optionalUrl = z
  .string()
  .trim()
  .url('Provide a full URL including https://')
  .max(200)
  .nullable();

/**
 * Working-style answers. Each trait is scored 1–5; omitting one leaves it
 * unknown rather than defaulting it, so a half-filled profile is scored as
 * partially unknown instead of averaged into the middle.
 */
export const personalitySchema = z.object(
  Object.fromEntries(
    PERSONALITY_TRAITS.map((trait) => [
      trait,
      z
        .number()
        .int(`${trait} must be a whole number.`)
        .min(1, `${trait} must be between 1 and 5.`)
        .max(5, `${trait} must be between 1 and 5.`)
        .optional(),
    ]),
  ) as Record<(typeof PERSONALITY_TRAITS)[number], z.ZodOptional<z.ZodNumber>>,
);

export const updateProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters.')
      .max(80, 'Full name must be at most 80 characters.'),
    primaryRole: z.enum(PRIMARY_ROLES, {
      errorMap: () => ({ message: `Primary role must be one of: ${PRIMARY_ROLES.join(', ')}` }),
    }),
    skills: skillList,
    bio: z.string().trim().max(600, 'Bio must be at most 600 characters.').nullable(),
    avatarUrl: optionalUrl,
    experienceLevel: z.enum(EXPERIENCE_LEVELS, {
      errorMap: () => ({ message: `Experience must be one of: ${EXPERIENCE_LEVELS.join(', ')}` }),
    }),
    availability: z
      .array(
        z.enum(AVAILABILITY_SLOTS, {
          errorMap: () => ({ message: `Availability slots must be from: ${AVAILABILITY_SLOTS.join(', ')}` }),
        }),
      )
      .max(AVAILABILITY_SLOTS.length),
    hoursPerWeek: z
      .number()
      .int('Hours per week must be a whole number.')
      .min(0)
      .max(80, 'Hours per week must be 80 or fewer.')
      .nullable(),
    timezoneOffset: z
      .number()
      .int('Timezone offset must be a whole number of hours.')
      .min(-12)
      .max(14)
      .nullable(),
    personality: personalitySchema,
    lookingForTeam: z.boolean(),
    githubUrl: optionalUrl,
    linkedinUrl: optionalUrl,
    portfolioUrl: optionalUrl,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  primaryRole: z.enum(PRIMARY_ROLES).optional(),
  experienceLevel: z.enum(EXPERIENCE_LEVELS).optional(),
  // Repeatable query params arrive as a string or an array of strings; a single
  // comma-joined value is accepted too so `?skills=React,Node` works.
  skills: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) =>
      value === undefined
        ? undefined
        : (Array.isArray(value) ? value : value.split(','))
            .map((entry) => entry.trim())
            .filter(Boolean),
    ),
  availability: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) =>
      value === undefined
        ? undefined
        : (Array.isArray(value) ? value : value.split(','))
            .map((entry) => entry.trim())
            .filter(Boolean),
    ),
  lookingForTeam: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  verified: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
