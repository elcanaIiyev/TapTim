import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool, pool, withTransaction } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * `tsx` runs this straight from `src`, while `npm start` runs the compiled copy
 * from `dist`. The build step copies the .sql files across, but falling back to
 * the source tree keeps `dist` usable even if that step is skipped.
 */
function migrationsDir(): string {
  const candidates = [join(here, 'migrations'), resolve(here, '../../src/db/migrations')];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`No migrations directory found. Looked in:\n  ${candidates.join('\n  ')}`);
  }
  return found;
}

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    create table if not exists _migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

export async function runMigrations(): Promise<string[]> {
  await ensureMigrationsTable();

  const dir = migrationsDir();
  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();

  const applied = new Set(
    (await pool.query<{ name: string }>('select name from _migrations')).rows.map((r) => r.name),
  );

  const executed: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await readFile(join(dir, file), 'utf8');

    // Each file is one transaction: a failure half-way leaves the schema
    // untouched and the migration unrecorded, so a fixed file can be re-run.
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('insert into _migrations (name) values ($1)', [file]);
    });

    executed.push(file);
  }

  return executed;
}

// Allow `npm run db:migrate` to drive this directly.
const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]).replace(/\.[tj]s$/, '') === resolve(here, 'migrate');

if (invokedDirectly) {
  try {
    const executed = await runMigrations();
    if (executed.length === 0) {
      console.log('[migrate] Schema already up to date.');
    } else {
      for (const file of executed) console.log(`[migrate] applied ${file}`);
    }
  } catch (error) {
    console.error('[migrate] failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
