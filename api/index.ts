import { createApp } from '../backend/src/app.js';

/**
 * The Vercel serverless entry point.
 *
 * An Express app is already `(req, res) => void`, which is exactly the handler
 * shape Vercel's Node runtime expects, so the whole job here is to build the
 * app and hand it over without opening a port.
 *
 * What this deliberately does *not* do is the work `backend/src/server.ts` does
 * around `createApp()`. That file pings the database, runs migrations and
 * creates the avatar bucket before it listens, which is right for a process you
 * start once and correspondingly wrong here: it would run on every cold start,
 * put a schema lock in the path of a user request, and let concurrent cold
 * starts race each other to apply the same migration. Migrations are a deploy
 * step (`npm run db:migrate --workspace backend`), not a request-time one.
 *
 * The app is created at module scope so a warm instance reuses it. Nothing in
 * `createApp()` connects to anything; the pool behind it is built lazily on the
 * first query.
 *
 * The import points at `backend/src`, not `backend/dist`. Vercel compiles this
 * file with esbuild, which follows TypeScript's own `.js` -> `.ts` resolution,
 * so the backend is bundled from source and the function does not depend on
 * `npm run build` having produced `dist` before the function is built.
 */
const app = createApp();

export default app;
