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

**Backend** — Node.js, Express 4, TypeScript, Zod, JWT, bcrypt, OpenAPI 3.0.3 via
`swagger-ui-express`.
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

Users are held in an in-memory store for Sprint 1, so registrations reset when the API
restarts. See [doc.md §5.4](doc.md) for the full list of known limitations.
