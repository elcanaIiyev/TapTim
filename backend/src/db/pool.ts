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

/**
 * True inside a Vercel serverless function.
 *
 * The distinction matters because the two runtimes want opposite things from a
 * pool. A long-lived server wants a warm set of connections shared by many
 * concurrent requests. A serverless instance handles exactly one request at a
 * time and there may be hundreds of instances, so every connection it holds is
 * one more against Supabase's ceiling and one that nothing else can use while
 * the instance sits frozen between invocations.
 */
const isServerless = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

function sslConfig() {
  if (env.databaseSsl === 'disable') return false;
  // Supabase's pooler presents a certificate signed by its own CA. Verifying
  // the chain requires shipping that root cert; `no-verify` keeps the traffic
  // encrypted without it, which is the documented client default.
  return { rejectUnauthorized: env.databaseSsl === 'require' };
}

function poolConfig(): pg.PoolConfig {
  const base: pg.PoolConfig = {
    connectionString: env.databaseUrl,
    ssl: sslConfig(),
    connectionTimeoutMillis: 15_000,
  };

  if (!isServerless) {
    return { ...base, max: env.databasePoolMax, idleTimeoutMillis: 30_000 };
  }

  return {
    ...base,
    // One. An instance serves one request at a time, so a second connection
    // could only ever sit idle, and idle connections here are not free — they
    // are held against the project's limit while the instance is frozen.
    max: 1,
    // Hand the connection back to Supavisor quickly. A frozen instance cannot
    // run timers, so this fires on the next invocation; the point is that a
    // burst of traffic followed by a lull does not pin one connection per
    // instance indefinitely.
    idleTimeoutMillis: 10_000,
    // Let the event loop drain so the runtime can freeze or exit the instance
    // instead of being held open by a pooled socket.
    allowExitOnIdle: true,
  };
}

/**
 * The pool is cached on `globalThis` rather than held in a module binding.
 *
 * Two reasons, one per runtime. On Vercel a warm instance re-uses the module
 * registry across invocations, and this makes that reuse explicit and
 * survivable if the module is ever evaluated twice. In `tsx watch`, a reload
 * re-evaluates the module graph, and without this every save would leak a pool
 * and its sockets until the connection limit was reached.
 */
const POOL_KEY = Symbol.for('taptim.pg.pool');
type PoolGlobal = typeof globalThis & { [POOL_KEY]?: pg.Pool };
const poolGlobal = globalThis as PoolGlobal;

function createPool(): pg.Pool {
  const created = new Pool(poolConfig());

  created.on('error', (error) => {
    // A pooled connection can be dropped by Supabase while it sits idle. The
    // pool discards it and opens a new one on the next checkout; crashing the
    // process over it would be wrong.
    console.error('[db] idle client error:', error.message);
  });

  return created;
}

/**
 * Created on first use, not at import time.
 *
 * A serverless cold start imports this module to answer a request that may not
 * touch the database at all — a redirect, a 401 from the auth middleware, the
 * OpenAPI document. Connecting eagerly would put a TCP and TLS handshake in
 * front of those for nothing.
 */
export function getPool(): pg.Pool {
  poolGlobal[POOL_KEY] ??= createPool();
  return poolGlobal[POOL_KEY];
}

/**
 * Kept as a property-style export so the `pool.query(...)` call sites that
 * predate lazy construction keep working unchanged.
 */
export const pool = {
  query: <T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) =>
    getPool().query<T>(text, params),
  connect: () => getPool().connect(),
};

/** Runs a parameterised query and returns the rows. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params as unknown[]);
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
 *
 * This works against Supabase's transaction pooler as well as the session
 * pooler: transaction mode assigns a server connection for the span of the
 * transaction, which is exactly the guarantee the `select ... for update` in
 * `setAccountRoleGuarded` depends on. What transaction mode does not support is
 * named prepared statements, and `pg` only issues those when a query is given a
 * `name`, which nothing here does.
 */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
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
  const existing = poolGlobal[POOL_KEY];
  if (!existing) return;
  poolGlobal[POOL_KEY] = undefined;
  await existing.end();
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
