import { z } from 'zod';
import { EVENT_CATEGORIES } from './event.model.js';

export const listEventsQuerySchema = z.object({
  category: z
    .union([z.enum(EVENT_CATEGORIES), z.literal('All')])
    .optional()
    .default('All'),
  search: z.string().trim().max(80).optional(),
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
