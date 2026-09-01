import { createApp } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { assertDatabaseConnection, closePool } from './db/pool.js';

/**
 * Boot order matters: the database is checked and migrated *before* the port is
 * opened, so the API never accepts a request it cannot serve. A bad
 * DATABASE_URL fails here with a readable message instead of turning every
 * endpoint into a 500.
 */
try {
  await assertDatabaseConnection();
} catch (error) {
  console.error('\n  Could not connect to the database.');
  console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  console.error('\n  Check DATABASE_URL in backend/.env — it should be the Supabase');
  console.error('  connection string from Project Settings → Database.\n');
  process.exit(1);
}

const applied = await runMigrations();
for (const file of applied) {
  console.log(`  [migrate] applied ${file}`);
}

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`\n  TapTim API ready`);
  console.log(`  • REST      http://localhost:${env.port}/api`);
  console.log(`  • Swagger   http://localhost:${env.port}/api/docs`);
  console.log(`  • Health    http://localhost:${env.port}/health`);
  console.log(`  • Env       ${env.nodeEnv}`);
  console.log(
    `  • Verifier  ${env.anthropicApiKey ? `Claude (${env.certVerifierModel})` : 'rule-based (no ANTHROPIC_API_KEY)'}\n`,
  );
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} received, shutting down.`);
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
  });
}
