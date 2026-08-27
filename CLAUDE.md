# TapTim

Hackathon team matching. Skills, roles, personality, and availability feed a
compatibility score; AI certificate verification backs the "Verified" badge.

Architecture, API reference, and the sprint log live in `doc.md`.

## Layout

- `backend/` — Express 4 + TypeScript API (JWT auth, Zod validation, in-memory
  store, hand-authored OpenAPI spec at `backend/src/docs/openapi.ts`)
- `frontend/` — React 18 + Vite 6 + Tailwind v4 SPA
- npm workspaces; `npm run dev` runs both

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
