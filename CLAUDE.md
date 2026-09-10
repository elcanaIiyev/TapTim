# TapTim

Hackathon team matching. Skills, roles, personality, and availability feed a
compatibility score; AI certificate verification backs the "Verified" badge.

Architecture, API reference, and the sprint log live in `doc.md`. `HANDOFF.md`
is the working state: what exists, what is configured, how to verify it.

## Layout

- `backend/` — Express 4 + TypeScript API (JWT auth, Zod validation, Supabase
  Postgres via `pg`, hand-authored OpenAPI spec at `backend/src/docs/openapi.ts`)
- `frontend/` — React 18 + Vite 6 + Tailwind v4 SPA
- `api/index.ts` — the Vercel serverless entry; re-exports the Express app
- npm workspaces; `npm run dev` runs both

Data access lives in `backend/src/data/*.store.ts`, raw SQL over the pool in
`backend/src/db/pool.ts`. Schema changes are forward-only SQL files in
`backend/src/db/migrations/`. There is no in-memory store — there has not been
one since Sprint 2, whatever older prose says.

## Verifying a change

```bash
npm run typecheck                          # backend, frontend, and api/
npm run build                              # both workspaces
npm run audit:openapi --workspace backend  # every route documented
npm test                                   # e2e against a running API (API_BASE, default :4000)
npm run test:ui --workspace frontend       # every page x 3 widths in Chrome (UI_BASE, default :4173)
```

Both test suites create `@taptim.test` accounts and delete them through the API
when they finish; they never touch the seed accounts.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
