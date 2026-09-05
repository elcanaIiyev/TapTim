import { z } from 'zod';
import {
  EVENT_DOMAINS,
  EVENT_FORMATS,
  EVENT_MODES,
  MAX_EVENT_DOMAINS,
} from './event.model.js';

export const listEventsQuerySchema = z.object({
  format: z
    .union([z.enum(EVENT_FORMATS), z.literal('All')])
    .optional()
    .default('All'),
  // Repeatable, or comma-joined. Matches any of them, so "Design,Web3" asks for
  // everything touching either rather than only events that are both.
  domains: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) =>
      value === undefined
        ? undefined
        : (Array.isArray(value) ? value : value.split(','))
            .map((entry) => entry.trim())
            .filter(Boolean),
    ),
  search: z.string().trim().max(80).optional(),
  mode: z.enum(EVENT_MODES).optional(),
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const isoDate = z
  .string()
  .datetime({ offset: true, message: 'Provide an ISO-8601 date-time, e.g. 2026-09-12T09:00:00Z.' });

const eventFields = z.object({
  name: z.string().trim().min(3, 'Name must be at least 3 characters.').max(120),
  description: z
    .string()
    .trim()
    .min(20, 'Description must be at least 20 characters.')
    .max(2000),
  format: z.enum(EVENT_FORMATS, {
    errorMap: () => ({ message: `Format must be one of: ${EVENT_FORMATS.join(', ')}` }),
  }),
  domains: z
    .array(
      z.enum(EVENT_DOMAINS, {
        errorMap: () => ({ message: `Domains must be from: ${EVENT_DOMAINS.join(', ')}` }),
      }),
    )
    .min(1, 'Pick at least one domain — it is what participants filter on.')
    .max(MAX_EVENT_DOMAINS, `Pick at most ${MAX_EVENT_DOMAINS} domains.`)
    .transform((entries) => [...new Set(entries)]),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  startDate: isoDate,
  endDate: isoDate,
  location: z.string().trim().min(2).max(120),
  mode: z.enum(EVENT_MODES, {
    errorMap: () => ({ message: `Mode must be one of: ${EVENT_MODES.join(', ')}` }),
  }),
  teamSize: z.object({
    min: z.number().int().min(1, 'Minimum team size must be at least 1.').max(12),
    max: z.number().int().min(1).max(12),
  }),
  prizePool: z.string().trim().max(60).nullable().default(null),
  registrationDeadline: isoDate,
  participants: z.number().int().min(0).default(0),
  featured: z.boolean().default(false),
});

/**
 * Cross-field rules shared by create and update. They are expressed against a
 * partial so the same checks apply to a PATCH that supplies only one side of a
 * pair; a half-supplied pair is validated against the stored value in the
 * service, where the other half is known.
 */
function applyDateRules<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .superRefine((value: Record<string, unknown>, ctx: z.RefinementCtx) => {
      const start = typeof value.startDate === 'string' ? Date.parse(value.startDate) : null;
      const end = typeof value.endDate === 'string' ? Date.parse(value.endDate) : null;
      const deadline =
        typeof value.registrationDeadline === 'string'
          ? Date.parse(value.registrationDeadline)
          : null;

      if (start !== null && end !== null && end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'End date must be on or after the start date.',
        });
      }
      if (start !== null && deadline !== null && deadline > start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['registrationDeadline'],
          message: 'Registration must close on or before the start date.',
        });
      }

      const teamSize = value.teamSize as { min?: number; max?: number } | undefined;
      if (teamSize?.min !== undefined && teamSize.max !== undefined && teamSize.max < teamSize.min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['teamSize', 'max'],
          message: 'Maximum team size must be at least the minimum.',
        });
      }
    });
}

export const createEventSchema = applyDateRules(eventFields);

export const updateEventSchema = applyDateRules(
  eventFields.partial().refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  }),
);

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
