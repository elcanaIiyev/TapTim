/**
 * Keeps the hand-authored OpenAPI document honest.
 *
 * `src/docs/openapi.ts` is written by hand — deliberately, so the enums it
 * documents are the same constants the validators use. The cost of that choice
 * is that nothing stops a new route from going undocumented, which is exactly
 * what happened between Sprint 2 and Sprint 3: the spec sat at 36 operations
 * while the API grew to 65.
 *
 * This compares the routes the routers actually mount against the paths the
 * document declares, and fails if either side has something the other does not.
 *
 *   npm run audit:openapi --workspace backend
 *
 * It reads the routers as text rather than importing the app, so it needs no
 * database, no environment, and no running server.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES = join(BACKEND, 'src/modules');

/**
 * Where each router is mounted in `app.ts`. Hand-maintained, and deliberately
 * exhaustive: a new router with no entry here fails the audit rather than being
 * silently skipped, which would defeat the point.
 */
const MOUNTS = {
  'auth.routes.ts': '/api/auth',
  'user.routes.ts': '/api/users',
  'event.routes.ts': '/api/events',
  'team.routes.ts': '/api/teams',
  'compatibility.routes.ts': '/api/compatibility',
  'certificate.routes.ts': '/api/certificates',
  'connection.routes.ts': '/api/connections',
  'admin.routes.ts': '/api/ops',
  'notification.routes.ts': '/api/notifications',
  'stats.routes.ts': '/api/stats',
};

const METHODS = ['get', 'post', 'patch', 'put', 'delete'];

function mountedRoutes() {
  // Registered directly on the app rather than on a router.
  const routes = new Set(['GET /health', 'GET /']);

  for (const dir of readdirSync(MODULES)) {
    for (const file of readdirSync(join(MODULES, dir))) {
      if (!file.endsWith('.routes.ts')) continue;

      const mount = MOUNTS[file];
      if (!mount) {
        throw new Error(
          `${file} is not listed in MOUNTS. Add it there — an unlisted router would be ` +
            'skipped by this audit, and its routes could go undocumented unnoticed.',
        );
      }

      const source = readFileSync(join(MODULES, dir, file), 'utf8');
      for (const match of source.matchAll(/\.(get|post|patch|put|delete)\(\s*'([^']*)'/g)) {
        // Express ':param' is OpenAPI '{param}'. A trailing slash on the mount
        // root ('/api/users' + '/') is not a distinct path.
        const path = (mount + match[2]).replace(/:(\w+)/g, '{$1}').replace(/\/$/, '') || '/';
        routes.add(`${match[1].toUpperCase()} ${path}`);
      }
    }
  }
  return routes;
}

function documentedRoutes(document) {
  return new Set(
    Object.entries(document.paths).flatMap(([path, operations]) =>
      Object.keys(operations)
        .filter((method) => METHODS.includes(method))
        .map((method) => `${method.toUpperCase()} ${path}`),
    ),
  );
}

/** Every `$ref` has to point at a schema that exists, or Swagger renders a hole. */
function danglingRefs(document) {
  const defined = new Set(Object.keys(document.components?.schemas ?? {}));
  const missing = new Set();
  for (const [, name] of JSON.stringify(document).matchAll(
    /#\/components\/schemas\/([A-Za-z0-9_]+)/g,
  )) {
    if (!defined.has(name)) missing.add(name);
  }
  return [...missing];
}

const { openApiDocument } = await import('../src/docs/openapi.ts');

const mounted = mountedRoutes();
const documented = documentedRoutes(openApiDocument);

const undocumented = [...mounted].filter((route) => !documented.has(route)).sort();
const phantom = [...documented].filter((route) => !mounted.has(route)).sort();
const dangling = danglingRefs(openApiDocument);

console.log(`${mounted.size} routes mounted, ${documented.size} documented`);

for (const [label, rows] of [
  ['Mounted but not documented', undocumented],
  ['Documented but not mounted', phantom],
  ['Dangling $refs', dangling],
]) {
  if (rows.length) console.log(`\n${label} (${rows.length}):\n  ${rows.join('\n  ')}`);
}

const failures = undocumented.length + phantom.length + dangling.length;
console.log(failures === 0 ? '\nThe spec matches the API.' : `\n${failures} problem(s).`);
process.exit(failures === 0 ? 0 : 1);
