import { createApp } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { assertDatabaseConnection, closePool } from './db/pool.js';
import { ensureAvatarBucket } from './services/storage.js';

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

// Creating the avatar bucket is idempotent and non-fatal: an unconfigured or
// unreachable storage service must not stop the API from serving everything
// that does not involve images.
await ensureAvatarBucket();

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`\n  TapTim API ready`);
  console.log(`  • REST      http://localhost:${env.port}/api`);
  console.log(`  • Swagger   http://localhost:${env.port}/api/docs`);
  console.log(`  • Health    http://localhost:${env.port}/health`);
  console.log(`  • Env       ${env.nodeEnv}`);
  console.log(
    `  • Verifier  ${env.anthropicApiKey ? `LLM (${env.certVerifierModel})` : 'rule-based (no ANTHROPIC_API_KEY)'}`,
  );
  // Each integration reports itself at boot, so a missing key is obvious here
  // rather than at the moment somebody first tries to use the feature.
  console.log(
    `  • Email     ${env.mail.configured ? 'Resend' : 'not configured — confirmation links print to this log'}`,
  );
  console.log(
    `  • OAuth     ${
      [
        env.oauth.google.configured ? 'Google' : null,
        env.oauth.linkedin.configured ? 'LinkedIn' : null,
      ]
        .filter(Boolean)
        .join(', ') || 'none configured'
    }`,
  );
  console.log(
    `  • Avatars   ${env.storage.configured ? `Supabase Storage (${env.storage.bucket})` : 'not configured'}\n`,
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
