import { z } from 'zod';
import { EXPERIENCE_KINDS } from './profile-options.js';

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD form.')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'That is not a real date.');

const experienceFields = z.object({
  kind: z.enum(EXPERIENCE_KINDS, {
    errorMap: () => ({ message: `Type must be one of: ${EXPERIENCE_KINDS.join(', ')}` }),
  }),
  title: z
    .string()
    .trim()
    .min(2, 'Give it a title of at least 2 characters.')
    .max(120, 'Titles must be at most 120 characters.'),
  organisation: z.string().trim().max(120).nullable().default(null),
  startDate: isoDay.nullable().default(null),
  endDate: isoDay.nullable().default(null),
  isCurrent: z.boolean().default(false),
  description: z.string().trim().max(1000).nullable().default(null),
  url: z.string().trim().url('Provide a full URL including https://').max(300).nullable().default(null),
  skills: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

/**
 * Cross-field rules shared by create and update.
 *
 * Expressed against a partial so the same checks apply to a PATCH that supplies
 * only one side of a pair; the service compares a half-supplied pair against
 * what is already stored, where the other half is known.
 */
function applyDateRules<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value: Record<string, unknown>, ctx: z.RefinementCtx) => {
    const start = typeof value.startDate === 'string' ? Date.parse(value.startDate) : null;
    const end = typeof value.endDate === 'string' ? Date.parse(value.endDate) : null;

    if (start !== null && end !== null && end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'This cannot end before it started.',
      });
    }

    if (value.isCurrent === true && typeof value.endDate === 'string') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'Something ongoing has no end date.',
      });
    }

    if (start !== null && start > Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['startDate'],
        message: 'This starts in the future.',
      });
    }
  });
}

export const createExperienceSchema = applyDateRules(experienceFields);

export const updateExperienceSchema = applyDateRules(
  experienceFields.partial().refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  }),
);

export type CreateExperienceInput = z.infer<typeof createExperienceSchema>;
export type UpdateExperienceInput = z.infer<typeof updateExperienceSchema>;
