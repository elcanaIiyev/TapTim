import { z } from 'zod';
import {
  EVENT_GOALS,
  INTEREST_DOMAINS,
  LANGUAGES,
  PRONOUN_OPTIONS,
} from './profile-options.js';
import {
  canonicaliseSkill,
  MAX_SKILLS,
  MAX_SKILL_LEVEL,
  MIN_SKILL_LEVEL,
} from './skill-catalogue.js';
import {
  AVAILABILITY_SLOTS,
  EXPERIENCE_LEVELS,
  MAX_TEAM_ROLES,
  PERSONALITY_TRAITS,
  TEAM_ROLES,
} from './user.model.js';

/**
 * A closed set of chips, e.g. the languages someone speaks.
 *
 * `z.enum` rather than free strings so the matching engine can intersect them:
 * "JS" and "JavaScript" as separate values would silently make every overlap
 * calculation wrong.
 */
function chipList<T extends readonly [string, ...string[]]>(values: T, label: string) {
  return z
    .array(z.enum(values, { errorMap: () => ({ message: `${label} must be from the offered list.` }) }))
    .max(values.length)
    // The UI toggles chips, and a double-click race can post the same value
    // twice; dedupe rather than rejecting something the person cannot see.
    .transform((entries) => [...new Set(entries)]);
}

/**
 * Skills, canonicalised against the catalogue.
 *
 * Matching against the lower-cased catalogue means "react", "React" and
 * "REACT" all land on the same stored value — without that, a set intersection
 * treats them as three different skills and every overlap score is wrong.
 */
const skillList = z
  .array(z.string().trim().min(1, 'A skill cannot be empty.').max(60))
  .max(MAX_SKILLS, `Keep the list to ${MAX_SKILLS} skills or fewer.`)
  .transform((entries, ctx) => {
    const canonical: string[] = [];
    for (const entry of entries) {
      const match = canonicaliseSkill(entry);
      if (!match) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `"${entry}" is not in the skill list.`,
        });
        continue;
      }
      if (!canonical.includes(match)) canonical.push(match);
    }
    return canonical;
  });

/** Skill -> 0..100. Keys are checked against the catalogue, same as the list. */
const skillLevelMap = z
  .record(
    z
      .number()
      .int('Proficiency must be a whole number.')
      .min(MIN_SKILL_LEVEL, `Proficiency runs ${MIN_SKILL_LEVEL} to ${MAX_SKILL_LEVEL}.`)
      .max(MAX_SKILL_LEVEL, `Proficiency runs ${MIN_SKILL_LEVEL} to ${MAX_SKILL_LEVEL}.`),
  )
  .transform((levels, ctx) => {
    const canonical: Record<string, number> = {};
    for (const [name, level] of Object.entries(levels)) {
      const match = canonicaliseSkill(name);
      if (!match) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `"${name}" is not in the skill list.`,
        });
        continue;
      }
      canonical[match] = level;
    }
    return canonical;
  });

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
    firstName: z.string().trim().min(2, 'First name must be at least 2 characters.').max(40),
    lastName: z.string().trim().max(40).nullable(),
    /**
     * Deduplicated on the way in. Two copies of the same role would make a
     * profile look broader than it is to anything that counts the array.
     */
    roles: z
      .array(
        z.enum(TEAM_ROLES, {
          errorMap: () => ({ message: `Roles must be from: ${TEAM_ROLES.join(', ')}` }),
        }),
      )
      .min(1, 'Pick at least one role — it is what teams search on.')
      .max(MAX_TEAM_ROLES, `Pick at most ${MAX_TEAM_ROLES} roles.`)
      .transform((entries) => [...new Set(entries)]),
    skills: skillList,
    skillLevels: skillLevelMap,
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

    // -- profile builder -----------------------------------------------------
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD form.')
      .refine((value) => {
        const born = Date.parse(`${value}T00:00:00Z`);
        if (Number.isNaN(born)) return false;
        const years = (Date.now() - born) / (365.2425 * 24 * 60 * 60 * 1000);
        return years >= 13 && years <= 120;
      }, 'You need to be at least 13 to use TapTim.')
      .nullable(),
    pronouns: z.enum(PRONOUN_OPTIONS).nullable(),
    locationCity: z.string().trim().max(80).nullable(),
    locationCountry: z.string().trim().max(80).nullable(),
    languages: chipList(LANGUAGES, 'Languages'),
    interestDomains: chipList(INTEREST_DOMAINS, 'Interests'),
    goals: chipList(EVENT_GOALS, 'Goals'),
    hackathonsAttended: z.number().int().min(0).max(500),
    preferredTeamSize: z.number().int().min(2).max(12).nullable(),
    discordHandle: z
      .string()
      .trim()
      .max(40)
      .regex(/^[a-zA-Z0-9._]+$/, 'Discord usernames use letters, numbers, dots and underscores.')
      .nullable(),
    /** Set once, by the tour, when the person finishes the last step. */
    onboardingCompleted: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  // Repeatable, same as `skills`: "anyone who can present or pitch".
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
