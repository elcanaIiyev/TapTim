import pg from 'pg';
import { env } from '../config/env.js';

const { Pool, types } = pg;

// `numeric` (1700) arrives as a string to preserve arbitrary precision. Every
// numeric column in this schema is a bounded score, so a float is lossless here
// and far easier to work with than a string.
types.setTypeParser(1700, (value) => (value === null ? null : Number.parseFloat(value)));
// `date` (1082) is a calendar day with no time or zone. Letting pg build a Date
// from it would apply the server's local midnight and can shift the day across
// a timezone boundary, so keep the `YYYY-MM-DD` text exactly as stored.
types.setTypeParser(1082, (value) => value);

function sslConfig() {
  if (env.databaseSsl === 'disable') return false;
  // Supabase's pooler presents a certificate signed by its own CA. Verifying
  // the chain requires shipping that root cert; `no-verify` keeps the traffic
  // encrypted without it, which is the documented client default.
  return { rejectUnauthorized: env.databaseSsl === 'require' };
}

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: sslConfig(),
  max: env.databasePoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});

pool.on('error', (error) => {
  // A pooled connection can be dropped by Supabase while it sits idle. The
  // pool discards it and opens a new one on the next checkout; crashing the
  // process over it would be wrong.
  console.error('[db] idle client error:', error.message);
});

/** Runs a parameterised query and returns the rows. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params as unknown[]);
  return result.rows;
}

/** Runs a query expected to match at most one row. */
export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Runs `fn` inside a transaction on a dedicated client, rolling back on any
 * throw. Used wherever a write touches more than one table — creating a team
 * and its owner row, or accepting a request and inserting the membership.
 */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {
      /* the client is already broken; the outer error is the useful one */
    });
    throw error;
  } finally {
    client.release();
  }
}

/** Fails fast at boot so a bad DATABASE_URL is not discovered per-request. */
export async function assertDatabaseConnection(): Promise<void> {
  const row = await queryOne<{ version: string }>('select version() as version');
  if (!row) throw new Error('Database responded without a version row.');
}

export async function closePool(): Promise<void> {
  await pool.end();
}

/**
 * Postgres unique-violation. Stores let the database arbitrate races that an
 * application-level "does it already exist?" check cannot win, then translate
 * the violation into a 409.
 */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; constraint?: unknown };
  if (candidate.code !== '23505') return false;
  return constraint === undefined || candidate.constraint === constraint;
}
