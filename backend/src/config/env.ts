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
   * Optional. When present, certificate verification calls an LLM instead of
   * falling back to the deterministic rule-based verifier.
   */
  ANTHROPIC_API_KEY: z.string().optional(),
  CERT_VERIFIER_MODEL: z.string().default('claude-opus-5'),

  /**
   * Where the SPA lives. OAuth callbacks and email links bounce back here, so
   * it has to be the browser-facing origin, not the API's.
   */
  APP_URL: z.string().url().default('http://localhost:5173'),

  // -- Email (Resend) --------------------------------------------------------
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('TapTim <onboarding@resend.dev>'),

  /**
   * Whether a new account has to confirm its address before it can be used.
   *
   * Off by default, and that default is the honest one for how this is
   * currently deployed: Resend's shared `onboarding@resend.dev` sender only
   * delivers to the account that owns the API key, so with it on, every signup
   * but one lands on a "check your inbox" screen for a message that will never
   * arrive. A gate that locks out everybody except the developer is worse than
   * no gate.
   *
   * Turn it on by verifying a domain in Resend, pointing `MAIL_FROM` at it, and
   * setting this to `true`. Nothing else needs to change — the tokens, the
   * mailer, the confirmation page and `/api/auth/verify-email` all stay wired
   * up and keep working while it is off.
   */
  REQUIRE_EMAIL_VERIFICATION: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  // -- OAuth -----------------------------------------------------------------
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),

  // -- Supabase Storage (avatars) -------------------------------------------
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_AVATAR_BUCKET: z.string().default('avatars'),
});

/**
 * An empty variable means "not set", not "set to the empty string".
 *
 * `.env` templates ship keys with nothing after the `=` so people can see what
 * exists and fill in what they need. Zod sees `''` as a present value, so
 * `SUPABASE_URL=` would fail `.url()` and take the whole server down over an
 * integration nobody asked for. Dropping blanks first makes `.optional()` and
 * `.default()` behave the way the file reads.
 */
function withoutBlanks(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );
}

const parsed = envSchema.safeParse(withoutBlanks(process.env));

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
  appUrl: raw.APP_URL.replace(/\/$/, ''),

  /**
   * Each integration is optional and reports its own readiness, so the API
   * boots without any of them and the features that need one fail with a
   * specific "not configured" message instead of a generic 500.
   */
  mail: {
    apiKey: raw.RESEND_API_KEY?.trim() || null,
    from: raw.MAIL_FROM,
    get configured() {
      return this.apiKey !== null;
    },
    /** See `REQUIRE_EMAIL_VERIFICATION` above for why this defaults to off. */
    requireVerification: raw.REQUIRE_EMAIL_VERIFICATION,
  },

  oauth: {
    google: {
      clientId: raw.GOOGLE_CLIENT_ID?.trim() || null,
      clientSecret: raw.GOOGLE_CLIENT_SECRET?.trim() || null,
      get configured() {
        return this.clientId !== null && this.clientSecret !== null;
      },
    },
    linkedin: {
      clientId: raw.LINKEDIN_CLIENT_ID?.trim() || null,
      clientSecret: raw.LINKEDIN_CLIENT_SECRET?.trim() || null,
      get configured() {
        return this.clientId !== null && this.clientSecret !== null;
      },
    },
  },

  storage: {
    url: raw.SUPABASE_URL?.replace(/\/$/, '') || null,
    serviceRoleKey: raw.SUPABASE_SERVICE_ROLE_KEY?.trim() || null,
    bucket: raw.SUPABASE_AVATAR_BUCKET,
    get configured() {
      return this.url !== null && this.serviceRoleKey !== null;
    },
  },
} as const;

if (env.isProduction && env.jwtSecret === 'dev-only-secret-change-me') {
  throw new Error('JWT_SECRET must be set to a unique value in production.');
}
