import { z } from 'zod';
import { CERTIFICATE_STATUSES } from './certificate.model.js';

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date in YYYY-MM-DD form.')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'That is not a real date.');

export const createCertificateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters.')
    .max(140, 'Title must be at most 140 characters.'),
  issuer: z
    .string()
    .trim()
    .min(2, 'Issuer must be at least 2 characters.')
    .max(80, 'Issuer must be at most 80 characters.'),
  issuedOn: isoDay.nullable().default(null),
  credentialId: z.string().trim().max(120).nullable().default(null),
  credentialUrl: z
    .string()
    .trim()
    .url('Provide a full URL including https://')
    .max(300)
    .nullable()
    .default(null),
  skills: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

export const updateCertificateSchema = createCertificateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export const listCertificatesQuerySchema = z.object({
  status: z.enum(CERTIFICATE_STATUSES).optional(),
});

export type CreateCertificateInput = z.infer<typeof createCertificateSchema>;
export type UpdateCertificateInput = z.infer<typeof updateCertificateSchema>;
export type ListCertificatesQuery = z.infer<typeof listCertificatesQuerySchema>;
