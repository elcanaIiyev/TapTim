import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment schema. Parsing happens once at import time so a misconfigured
 * deployment fails immediately at boot instead of on the first request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(8).default('dev-only-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  /**
   * Supabase Postgres connection string. Required from Sprint 2 onward — the
   * in-memory store is gone, so the API has nothing to read without it.
   */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (Supabase connection string).'),

  /**
   * Supabase terminates TLS with its own CA. `no-verify` keeps the connection
   * encrypted while skipping chain validation, which is what the pooler
   * expects from clients that do not ship the Supabase root certificate.
   */
  DATABASE_SSL: z.enum(['require', 'no-verify', 'disable']).default('no-verify'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),

  /**
   * Optional. When present, certificate verification calls Claude instead of
   * falling back to the deterministic rule-based verifier.
   */
  ANTHROPIC_API_KEY: z.string().optional(),
  CERT_VERIFIER_MODEL: z.string().default('claude-opus-5'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const raw = parsed.data;

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === 'production',
  port: raw.PORT,
  corsOrigins: raw.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: raw.JWT_SECRET,
  jwtExpiresIn: raw.JWT_EXPIRES_IN,
  databaseUrl: raw.DATABASE_URL,
  databaseSsl: raw.DATABASE_SSL,
  databasePoolMax: raw.DATABASE_POOL_MAX,
  anthropicApiKey: raw.ANTHROPIC_API_KEY?.trim() || null,
  certVerifierModel: raw.CERT_VERIFIER_MODEL,
} as const;

if (env.isProduction && env.jwtSecret === 'dev-only-secret-change-me') {
  throw new Error('JWT_SECRET must be set to a unique value in production.');
}
