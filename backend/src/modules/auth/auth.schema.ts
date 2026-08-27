import { z } from 'zod';
import { PRIMARY_ROLES } from '../users/user.model.js';

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email('Provide a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must be at most 128 characters.'),
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters.')
    .max(80, 'Full name must be at most 80 characters.'),
  primaryRole: z.enum(PRIMARY_ROLES, {
    errorMap: () => ({ message: `Primary role must be one of: ${PRIMARY_ROLES.join(', ')}` }),
  }),
  skills: z.array(z.string().trim().min(1)).max(20).optional().default([]),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Provide a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
