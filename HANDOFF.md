# TapTim — working state & next scope

Updated 11 September 2026. Read this first after a context reset: it records what
exists, what is configured, how to verify it, and what is worth doing next.
`doc.md` is the reference documentation; this is the working log.

---

## 0. Sprint 4 — where it ended (11 September 2026)

**Live at https://tap-tim.vercel.app** — one Vercel project (static `frontend/dist` plus the
Express app as a single function at `api/index.ts`), on Supabase Postgres through the
transaction pooler (port 6543), function pinned to `hnd1` beside the database.

Sprint 4 added profiles worth opening (`/participants/:id`), names that link to them
everywhere, a "waiting for an answer" list of invitations and applications on every team, the
**Team Lab** in place of the old Compatibility tab, change-password, self-serve account
deletion, and live landing numbers — and removed every placeholder. `doc.md` §9 has the
checklist, item by item.

**The tests live in the repository now.** The scratchpad suites described in §1 are gone:

```bash
npm test                                   # 47 API checks against API_BASE (default :4000)
npm run test:ui --workspace frontend       # 59 checks in Chrome against UI_BASE (default :4173)
```

Both create `@taptim.test` accounts and delete them through the API, and never touch the seed
accounts or their teams.

Deploy gotchas that each broke a deploy once — do not relearn them: never set `NODE_ENV` in
Vercel (npm then skips devDependencies and the build dies at `tsc`); Root Directory must be the
repo root; `vercel.json` cannot carry comment keys; and a same-origin app still sees CORS on
POSTs, which is why the app's own origin is always allowed in `config/env.ts`.

---

## 1. Where the project actually is

Sprint 2 is complete. On top of it, everything in the last scope list is built
and verified: the session bug, per-event stats and matching, the event detail
page, the Teams tab, team creation under each event, and the Connections tab
with chat and the LinkedIn placeholder.

**Everything below has been run against the real Supabase database, not mocked.**

| Suite (in the session scratchpad) | Covers | Checks |
| --- | --- | --- |
| `e2e.mjs` | matching, teams, events, certificates | 44 |
| `roles-e2e.mjs` | site roles, console access, moderation powers | 27 |
| `signup-e2e.mjs` | registration, confirmation, profile, experiences | 47 |
| `moderation-e2e.mjs` | ban, unban, delete, cascade | 28 |
| `event-stats-e2e.mjs` | archetypes, per-event fit, gaps, suggestions | 29 |
| `connections-e2e.mjs` | requests, chat, unread counts, gating | 30 |
| `roles-e2e2.mjs` | multi-roles, 0–100 scale, depth scoring, recruit brief | 39 |
| `flow.mjs` | full browser flow (Chrome) | 31 |
| `skills-mod-ui.mjs` | skill picker + moderation UI (Chrome) | 34 |
| `chat-ui.mjs` | connections + chat in the browser | 17 |
| `roles-ui.mjs` | role picker, sliders, compatibility page (Chrome) | 33 |
| `noverify-e2e.mjs` | signup with email confirmation off | 16 |
| `features-ui.mjs` | event covers, team logo, settings, sign-out veil (Chrome) | 25 |
| `teamchat-e2e.mjs` | team channels | 25 |
| `notifications-e2e.mjs` | every notification emit site | 28 |
| `endorsements-e2e.mjs` | endorsements and confidence | 26 |
| `risks-e2e.mjs` | team risk, each finding on and off | 19 |
| `organiser-e2e.mjs` | organiser-defined scoring | 22 |
| `public-team-e2e.mjs` | the public recruiting page | 14 |
| `teamchat-ui.mjs`, `notifications-ui.mjs`, `risks-ui.mjs`, `eventfilters-ui.mjs`, `public-team-ui.mjs` | the same in Chrome | 46 |
| `shell-ui.mjs` | the seam, return control, navigation mode, chat dock, recruiting board (Chrome) | 37 |
| `newscope-e2e.mjs` | endorsement decay and context, availability freshness | 24 |
| `fixes-ui.mjs` | navigation-mode occlusion, dock tabs, the logo (Chrome) | 17 |
| `design-ui.mjs` | motion tokens, casing, account menu, dark elevation, thin grids (Chrome) | 21 |

All passing at the time — and all gone now: the scratchpad was session-scoped.
Their replacements live in the repository; see §0.

`backend/scripts/audit-openapi.mjs` *is* in the repository and survives resets:
`npm run audit:openapi --workspace backend` fails if a route is undocumented.

### Running it

```bash
npm run dev                                  # API :4000 + SPA :5173
npm run db:migrate --workspace backend       # apply migrations
npm run db:seed    --workspace backend       # 12 events + 8 demo users
npm run audit:openapi --workspace backend    # spec vs. routers
npm run admin:grant --workspace backend -- <email> [user|moderator|admin]
```

### Accounts (all password `demo1234`)

| Email | Site role |
| --- | --- |
| `ada@taptim.dev` | **admin** |
| `kenan@taptim.dev` | **moderator** |
| `leyla@`, `nigar@`, `orkhan@`, `sabina@`, `tural@`, `emin@` `taptim.dev` | user |

> The owner's account exists again as an ordinary signup (site role `user`).
> Grant it more with `npm run admin:grant --workspace backend -- <email> admin`.
> On 7 September eighteen leftover QA accounts (`@example.com`) were deleted, so
> the directory is the eight seed accounts plus real signups.

### Integrations (live; keys in `backend/.env`, which is gitignored)

- **Resend** — configured but **not in the signup path**. Email confirmation is
  switched off via `REQUIRE_EMAIL_VERIFICATION=false` (the default), because the
  shared `onboarding@resend.dev` sender only delivers to
  **elcanaliyevinfo@gmail.com** — with the gate on, every other signup stalled
  on "check your inbox" forever. The machinery is intact; verify a domain in
  Resend, point `MAIL_FROM` at it, and set the flag to `true` to turn it back
  on. Nothing else needs changing.
- **Supabase Storage** — working. Bucket `avatars`, created at boot. Verified
  upload → public read → delete.
- **Google OAuth** — working in production (confirmed 7 September). Redirect URIs
  for `localhost:4000` and `tap-tim.vercel.app` are both registered. If anyone is
  refused with "can only be used within its organization", the consent screen is
  still *Internal*: Google Cloud Console → OAuth consent screen → **Make
  external**. The scopes are `openid email profile`, so no Google review.
- **LinkedIn OAuth** — not configured. The flow is written; the button renders
  disabled with a "soon" label until `LINKEDIN_CLIENT_ID`/`SECRET` are set.
- **ANTHROPIC_API_KEY** — unset, so certificate verification runs the
  deterministic rule verifier. Works well; the LLM path is opt-in.

> **Rotate the Resend key and the Supabase `service_role` key before this is
> public** — they were pasted into a chat transcript.

### Migrations applied

`001_init` · `002_admin` · `003_account_roles` · `004_onboarding` ·
`005_skill_levels` · `006_moderation` · `007_event_stats` · `008_connections` ·
`009_skill_scale` · `010_team_roles` · `011_images` · `012_team_chat` ·
`013_notifications` · `014_endorsements` · `015_endorsement_notification` ·
`016_event_taxonomy` · `017_endorsement_context` · `018_availability_freshness`

### A warning about the suites

Several of them — `e2e.mjs`, `roles-e2e2.mjs`, `connections-e2e.mjs`,
`endorsements-e2e.mjs` and others — open with a teardown that **deletes every
team owned by the eight seed accounts**, so they are repeatable rather than
green-once. Against a scratch database that is correct. Against this one it also
deletes whatever you were using those accounts to try out. Twice now a
regression run has destroyed a team created by hand minutes earlier.

Before running them, either accept that seed-account teams are disposable, or
move the suites onto their own database first. They are safe for events (the
catalogue is seeded and owned by nobody) and they do delete certificates on
those accounts as well.

### Conventions worth not relearning

- Commits carry **no AI attribution** — asked for explicitly.
- The **product outranks the sprint checklists**. Judge work by whether it helps
  someone actually find a teammate.
- `git push` goes to `main` on `github.com/elcanaIiyev/TapTim`.
- `.env` changes do **not** restart `tsx watch` — touch a file in `src/` after
  editing it, or the server keeps the old config and behaves confusingly.
- `pg` returns the JS number `Infinity` for a Postgres `'infinity'` timestamp,
  not the string. Normalised in `mapUserRow`; forgetting it turns every
  permanent ban into a 500.
- Column lists in `team.store.ts` are hand-written and must be updated whenever
  a `users` column is added, or team members silently lose that field.
- The design system uppercases labels in CSS (`type-label`), so the DOM text is
  still mixed case. Case-sensitive assertions against rendered labels fail for
  reasons that look like product bugs and are not — lowercase both sides.
- The OpenAPI document is hand-authored. Run `audit:openapi` after adding a
  route; it drifted by 29 operations before that script existed.

---

## 2. What was asked for, and where it landed

Every item from every scope list so far is **done**.

| # | Asked for | Where it lives |
| --- | --- | --- |
| 1 | "Find my team" asked for login while already signed in | `App.tsx` — `handleGetStarted` now branches on session, `emailVerified`, and `onboardingCompleted` |
| 2 | Events carry stats; matching runs per event | `events/event-stats.ts` (archetypes), `event-stats.service.ts`, `GET /api/events/{id}/stats` |
| 3 | Per-event individual stat sheet | `GET /api/events/{id}/my-fit`, rendered by `EventDetailPage` |
| 4 | Different teams per event, plus a Teams tab | `team_event_membership` already enforced it; `TeamsPage.tsx` is the tab |
| 5 | Team finding and creation under each event | `EventDetailPage.tsx` — team list and create form |
| 6 | Connections tab, chat, LinkedIn "coming soon" | `ConnectionsPage.tsx`, `ChatPanel.tsx`, `connections/` module |
| 7 | Multiple roles, incl. non-engineering ones | `TEAM_ROLES` (20) in `user.model.ts`, `RolePicker.tsx`, migration `010` |
| 8 | Compatibility = pick a team, get who you need | `recruitBriefFor` in `event-stats.ts`, rewritten `CompatibilityPage.tsx` |
| 9 | Depth counts, not just how many skills | `coverageFor` in `event-stats.ts` — see doc.md §7.3 |
| 10 | Skill slider 0–100 with the adjectives as bands | `SKILL_LEVELS` bands, migration `009`, `SkillPicker.tsx` |
| 11 | Images on mock events, better events tab | `event.data.ts` covers, `EventCover.tsx`, rebuilt `EventCard.tsx` |
| 12 | Team logo | migration `011`, `POST/DELETE /api/teams/:id/logo`, `TeamLogo(Picker).tsx` |
| 13 | Loading animations (e.g. logout) | `TransitionVeil.tsx`, wired through `AuthContext.logout` |
| 14 | Settings button and options | `SettingsPage.tsx` at `/settings`, gear in `Navbar` |
| 15 | Team chat, not just 1:1 | `team-chat.service.ts`, `TeamChannel.tsx` |
| 16 | Notifications | `notifications/` module, `NotificationBell.tsx` |
| 17 | Endorsements on skill levels | `endorsement.service.ts`, `ParticipantPage.tsx` |
| 18 | Honest degradation on thin data | `confidenceFor` in `event-stats.ts`, brief `caveat` |
| 19 | Team risk panel + availability grid | `team-risk.ts`, `TeamRisks.tsx` |
| 20 | Organiser-defined event weights | `statProfileSchema`, `ScoringEditor.tsx` |
| 21 | Public team recruiting page | `team-public.service.ts`, `/r/:id` |
| 22 | Event filtering split into two axes | migration `016`, `EventFilters.tsx` |
| 23 | Navbar looked template-ish; the seam should be seamless | `--color-seam` in `index.css`, reworked `Navbar.tsx` |
| 24 | Two landing CTAs led to the same page | hero secondary → `/recruiting`, new `RecruitingPage.tsx` |
| 25 | A return button, top left | `BackBar.tsx`, mounted once in `App.tsx` |
| 26 | WASD / arrow navigation behind a hotkey | `NavigationMode.tsx` — `` ` `` or F7 |
| 27 | Chat needs its own button and a dock | `ChatDockContext.tsx`, `ChatDock.tsx`, navbar chat button |
| 28 | Navigation mode reached things off screen and under the bar | `NavigationMode.tsx` — viewport coordinates + `elementFromPoint` |
| 29 | The dock needs Chat / Team chat, and "Open full" per conversation | `ChatDock.tsx` tabs, `/connections?with=` |
| 30 | Drop the logo's square mark | `Logo.tsx` — wordmark and a rule |
| 31 | Availability goes stale and the engine trusts it | migration `018`, `AvailabilityCheck.tsx`, `POST /me/availability/confirm` |
| 32 | Nothing knows the event has started | `lib/event-phase.ts`, phase-aware `EventDetailPage` |
| 33 | Endorsements should decay and be scoped | migration `017`, `endorsement-weight.ts` |
| 34 | The design system had drifted | see doc.md §7.12 |

The design decision worth remembering from item 2: the compatibility engine was
**not** forked. `scorePair` and `scoreAgainstTeam` take an optional weight
override and default to the original constants, so every existing caller is
untouched. Gaming weights credibility 3; Cybersecurity weights it 18.

---

## 3. What is worth doing next

Nothing asked for is outstanding. In value order:

1. **Organisers creating events.** `POST /api/events` exists and any signed-in account may call
   it, but there is no form — the catalogue is the seeded one. A "host an event" page is the
   largest piece of the product still missing, and the scoring editor it would sit beside
   (`ScoringEditor.tsx`) already exists.
2. **Rate limiting on the auth routes.** There is none; `login`, `check-email`, and now
   `password` are all worth protecting.
3. **Refresh tokens.** Still a single 7-day access token.
4. **"Events that suit you"** — `fitForEvent` across the catalogue, ranked. A loop and a sort
   over code that already exists.
5. **Post-event outcomes** — did the team ship, did it place — which would give credibility
   scoring something real to read.
6. **Email notifications.** Resend is wired but only delivers to the key owner until a domain is
   verified; the Settings row that promised this was removed rather than left as a promise.
7. **LinkedIn** — the OAuth flow is written and waiting on credentials. Unconfigured providers
   are simply not offered.

Chat is polled every 5 seconds and paused while the tab is hidden. That is a deliberate choice,
not a shortcut: both people are usually on the page, so a websocket would add connection
lifecycle, reconnection, and a second transport for the same felt latency. Revisit only if
conversations get busy.
