# TapTim — Project Documentation & Operations Log

> **Sprint 1 — MVP Foundation Setup**
> Status: **Complete** · Target date: Friday, 28 August 2026 · Delivered: 26 August 2026

---

## 1. Overview & Architecture

### 1.1 Project summary

TapTim helps hackathon and tech-event participants find their optimal teammates. Instead of
forming teams by whoever shouts first in a Discord thread, TapTim models each participant's
**skills, primary role, personality, and availability**, then computes a **compatibility score**
and suggests balanced teams. Credentials are backed by **AI certificate verification**, so a
"Verified" badge on a profile carries real weight.

Sprint 1 delivers the runnable foundation: a documented REST API with working authentication, a
placeholder event catalogue, and a responsive marketing/landing experience built on a coherent
design system. The matching engine itself is scheduled for Sprint 2.

### 1.2 Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Backend runtime | Node.js 20+ (ES modules) | Already installed locally (v25.6.0); one language across the stack. |
| API framework | Express 4 + TypeScript | Smallest dependency surface that still supports a clean modular layout. Express 4 (not 5) for reliable `swagger-ui-express` compatibility. |
| Validation | Zod | One schema drives both runtime validation and the TypeScript types. |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` | Stateless tokens suit a SPA; bcrypt is the standard for password hashing. |
| API docs | `swagger-ui-express` + hand-authored OpenAPI 3.0.3 | A hand-written spec object is type-checked at build time and cannot drift into invalid YAML the way JSDoc annotations can. |
| Persistence | Supabase Postgres via `pg` | Sprint 2 replaced the in-memory store. Plain SQL over `pg` rather than an ORM: the compatibility queries want array operators (`&&`), partial unique indexes, and `for update` locks, all of which an ORM would obscure. |
| Migrations | Hand-written SQL, tracked in `_migrations` | One file per change, applied in a transaction, recorded by filename. No migration tool to learn, and the SQL is exactly what runs. |
| Certificate verification | Claude (`@anthropic-ai/sdk`), rule-based fallback | Optional by design — the endpoint works identically without an API key, so the API is never blocked on a credential. |
| Frontend | React 18 + Vite 6 + TypeScript | Fast dev server, minimal config, standard tooling. |
| Styling | Tailwind CSS v4 | Design tokens are declared once in `@theme` and consumed as utilities; class-based dark mode. |
| Routing | React Router 6 | Client-side routes for Home, Events, Compatibility, and Auth. |

> **Note on Python:** FastAPI was considered but Python is not installed on this machine
> (`python --version` fails), so a Node stack keeps the project runnable without extra setup.

### 1.3 Architecture

```
Browser (React SPA, :5173)
   │
   │  fetch + JWT Bearer token, cross-origin
   ▼
Express API (:4000)
   │
   ├── helmet · cors · json body parser · morgan
   ├── /api/auth           → validate → controller → service → store
   ├── /api/users          → validate → controller → service → store
   ├── /api/events         → validate → controller → service → store
   ├── /api/teams          → validate → controller → service → store
   ├── /api/compatibility  → validate → controller → service → engine (pure)
   ├── /api/certificates   → validate → controller → service → verifier
   ├── /api/docs           → Swagger UI over the OpenAPI document
   └── notFound → errorHandler  (single JSON error envelope)
   │
   ▼
Supabase Postgres (pooled, TLS)
```

Each backend module follows the same four-file shape, so a new resource is added by copying
the pattern rather than inventing one:

```
modules/<name>/
  <name>.schema.ts      Zod schemas + inferred request types
  <name>.service.ts     business logic; throws HttpError
  <name>.controller.ts  reads req, calls service, shapes the response
  <name>.routes.ts      binds paths to middleware + controller
```

### 1.4 Folder structure

```
TapTim/
├── doc.md                        ← this file
├── README.md
├── package.json                  npm workspaces root + `npm run dev`
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── scripts/copy-sql.mjs      copies migrations into dist/ at build time
│   └── src/
│       ├── server.ts             connect → migrate → listen → graceful shutdown
│       ├── app.ts                middleware pipeline + route mounting
│       ├── config/env.ts         Zod-validated environment
│       ├── db/
│       │   ├── pool.ts           pg Pool, query/queryOne/withTransaction
│       │   ├── migrate.ts        applies src/db/migrations/*.sql once each
│       │   ├── seed.ts           idempotent upsert of events + demo users
│       │   └── migrations/001_init.sql
│       ├── data/                 repositories — the only place SQL is written
│       │   ├── user.store.ts
│       │   ├── event.store.ts
│       │   ├── team.store.ts
│       │   └── certificate.store.ts
│       ├── docs/openapi.ts       OpenAPI 3.0.3 document (26 paths, 36 operations)
│       ├── middleware/
│       │   ├── auth.middleware.ts       requireAuth · optionalAuth (Bearer)
│       │   ├── error.middleware.ts      notFoundHandler + errorHandler
│       │   └── validate.middleware.ts   validateBody / validateQuery / validateParams
│       ├── modules/
│       │   ├── auth/           schema · service · controller · routes
│       │   ├── users/          model · schema · service · controller · routes
│       │   ├── events/         model · schema · service · controller · routes · data
│       │   ├── teams/          model · schema · service · controller · routes
│       │   ├── compatibility/  model · engine (pure) · schema · service · controller · routes
│       │   └── certificates/   model · verifier · schema · service · controller · routes
│       └── utils/
│           ├── async-handler.ts  forwards async rejections to the error handler
│           ├── dates.ts          Date → ISO-8601 for row mappers
│           ├── http-error.ts     HttpError with status + code factories
│           └── token.ts          sign / verify / decode JWTs
│
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html                fonts + no-flash theme bootstrap
    ├── .env.example
    └── src/
        ├── main.tsx              providers + router
        ├── App.tsx               routes, auth modal state, scroll restoration
        ├── index.css             Tailwind v4 @theme design tokens
        ├── design-system/tokens.ts   spacing · type scale · surfaces
        ├── lib/       api.ts · types.ts · format.ts · cn.ts
        ├── hooks/     useEvents.ts (useEvents, useCategories)
        ├── context/   AuthContext.tsx · ThemeContext.tsx
        ├── components/
        │   ├── ui/        Button · Input/Select · Card · Badge · Modal · Container · SectionHeading · Spinner
        │   ├── layout/    Navbar · Footer · Logo · ThemeToggle
        │   ├── auth/      AuthForms (Login/Signup) · AuthModal
        │   ├── events/    EventCard · EventGrid · CategoryFilter
        │   └── landing/   Hero · ProblemSolution · EventShowcase · FeatureHighlights · CtaBand
        └── pages/     HomePage · EventsPage · CompatibilityPage · AuthPages · NotFoundPage
```

### 1.5 Setup & run instructions

**Prerequisites:** Node.js 20 or newer, npm 10 or newer, and a Supabase project.

```bash
# 1. Install every workspace's dependencies from the repo root
npm install

# 2. Create the backend environment file
cd backend && cp .env.example .env && cd ..
#    Windows PowerShell: Copy-Item backend\.env.example backend\.env

# 3. Set DATABASE_URL in backend/.env  (see "Getting the Supabase URL" below)

# 4. Create the schema and load the starter data
npm run db:migrate --workspace backend
npm run db:seed --workspace backend

# 5. Run the API and the web app together
npm run dev
```

**Getting the Supabase URL** — Supabase dashboard → **Project Settings → Database →
Connection string → URI**, and pick the **Session pooler** entry:

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Use the pooler rather than the direct connection: Supabase's direct host is IPv6-only, which
most home and office networks cannot reach. Percent-encode the password if it contains
`@ : / ? #` or `%`.

`npm run dev` runs migrations itself at boot, so step 4 is only needed to load the seed data —
but running it explicitly gives a clearer error if the connection string is wrong.

| Service | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| API root | http://localhost:4000 |
| **Swagger UI** | **http://localhost:4000/api/docs** |
| OpenAPI JSON | http://localhost:4000/api/docs.json |
| Health check | http://localhost:4000/health |

**Running each side on its own**

```bash
npm run dev:backend      # tsx watch — restarts on file change
npm run dev:frontend     # vite dev server with HMR
```

**Production build**

```bash
npm run build            # compiles backend to dist/, bundles frontend to dist/
npm run start --workspace backend
npm run preview --workspace frontend
```

**Environment variables** (`backend/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Port the API binds to. |
| `NODE_ENV` | `development` | `development` \| `test` \| `production`. |
| `CORS_ORIGIN` | `http://localhost:5173,http://localhost:4173` | Comma-separated allowed origins. |
| `JWT_SECRET` | `dev-only-secret-change-me` | Token signing secret. Boot **fails** if left at the default when `NODE_ENV=production`. |
| `JWT_EXPIRES_IN` | `7d` | Access-token lifetime. |
| `DATABASE_URL` | — | **Required.** Supabase Postgres connection string. Boot fails with a readable message if it is missing or wrong. |
| `DATABASE_SSL` | `no-verify` | `no-verify` (encrypted, chain not validated — what the pooler expects) \| `require` \| `disable`. |
| `DATABASE_POOL_MAX` | `10` | Maximum pooled connections. |
| `ANTHROPIC_API_KEY` | — | Optional. When set, certificate claims are assessed by Claude; otherwise a deterministic rule verifier runs. |
| `CERT_VERIFIER_MODEL` | `claude-opus-5` | Model used when `ANTHROPIC_API_KEY` is set. |

`frontend/.env` accepts `VITE_API_URL` (default `http://localhost:4000`) if the API moves.

---

## 2. Operations Log

Chronological record of Sprint 1. All commands were run on Windows 11 with Node v25.6.0 and npm 11.8.0.

### 2.1 Commands executed

| # | Command | Outcome |
| --- | --- | --- |
| 1 | `node --version` / `npm --version` | v25.6.0 / 11.8.0 |
| 2 | `python --version` | Not installed → ruled out FastAPI |
| 3 | `npm install` (workspace root) | Exit 0; backend + frontend dependencies installed |
| 4 | `cp .env.example .env` (backend) | Local env created |
| 5 | `npx tsc -p tsconfig.json --noEmit` (backend) | Clean, no errors |
| 6 | `npx tsx src/server.ts` | API booted on :4000 |
| 7 | 14-step `curl` suite against the API | All expected status codes returned |
| 8 | `npm run build` (frontend) | 65 modules, built in 4.21 s |
| 9 | `npx vite --port 5173` | Dev server booted, modules transform |
| 10 | `npm run build` (backend) | Emitted `dist/` |

### 2.2 Dependencies installed

**Backend — runtime**

| Package | Version | Role |
| --- | --- | --- |
| `express` | ^4.21.2 | HTTP framework |
| `cors` | ^2.8.5 | Cross-origin access for the SPA |
| `helmet` | ^8.0.0 | Security headers |
| `morgan` | ^1.10.0 | Request logging |
| `dotenv` | ^16.4.7 | Loads `.env` |
| `zod` | ^3.24.1 | Schema validation |
| `jsonwebtoken` | ^9.0.2 | JWT sign/verify |
| `bcryptjs` | ^2.4.3 | Password hashing |
| `swagger-ui-express` | ^5.0.1 | Serves Swagger UI |

**Backend — dev:** `typescript` ^5.7.3, `tsx` ^4.19.2, and `@types/*` for node, express, cors, morgan, jsonwebtoken, bcryptjs, swagger-ui-express.

**Frontend — runtime:** `react` ^18.3.1, `react-dom` ^18.3.1, `react-router-dom` ^6.28.1.

**Frontend — dev:** `vite` ^6.0.7, `@vitejs/plugin-react` ^4.3.4, `tailwindcss` ^4.0.0, `@tailwindcss/vite` ^4.0.0, `typescript` ^5.7.3, `@types/react`, `@types/react-dom`.

**Root — dev:** `concurrently` ^9.1.2.

### 2.3 Files created

**Root (4)**

| File | Purpose |
| --- | --- |
| `package.json` | npm workspaces; `dev`, `build`, `typecheck` scripts |
| `doc.md` | This document |
| `README.md` | Quick-start summary |
| `.gitignore` | Ignores `node_modules`, `dist`, `.env`, editor and OS cruft |

**Backend (26 — 22 under `src/`)**

| File | Purpose |
| --- | --- |
| `package.json`, `tsconfig.json` | Manifest; strict TS targeting ES2022 / NodeNext |
| `.env.example`, `.gitignore` | Env template; ignores `node_modules`, `dist`, `.env` |
| `src/server.ts` | Boots the app, logs URLs, handles SIGINT/SIGTERM |
| `src/app.ts` | Middleware pipeline, route mounting, Swagger, health |
| `src/config/env.ts` | Zod-validated env; refuses the default secret in production |
| `src/docs/openapi.ts` | Full OpenAPI 3.0.3 document (7 paths, 9 schemas) |
| `src/middleware/auth.middleware.ts` | `requireAuth` — verifies Bearer token, loads the user |
| `src/middleware/error.middleware.ts` | `notFoundHandler` + terminal `errorHandler` |
| `src/middleware/validate.middleware.ts` | `validateBody`, `validateQuery`, `getValidatedQuery` |
| `src/utils/http-error.ts` | `HttpError` + `badRequest`/`unauthorized`/`forbidden`/`notFound`/`conflict` |
| `src/utils/async-handler.ts` | Routes async rejections into the error handler |
| `src/utils/token.ts` | `signAccessToken`, `verifyAccessToken`, `getExpiresInSeconds` |
| `src/data/user.store.ts` | In-memory repository keyed by id and normalised email |
| `src/modules/users/user.model.ts` | `PRIMARY_ROLES`, `UserRecord`, `PublicUser`, `toPublicUser` |
| `src/modules/auth/*.ts` | schema · service · controller · routes (4 files) |
| `src/modules/events/*.ts` | model · data · schema · service · controller · routes (6 files) |

**Frontend (44 — 38 under `src/`)**

| Area | Files |
| --- | --- |
| Config | `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.env.example`, `.gitignore` |
| Entry | `src/main.tsx`, `src/App.tsx`, `src/index.css` |
| Design system | `src/design-system/tokens.ts` |
| Lib | `src/lib/api.ts`, `types.ts`, `format.ts`, `cn.ts` |
| Hooks | `src/hooks/useEvents.ts` |
| Context | `src/context/AuthContext.tsx`, `ThemeContext.tsx` |
| UI kit | `Button`, `Input` (+`Select`), `Card`, `Badge`, `Modal`, `Container`, `SectionHeading`, `Spinner` |
| Layout | `Navbar`, `Footer`, `Logo`, `ThemeToggle` |
| Auth | `AuthForms`, `AuthModal` |
| Events | `EventCard`, `EventGrid`, `CategoryFilter` |
| Landing | `Hero`, `ProblemSolution`, `EventShowcase`, `FeatureHighlights`, `CtaBand` |
| Pages | `HomePage`, `EventsPage`, `CompatibilityPage`, `AuthPages`, `NotFoundPage` |

### 2.4 Configuration decisions

- **Helmet CSP disabled.** Swagger UI ships inline scripts and styles that Helmet's default
  Content-Security-Policy blocks, which leaves `/api/docs` blank. Every other Helmet header
  stays on. Re-enable with a Swagger-specific CSP before production.
- **CORS allow-list, not wildcard.** Origins come from `CORS_ORIGIN`. Requests with **no**
  `Origin` header (curl, server-to-server, Swagger UI itself) pass through; a disallowed
  browser origin gets a `403 FORBIDDEN` in the standard error envelope.
- **Express 4 over Express 5.** `swagger-ui-express` is most reliably compatible with 4.x, and
  Express 4 allows `req.body` reassignment after validation.
- **Hand-written OpenAPI document.** `src/docs/openapi.ts` is a typed object, so a malformed
  spec is a compile error rather than a runtime surprise.
- **`validateQuery` does not write back to `req.query`.** Newer Express versions expose
  `req.query` as a read-only getter, so the parsed value is stashed under a symbol and read
  through `getValidatedQuery`.
- **Tailwind v4 with class-based dark mode.** `@custom-variant dark (&:where(.dark, .dark *))`
  lets the toggle override the OS preference; a small inline script in `index.html` applies the
  stored theme before first paint so a dark reload never flashes white.
- **`localStorage` access is wrapped in try/catch** in both the theme and token helpers, since
  it throws outright in some privacy modes.

### 2.5 Issues encountered and fixed

| Issue | Resolution |
| --- | --- |
| A rejected CORS origin returned `500 INTERNAL_SERVER_ERROR` | The `cors` callback was handed a plain `Error`. Changed to `HttpError.forbidden(...)` so the error handler emits `403 FORBIDDEN`. Verified. |
| Re-testing the CORS fix still showed `500` | The old server process still held port 4000, so the request hit stale code. Killed PID 24240, restarted, re-verified → `403`. |
| `$TMPDIR` unset in the shell, so the first server start wrote to `/taptim-api.log` and failed | Switched to the harness's background-task runner with an explicit log path. |
| `validateQuery` first draft reassigned `req.query` via an awkward helper | Rewrote to stash the parsed value under a `Symbol.for` key, read back with `getValidatedQuery<T>()`. |
| **Blank page on first load; content only appeared after a manual refresh** | The Google Fonts `<link>` in `index.html` was a render-blocking stylesheet, measured at **1.15 s** to `fonts.googleapis.com` from this machine. Because an SPA's `<body>` is empty until React mounts, the browser painted nothing for that whole window; on refresh the font CSS was cached and the page appeared instantly. Fixed by loading the font stylesheet asynchronously (`media="print"` + `onload="this.media='all'"`, with a `<noscript>` fallback) so first paint uses the system-font fallback and upgrades to Inter on arrival. |
| White flash on first paint in dark mode | Vite injects the stylesheet via JavaScript during dev, so the first paint had no styling at all. Added an inline critical-CSS block to `index.html` setting `color-scheme` and the light/dark background, plus a `#root:empty::after` spinner that shows only until React mounts. |
| ~1 s spinner before content on a cold dev load | Not a defect. Individual requests measure 1–8 ms and the API responds in ~2 ms; the delay is the cumulative import waterfall of Vite dev serving 38 source modules plus dependencies as separate requests. Added `server.warmup.clientFiles` to `vite.config.ts` so the entry graph is transformed at server start. The production build is unaffected — 3 requests, ~20 ms total (see §6). |

---

## 3. API Documentation Summary

**Base URL:** `http://localhost:4000` · **Swagger UI:** `/api/docs` · **Spec:** `/api/docs.json`

### 3.1 Response envelopes

Every successful response wraps its payload in `data` (list endpoints add `meta`):

```jsonc
{ "data": { /* … */ } }
{ "data": [ /* … */ ], "meta": { "total": 12, "limit": 20, "offset": 0 } }
```

Every failure uses one shape, so the client has a single error path:

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [{ "field": "email", "message": "Provide a valid email address." }]
  }
}
```

Codes in use: `VALIDATION_ERROR`, `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `INTERNAL_SERVER_ERROR`.

### 3.2 Endpoints

36 operations across 26 paths. 🔒 = requires `Authorization: Bearer <token>`.

**Health & auth**

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | — | Liveness **and** readiness; **503** when the database is unreachable |
| `GET` | `/` | — | API metadata and doc links |
| `POST` | `/api/auth/signup` | — | Register; returns user + JWT (**201**) |
| `POST` | `/api/auth/login` | — | Authenticate; returns user + JWT (**200**) |
| `GET` | `/api/auth/me` | 🔒 | Current user profile |

**Participants** — profile fields are the matching inputs

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/users` | optional | Directory; filter by role, skills, experience, availability, verified |
| `GET` | `/api/users/me` | 🔒 | Own profile, with `profileCompleteness` |
| `PATCH` | `/api/users/me` | 🔒 | Update skills, availability, working style, links |
| `GET` | `/api/users/{id}` | — | A participant profile (no email) |

**Events** — full CRUD; the seeded catalogue is read-only

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/events` | — | List; filter by category, search, mode, featured |
| `POST` | `/api/events` | 🔒 | Create; caller becomes the organiser (**201**) |
| `GET` | `/api/events/categories` | — | All eight categories with live counts |
| `GET` | `/api/events/{id}` | — | Single event |
| `PATCH` | `/api/events/{id}` | 🔒 | Organiser only |
| `DELETE` | `/api/events/{id}` | 🔒 | Organiser only; cascades to the event's teams (**204**) |

**Teams** — formation, invitations, and applications

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/teams` | optional | Browse; filter by event, status, needed role, open seats, `mine` |
| `POST` | `/api/teams` | 🔒 | Create; caller becomes owner and first member (**201**) |
| `GET` | `/api/teams/requests` | 🔒 | My incoming or outgoing invitations and applications |
| `PATCH` | `/api/teams/requests/{requestId}` | 🔒 | `accept` \| `decline` \| `cancel` |
| `GET` | `/api/teams/{id}` | — | Team with full roster |
| `PATCH` | `/api/teams/{id}` | 🔒 | Owner only |
| `DELETE` | `/api/teams/{id}` | 🔒 | Owner only (**204**) |
| `POST` | `/api/teams/{id}/applications` | 🔒 | Ask to join (**201**) |
| `POST` | `/api/teams/{id}/invitations` | 🔒 | Owner invites a participant (**201**) |
| `GET` | `/api/teams/{id}/suggestions` | 🔒 | Ranked candidates for the open seats |
| `POST` | `/api/teams/{id}/leave` | 🔒 | Leave; owners must transfer first (**204**) |
| `POST` | `/api/teams/{id}/transfer-ownership` | 🔒 | Hand the team to another member |
| `DELETE` | `/api/teams/{id}/members/{userId}` | 🔒 | Owner removes a member (**204**) |

**Compatibility**

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/compatibility` | 🔒 | Score a pair; one id scores them against you |
| `GET` | `/api/compatibility/matches` | 🔒 | My ranked matches, optionally scoped to an event |

**Certificates**

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/certificates` | 🔒 | My certificates |
| `POST` | `/api/certificates` | 🔒 | Submit; verification runs in the same request (**201**) |
| `GET` | `/api/certificates/{id}` | 🔒 | One of mine |
| `PATCH` | `/api/certificates/{id}` | 🔒 | Edit; clears the verdict and re-verifies |
| `DELETE` | `/api/certificates/{id}` | 🔒 | Delete; re-syncs the Verified badge (**204**) |
| `POST` | `/api/certificates/{id}/verify` | 🔒 | Re-run verification |

### 3.3 Request / response models

**`POST /api/auth/signup`**

```jsonc
// Request
{
  "email": "ada@taptim.dev",        // required, valid email, lower-cased
  "password": "hunter2hunter2",     // required, 8–128 chars
  "fullName": "Ada Lovelace",       // required, 2–80 chars
  "primaryRole": "Full-Stack Developer",  // required, one of PRIMARY_ROLES
  "skills": ["React", "Node.js"]    // optional, max 20
}

// 201 Created
{
  "data": {
    "user": {
      "id": "48f827c2-…", "email": "ada@taptim.dev", "fullName": "Ada Lovelace",
      "primaryRole": "Full-Stack Developer", "skills": ["React", "Node.js"],
      "bio": null, "avatarUrl": null, "verified": false,
      "createdAt": "2026-08-26T12:54:48.015Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs…",
    "tokenType": "Bearer",
    "expiresIn": 604800
  }
}
```

Errors: `400` validation · `409` email already registered.

**`POST /api/auth/login`** — body `{ email, password }`; returns the same `AuthResult` with
status `200`. Errors: `400` validation · `401` incorrect credentials.

**`GET /api/auth/me`** — requires `Authorization: Bearer <token>`; returns `{ "data": User }`.
Errors: `401` missing, malformed, expired, or orphaned token.

**`GET /api/events`** — query parameters:

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `category` | `All` or an `EventCategory` | `All` | Exact category match |
| `search` | string ≤ 80 | — | Case-insensitive over name, description, location, tags |
| `featured` | `true` \| `false` | — | Filters on the featured flag |
| `limit` | int 1–50 | `20` | Page size |
| `offset` | int ≥ 0 | `0` | Page offset |

Returns `{ data: Event[], meta: { total, limit, offset } }`, sorted by `startDate` ascending.

**`Event` model**

```jsonc
{
  "id": "evt-001",
  "name": "TapTim Global Hack 2026",
  "description": "A 48-hour flagship hackathon …",
  "category": "Hackathons",
  "tags": ["48h", "Open Track", "Beginner Friendly"],
  "startDate": "2026-09-12T09:00:00.000Z",
  "endDate": "2026-09-14T18:00:00.000Z",
  "location": "Baku, Azerbaijan",
  "mode": "hybrid",                       // onsite | online | hybrid
  "teamSize": { "min": 3, "max": 5 },
  "prizePool": "$25,000",
  "registrationDeadline": "2026-09-05T23:59:00.000Z",
  "participants": 640,
  "featured": true
}
```

**Enumerations**

- `PRIMARY_ROLES` (10): Frontend Developer, Backend Developer, Full-Stack Developer,
  Mobile Developer, AI / ML Engineer, Data Scientist, UI/UX Designer, Product Manager,
  DevOps Engineer, Cybersecurity.
- `EVENT_CATEGORIES` (8): Hackathons, AI, Programming, Design, Web3, Cybersecurity, Startup,
  Data Science. The seed catalogue holds **12 events** across all eight.

### 3.4 Testing protected routes in Swagger

1. Open http://localhost:4000/api/docs.
2. Expand `POST /api/auth/signup` → **Try it out** → **Execute**.
3. Copy `data.accessToken` from the response.
4. Click **Authorize** (top right), paste the token, **Authorize**, **Close**.
5. `GET /api/auth/me` now returns `200`. Authorization persists across page reloads
   (`persistAuthorization: true`).

---

## 4. Design System

Tokens live in `frontend/src/index.css` under Tailwind v4's `@theme`; layout and type
decisions are named in `frontend/src/design-system/tokens.ts`.

**Colour** — `brand` (indigo 50–900) drives primary actions, links, and focus rings.
`accent` (cyan 300–600) is the gradient partner and the "match" signal. `ink` (slate 50–950)
covers every surface, border, and text tone. Semantic states reuse Tailwind's emerald, amber,
and red.

**Typography** — Inter for UI, JetBrains Mono for numeric readouts. Scale: `display` (4xl→6xl,
extrabold) · `h1`/`h2` · `h3` · `lead` · `body` · `small` · `overline` (uppercase, tracked).

**Components** — `Button` (4 variants × 3 sizes; renders as `button`, router `Link`, or `a`),
`Input`/`Select` (label + hint + error, `aria-invalid`, `aria-describedby`), `Card`
(optional `interactive` lift), `Badge` (5 tones), `Modal` (Escape to close, scroll lock,
`role="dialog"`), `Container`, `SectionHeading`, `Spinner`.

**Theming** — Light and dark are both first-class. The toggle writes `taptim-theme` to
`localStorage` and flips `.dark` on `<html>`; an inline script in `index.html` applies it
before first paint.

**Loading behaviour** — the font stylesheet is loaded asynchronously and an inline critical-CSS
block sets `color-scheme` plus the light/dark background before any external resource resolves,
so the first paint is immediate and correctly themed. A `#root:empty::after` spinner covers the
gap until React mounts. Never make the Google Fonts link a plain blocking `<link>`; on a slow
connection that reintroduces a fully blank first load.

**Accessibility** — one shared `:focus-visible` ring across all interactive elements, semantic
landmarks (`header`/`main`/`footer`/`nav`), labelled form controls, `aria-selected` on the
category tablist, `role="alert"` on form errors, and a `prefers-reduced-motion` escape hatch.

**Responsive breakpoints** — mobile-first. Event grids run 1 column → `sm:` 2 → `lg:` 3; the
navbar collapses to a drawer below `md:`; the auth modal is a bottom sheet on mobile and a
centred dialog from `sm:` up.

---

## 5. Sprint 1 Progress Checklist

### 5.1 Acceptance criteria

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Backend structure and endpoints run locally without build errors | ✅ | `tsc --noEmit` clean; `npm run build` emits `dist/`; server boots on :4000 |
| 2 | Swagger UI accessible, endpoints testable | ✅ | `/api/docs` → `200`; spec reports 7 paths, 9 schemas; `bearerAuth` configured |
| 3 | Sign Up and Login APIs return valid responses | ✅ | signup `201`, login `200`, me `200`, bad password `401`, duplicate `409` |
| 4 | Frontend landing page meets responsive standards | ✅ | Mobile-first Tailwind across all sections; navbar drawer; production build succeeds |
| 5 | UI reflects a unified design system (dark/light tech aesthetic) | ✅ | Shared `@theme` tokens; 8-component UI kit; working theme toggle |
| 6 | `doc.md` generated with full operational detail and run instructions | ✅ | This file |

### 5.2 Task deliverables

**Task A — Documentation**

- [x] Overview, tech stack, folder structure, setup instructions
- [x] Operations log: commands, dependencies, files, configuration, issues fixed
- [x] API summary: endpoints, request/response models, Swagger route info
- [x] Sprint 1 progress checklist

**Task B — Backend**

- [x] Modular Express + TypeScript architecture
- [x] Swagger UI at `/api/docs` (+ raw spec at `/api/docs.json`)
- [x] `POST /api/auth/signup` — email, password, full name, primary role
- [x] `POST /api/auth/login` — returns JWT
- [x] `GET /api/auth/me` — authenticated profile
- [x] `GET /api/events` — mock catalogue filtered by category
- [x] CORS allow-list, Zod-validated env, centralised error middleware

**Task C — Frontend**

- [x] React + Vite + TypeScript + Tailwind CSS v4
- [x] Design-system constants and a reusable component kit
- [x] Hero — "Find Your Perfect Hackathon Team" + Get Started / Explore Events
- [x] Problem & Solution — matching, compatibility, AI certificate verification
- [x] Event Showcase — category filter + cards with name, date, location, tag, team size
- [x] Feature Highlights — 92% Match, Team Builder, Verified Badges
- [x] Auth modal **and** standalone `/login` and `/signup` pages, wired to the live API
- [x] Navbar with working routes (Home, Events, Compatibility, Auth)
- [x] Responsive across desktop, tablet, and mobile

### 5.3 Verification run — 26 August 2026

| # | Check | Expected | Actual |
| --- | --- | --- | --- |
| 1 | `GET /health` | 200 | ✅ 200 |
| 2 | `POST /api/auth/signup` | 201 + token | ✅ 201 |
| 3 | `GET /api/auth/me` with token | 200 + profile | ✅ 200 |
| 4 | `POST /api/auth/login` | 200 | ✅ 200 |
| 5 | Login with wrong password | 401 | ✅ 401 |
| 6 | Duplicate signup | 409 | ✅ 409 |
| 7 | `GET /api/auth/me` with bad token | 401 | ✅ 401 |
| 8 | `GET /api/events` | 200, 12 items | ✅ 200 |
| 9 | `GET /api/events/categories` | 200, 8 categories | ✅ 200 |
| 10 | `GET /api/events/evt-005` | 200 | ✅ 200 |
| 11 | `GET /api/events/nope` | 404 | ✅ 404 |
| 12 | `GET /api/docs/` | 200 | ✅ 200 |
| 13 | `GET /api/docs.json` | valid 3.0.3 | ✅ 7 paths, 9 schemas |
| 14 | Frontend dev server | 200 | ✅ 200 |

Additional checks: category filter (`?category=AI` → 2), combined search (`?search=ctf&featured=true` → 1),
query validation (`?limit=999` → 400), unknown route (`/api/nothing` → 404), CORS preflight from
`:5173` → 204 with the allow headers, disallowed origin → 403.

**Not verified:** the UI has not been opened in a real browser — no browser automation was
available in this environment. Rendering, visual layout, and interactive behaviour are
confirmed only insofar as the production build compiles and the dev server transforms every
module. A manual pass at http://localhost:5173 is the remaining step.

### 5.4 Known limitations at the end of Sprint 1

*(Items 1, 4, 5 and 6 were addressed in Sprint 2 — see section 6.)*


1. **Users live in memory** — every restart clears registrations. Swap `user.store.ts` for a real database in Sprint 2.
2. **No refresh tokens** — a single 7-day access token; no rotation or revocation list yet.
3. **No rate limiting** — add `express-rate-limit` on the auth routes before any public deployment.
4. **Events are static** — no organiser CRUD, and `GET /api/events/{id}` has no detail page behind it yet.
5. **Compatibility page is a placeholder** — a transparent role-synergy heuristic, clearly labelled in the UI. The real engine is Sprint 2.
6. **Certificate verification is UI only** — no upload or verification pipeline yet.
7. **Helmet CSP is off** so Swagger UI renders; needs a scoped policy before production.

### 5.5 Recommended Sprint 2 scope

1. Persist users with PostgreSQL + Prisma behind the existing store interface.
2. Build the real compatibility engine (skills, availability, personality) and expose `POST /api/compatibility`.
3. Team CRUD: create, invite, join, and the open-seat suggestions the Team Builder card previews.
4. Profile management — edit skills, bio, and avatar upload.
5. Certificate upload plus the AI verification pipeline behind the Verified badge.
6. Harden auth: refresh tokens, rate limiting, email verification.
7. Automated tests — Vitest + Supertest for the API, React Testing Library for the UI.

---

## 6. Sprint 2 — Backend & Database

> Status: **backend complete, frontend integration outstanding.**

### 6.1 Database schema

Supabase Postgres. One migration, `backend/src/db/migrations/001_init.sql`, applied in a
transaction and recorded in `_migrations` by filename.

| Table | Purpose | Notable constraints |
| --- | --- | --- |
| `users` | Accounts **and** matching inputs — skills, availability slots, hours, timezone, working-style scores | GIN index on `skills`; checks on experience level, hours, timezone |
| `events` | Event catalogue, now writable by organisers | `text` primary key so the seeded `evt-001` ids the frontend links to stay valid; date and team-size checks |
| `teams` | One team per event per owner | Case-insensitive unique name per event |
| `team_members` | Roster, with the `is_owner` flag | PK `(team_id, user_id)` |
| `team_event_membership` | Enforces "one team per participant per event" | PK `(user_id, event_id)` — the database arbitrates, not the service layer |
| `team_requests` | Invitations *and* applications in one table | Partial unique index on `(team_id, user_id, kind) where status = 'pending'`, so resolved rows stay as history without blocking a re-application |
| `certificates` | Credential claims and their verdicts | Confidence bounded 0–1; status checked |

**Row Level Security is enabled on every table with no policies.** The API connects as the
owner role and bypasses RLS; Supabase's `anon` and `authenticated` PostgREST roles see nothing.
Without this, anyone holding the project's public anon key could read the `users` table
directly, bypassing the API entirely.

**Concurrency.** Two rules cannot be enforced by an application-level "check then insert",
because two simultaneous requests both pass the check:

- *Last seat in a team* — `insertMembership` takes `select … for update` on the team row before
  counting members, so the second request blocks and then fails.
- *One team per event* — the `team_event_membership` primary key rejects the second insert; the
  store translates the 23505 into a 409.

### 6.2 Compatibility engine

`backend/src/modules/compatibility/compatibility.engine.ts` is pure and synchronous —
everything it needs arrives as arguments, so a score can be recomputed without a database and
the same function serves pair scoring, ranked matches, and team suggestions.

| Component | Weight | How it scores |
| --- | --- | --- |
| Skill complementarity | 25 | Combined breadth (saturating) plus an overlap term that peaks near 30% shared — enough common vocabulary to communicate, enough difference to cover ground |
| Role synergy | 25 | Roles map to capability axes (client, server, data, ml, design, product, infra, security, mobile); the score is how much of the union each person uniquely covers, floored at 0.25 so two people in the same role are not scored as incompatible |
| Availability overlap | 20 | Shared time slots as a fraction of the *smaller* schedule, plus hours-per-week and timezone proximity |
| Working style | 20 | Per trait: leadership rewards difference (someone has to lead), communication is limited by whichever person syncs least, structure/pace/risk reward similarity |
| Verified credentials | 10 | The Verified badge and the count of verified certificates |

Unknown inputs score a neutral 0.5, not 0 — an unfilled profile should read as *"we don't know
yet"*, not as a bad match. Every component returns its own score **and a plain-language
explanation**, so the UI can always justify the number to a participant.

Team fit (`scoreAgainstTeam`) is the mean pair score against the current roster, plus up to 20
points for filling a role in `lookingFor` or covering a `requiredSkills` entry.

### 6.3 Certificate verification

Two verifiers behind one function. With `ANTHROPIC_API_KEY` set, Claude assesses the claim
under a structured-output constraint; without it, a deterministic rule verifier weighs five
signals (recognised issuer, verification link, link on the issuer's own domain, credential id,
plausible issue date). A Claude failure falls back to the rules rather than failing the request,
and `verifiedBy` records which one actually ran, so the fallback is visible rather than silent.

**Scope, stated honestly:** both verifiers assess *plausibility from the submitted metadata*.
Neither opens the credential URL, so a verdict is evidence for the badge, not proof the
credential exists. Live credential lookup is follow-up work. This limitation is written into
the Swagger description for `POST /api/certificates` so no consumer over-reads the badge.

The `verified` flag on `users` is always recomputed from the certificates table after a verdict
or a delete, so the badge and its evidence cannot drift apart.

### 6.4 Site roles and the admin console

`users.account_role` is an ordered set — `user` -> `moderator` -> `admin` — so a
permission check is a comparison rather than a list of equality tests that has to be
revisited every time a tier is added. It replaced the `is_admin` boolean from migration
002, which could only ever say "staff or not" and had no way to express the middle tier.

**This is not `users.primary_role`.** That column is the *profession* someone practises on
a team (Frontend Developer, Designer, …). It is profile data — a stat the participant sets
about themselves, alongside skills and availability — and it feeds the matching engine.
`account_role` is *authority on the site* and feeds nothing but the console.

**The console does not touch profile data at all.** Site role is the only editable field,
and `AdminAccount` carries no profession, skills, or bio. An administrator has no more
business rewriting someone's job title than their skill list; both belong on the profile.
`updateAccountSchema` accepts `accountRole` and nothing else, so a request carrying
`primaryRole` is rejected at validation rather than quietly ignored.

| Role | Can |
| --- | --- |
| `user` | Build a profile, join and run teams, submit certificates. |
| `moderator` | Everything above, plus: open the console and see every account, and delete any team or organiser-created event regardless of who owns it. |
| `admin` | Everything above, plus: change any account's site role, including promoting other admins. |

Moderation is a real power, not a label. A team whose owner has gone quiet can only be
removed by that owner — which is exactly who is unreachable — so `deleteTeam` and
`deleteEvent` let a moderator act on content they do not own. The seeded catalogue stays
immutable even for admins: it is reference data, not something a person created.

| | |
| --- | --- |
| Page | `/staff/ops-console` — reachable only from the Site/Admin switch in the nav bar |
| Switch | `components/layout/AdminModeSwitch.tsx`, in the bar and the mobile drawer |
| API | `/api/ops/accounts` — not the guessable `/api/admin`, and **deliberately absent from Swagger** |
| Gate | `requireRole('moderator')`, checked server-side on every request |
| First admin | `npm run admin:grant --workspace backend -- <email> [role]` |

**Below `moderator` gets 404, not 403.** A 403 would confirm the endpoint exists and that
authority is the only thing missing, turning a probe into reconnaissance. Anonymous
requests, ordinary users, and demoted staff all get the answer the router gives for a URL
that was never built — and the SPA page renders the ordinary 404 to match. That is also
why the router uses `optionalAuth` rather than `requireAuth`: a 401 would be a tell.
Changing a site role *does* return 403, because by that point the caller is known staff.

**The switch cannot leak.** It renders only for staff, and `accountRole` appears on exactly
one record: the viewer's own. `toDirectoryUser` strips it alongside the email from every
other profile, so no response shape lights the control up for the wrong person.

**Authority is unreachable from the public API.** `accountRole` is not in
`updateProfileSchema`, so a `PATCH /api/users/me` carrying `accountRole: 'admin'` has the
key stripped by Zod — verified by test. Only an admin through the console, or the CLI,
which needs shell access to the machine holding `DATABASE_URL`.

**Two guards against locking yourself out.** You cannot lower your own role. And
`setAccountRoleGuarded` counts the remaining admins inside a transaction that first locks
every admin row — without that lock, two admins demoting each other at the same instant
would both read "2 remain", both pass, and leave a console nobody can open. The CLI
bypasses both on purpose: it is the escape hatch, and it can grant access back.

**Changing a profession changes it everywhere.** `userStore.update` runs in a transaction
and, whenever the patch touches `primaryRole`, rewrites every `team_members.role` row for
that person too. The sync lives in the repository rather than in a caller because *any*
path that changes a profession needs it — otherwise a roster keeps showing the role
someone held when they joined, and each team's `lookingFor` gaps get computed against
stale data.

### 6.5 Still outstanding

1. **Frontend integration** — the Sprint 2 frontend deliverables (core user flows against the
   new endpoints, form validation, loading/empty/error states, responsive new pages) have not
   been started. The API is ready for them; `frontend/src/lib/api.ts` still calls only the
   Sprint 1 auth and events endpoints.
2. **No automated tests** — still the largest gap. The pure compatibility engine is the
   cheapest place to start, since it needs no database.
3. **No rate limiting** on the auth routes.
4. **No refresh tokens** — still a single 7-day access token.
5. **Helmet CSP is still off** so Swagger UI renders.

---

## 7. Dev vs. production load characteristics

Measured on 26 August 2026, this machine, warm dependency cache.

| | Dev server (`:5173`) | Production preview (`:4173`) |
| --- | --- | --- |
| Requests to first paint | ~40+ (one per module) | **3** (html + css + js) |
| Transfer size | unbundled sources | 3.2 KB + 44.9 KB CSS + 212.7 KB JS (~75 KB gzipped) |
| Total measured | ~1 s cold | **~20 ms** |
| Import waterfall | yes — each module reveals the next | none, pre-bundled |

Vite dev intentionally skips bundling so hot-module reload stays fast, and pays for it with a
per-module request waterfall on the first load. **This is expected and does not reflect what
users experience.** To see real performance:

```bash
npm run build --workspace frontend
npm run preview --workspace frontend      # http://localhost:4173
```

`:4173` is already in the default `CORS_ORIGIN` allow-list, so the preview build talks to the
API without further configuration.

---

*Last updated: 26 August 2026 — end of Sprint 1.*
