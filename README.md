# TapTim

**Find your perfect hackathon team.** TapTim! matches hackathon and tech-event participants into
balanced teams based on skills, roles, personality, and compatibility.

> **Sprint 1 (MVP Foundation) — complete.** Full architecture notes, operations log, API
> reference, and the sprint checklist live in **[doc.md](doc.md)**.

---

## Quick start

Requires Node.js 20+ and npm 10+.

```bash
npm install                                   # install both workspaces
cp backend/.env.example backend/.env          # PowerShell: Copy-Item backend\.env.example backend\.env
npm run dev                                   # runs the API and the web app together
```

| Service | URL |
| --- | --- |
| Web app | http://localhost:5173 |
| API | http://localhost:4000 |
| Swagger UI | http://localhost:4000/api/docs |
| Health check | http://localhost:4000/health |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | API + frontend concurrently |
| `npm run dev:backend` | API only, with watch-reload |
| `npm run dev:frontend` | Vite dev server only |
| `npm run build` | Production build of both workspaces |
| `npm run typecheck` | TypeScript check across both workspaces |

## Stack

**Backend** — Node.js, Express 4, TypeScript, Zod, JWT, bcrypt, Supabase Postgres (`pg`),
OpenAPI 3.0.3 via `swagger-ui-express`.
**Frontend** — React 18, Vite 6, TypeScript, Tailwind CSS v4, React Router 6.

## API at a glance

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | — | Register, returns a JWT |
| `POST` | `/api/auth/login` | — | Authenticate, returns a JWT |
| `GET` | `/api/auth/me` | Bearer | Current user profile |
| `GET` | `/api/events` | — | Event catalogue, filterable by category |
| `GET` | `/api/events/categories` | — | Categories with counts |
| `GET` | `/api/events/{id}` | — | Single event |

See [doc.md](doc.md) for the full API reference and the list of known limitations.

## Data

Everything is persisted in **Supabase Postgres**. Schema changes are forward-only SQL files
in `backend/src/db/migrations/`, applied in filename order and recorded in `_migrations`, so
re-running is a no-op.

| Command | Description |
| --- | --- |
| `npm run db:migrate --workspace backend` | Apply any pending migrations |
| `npm run db:seed --workspace backend` | Migrate, then upsert the demo catalogue and participants |

The seed is idempotent — every statement is an upsert on a natural key, so running it twice
never duplicates a row.

## Deployment (Vercel, one project)

The frontend and the API deploy together. `vercel.json` builds both workspaces, serves
`frontend/dist` as static output, and rewrites `/api/*` and `/health` onto a single
serverless function at `api/index.ts`, which re-exports the Express app. Every other path
falls through to `index.html`, so deep links survive a refresh.

The function is pinned to `hnd1` (Tokyo) via `regions`, because the Supabase project
lives in `ap-northeast-1` and Vercel otherwise defaults to `iad1` (US East) — which would
put the Pacific between the API and its database on every query. Measured round-trip to
the pooler is ~300ms from outside the region. Move this if the database ever moves.

Note that `vercel.json` is validated strictly (`additionalProperties: false`), so it cannot
carry comment keys — an unknown property makes the whole file invalid and Vercel then
behaves as though there is no config at all.

Because both are one origin, the browser calls `/api/...` with no host — there is no API
base URL to configure, and `VITE_API_URL` is only an escape hatch for pointing a local UI at
a deployed API.

**Before the first deploy**, run the migrations against the database Vercel will use:

```bash
DATABASE_URL='<your connection string>' npm run db:migrate --workspace backend
```

Migrations are deliberately *not* run by the serverless function. That path executes on
every cold start, would put a schema lock in front of a user request, and lets concurrent
cold starts race to apply the same file.

### Environment variables to set in the Vercel dashboard

Required:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase **Transaction pooler** string, port `6543` (see `backend/.env.example` for why) |
| `JWT_SECRET` | A fresh random secret. The app refuses to boot in production with the dev default |
| `APP_URL` | The deployment origin, e.g. `https://taptim.vercel.app` |
| `NODE_ENV` | `production` |

Recommended:

| Variable | Value |
| --- | --- |
| `CORS_ORIGIN` | The deployment origin. Same-origin traffic never reaches this check, but set it so nothing depends on that |
| `DATABASE_SSL` | `no-verify` — what the Supabase pooler expects without its root cert |

Optional, each feature degrades gracefully if its key is absent:

| Variable | Enables | Without it |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | LLM certificate verification | A deterministic rule-based verifier runs instead |
| `CERT_VERIFIER_MODEL` | Model override (default `claude-opus-5`) | — |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Avatar and team-logo uploads | Uploads return a clear "not configured" error |
| `SUPABASE_AVATAR_BUCKET` | Bucket name (default `avatars`) | — |
| `RESEND_API_KEY`, `MAIL_FROM` | Confirmation emails | Links are printed to the function log |
| `REQUIRE_EMAIL_VERIFICATION` | Gate accounts on confirmation | Off; see `backend/.env.example` for why |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in | Button hidden |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | LinkedIn sign-in | Button hidden |

`PORT` is not needed — Vercel does not use it. No `.env` file is ever committed; `.gitignore`
covers them and only the `.env.example` templates are tracked.

If you enable OAuth, register the production redirect URI with each provider as well as the
local one: `https://<your-deployment>/api/auth/oauth/<provider>/callback`.
