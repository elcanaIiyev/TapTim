import { z } from 'zod';
import { MAX_TEAM_ROLES, TEAM_ROLES } from '../users/user.model.js';

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `${label} must be at least 2 characters.`)
    .max(40, `${label} must be at most 40 characters.`)
    // Letters, marks, spaces, apostrophes and hyphens. Deliberately Unicode
    // aware: "Əliyev", "O'Brien" and "Mammadov-Quliyev" are all real names.
    .regex(/^[\p{L}\p{M}][\p{L}\p{M}\s'’-]*$/u, `${label} contains characters that are not allowed.`);

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email('Provide a valid email address.')
  .max(160);

/**
 * Password rules, stated as separate checks so the UI can show a live checklist
 * rather than one lump error. Length does most of the work — a 12-character
 * passphrase beats an 8-character one with a symbol bolted on — so the
 * composition rules stay light.
 */
export const passwordField = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(128, 'Passwords must be at most 128 characters.')
  .regex(/[a-z]/, 'Include a lower-case letter.')
  .regex(/[A-Z]/, 'Include an upper-case letter.')
  .regex(/[0-9]/, 'Include a number.');

export const signupSchema = z.object({
  firstName: name('First name'),
  lastName: name('Last name').optional(),
  email: emailField,
  password: passwordField,
  roles: z
    .array(
      z.enum(TEAM_ROLES, {
        errorMap: () => ({ message: `Roles must be from: ${TEAM_ROLES.join(', ')}` }),
      }),
    )
    .min(1, 'Pick at least one role.')
    .max(MAX_TEAM_ROLES, `Pick at most ${MAX_TEAM_ROLES} roles.`)
    // The profile builder asks properly during onboarding; signup should not
    // stall on a choice somebody has not thought about yet.
    .optional()
    .default(['Full-Stack Developer']),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required.'),
});

/** Step 1 of signup: check an address is free before asking for a password. */
export const checkEmailSchema = z.object({ email: emailField });

export const verifyEmailSchema = z.object({
  token: z.string().min(10, 'That confirmation link is not valid.').max(200),
});

export const resendVerificationSchema = z.object({ email: emailField });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CheckEmailInput = z.infer<typeof checkEmailSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
