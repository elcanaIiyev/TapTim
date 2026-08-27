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
| Persistence | In-memory store | Sprint 1 needs no durable data. The store is repository-shaped, so swapping in Postgres touches exactly one file. |
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
   ├── /api/auth    → validate → controller → service → store
   ├── /api/events  → validate → controller → service → static data
   ├── /api/docs    → Swagger UI over the OpenAPI document
   └── notFound → errorHandler  (single JSON error envelope)
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
│   └── src/
│       ├── server.ts             listen + graceful shutdown
│       ├── app.ts                middleware pipeline + route mounting
│       ├── config/env.ts         Zod-validated environment
│       ├── data/user.store.ts    in-memory repository
│       ├── docs/openapi.ts       OpenAPI 3.0.3 document
│       ├── middleware/
│       │   ├── auth.middleware.ts       requireAuth (Bearer)
│       │   ├── error.middleware.ts      notFoundHandler + errorHandler
│       │   └── validate.middleware.ts   validateBody / validateQuery
│       ├── modules/
│       │   ├── auth/     schema · service · controller · routes
│       │   ├── events/   schema · service · controller · routes · data · model
│       │   └── users/    user.model.ts (record, public projection, roles)
│       └── utils/
│           ├── async-handler.ts  forwards async rejections to the error handler
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

**Prerequisites:** Node.js 20 or newer, npm 10 or newer.

```bash
# 1. Install every workspace's dependencies from the repo root
npm install

# 2. Create the backend environment file
cd backend && cp .env.example .env && cd ..
#    Windows PowerShell: Copy-Item backend\.env.example backend\.env

# 3. Run the API and the web app together
npm run dev
```

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

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | — | Liveness, uptime, environment |
| `GET` | `/` | — | API metadata and doc links |
| `POST` | `/api/auth/signup` | — | Register; returns user + JWT (**201**) |
| `POST` | `/api/auth/login` | — | Authenticate; returns user + JWT (**200**) |
| `GET` | `/api/auth/me` | Bearer | Current user profile (**200**) |
| `GET` | `/api/events` | — | List events; filter by category, search, featured |
| `GET` | `/api/events/categories` | — | Categories with event counts |
| `GET` | `/api/events/{id}` | — | Single event |

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

### 5.4 Known limitations (by design for Sprint 1)

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

## 6. Dev vs. production load characteristics

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
