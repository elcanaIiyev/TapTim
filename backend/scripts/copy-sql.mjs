import { cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `tsc` only emits JavaScript, so the .sql migration files it walks past never
// reach `dist`. Without this the compiled server can only migrate by falling
// back to the source tree, which is not there in a deployed build.
const backendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const from = join(backendRoot, 'src', 'db', 'migrations');
const to = join(backendRoot, 'dist', 'db', 'migrations');

if (!existsSync(from)) {
  console.error(`[copy-sql] No migrations directory at ${from}`);
  process.exit(1);
}

cpSync(from, to, { recursive: true });
console.log(`[copy-sql] migrations -> ${to}`);
