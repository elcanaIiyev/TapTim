/**
 * Every page, at three widths, in a real browser — plus the flows added in
 * Sprint 4, driven the way a person would drive them.
 *
 *   npm run build --workspace frontend && npm run preview --workspace frontend
 *   npm run test:ui --workspace frontend           # against http://localhost:4173
 *   UI_BASE=https://tap-tim.vercel.app npm run test:ui --workspace frontend
 *
 * Also runs the rebuilt pages in dark mode, and drives the Team Lab all the way
 * to a real team.
 *
 * Uses the installed Chrome through playwright-core (set CHROME_PATH to point at
 * another Chromium). Fails on horizontal overflow at any width, on any console
 * error or uncaught exception, on any 5xx, and on placeholder copy that should
 * be gone for good. Set SHOTS_DIR to keep a screenshot of every page and width.
 *
 * It signs up two throwaway accounts and deletes them through the API at the
 * end, so it leaves nothing behind.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const UI = (process.env.UI_BASE ?? 'http://localhost:4173').replace(/\/$/, '');
const API = (process.env.API_BASE ?? UI).replace(/\/$/, '');
const SHOTS = process.env.SHOTS_DIR;
const STAMP = Date.now();
const PASSWORD = 'Verify12345';

const WIDTHS = [
  { name: 'phone', width: 360, height: 780 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

/**
 * Copy that was placeholder or fiction, and must not come back. `88/5` is the
 * old Discover card reading a 0–100 level against the long-gone 1–5 scale.
 *
 * Case-insensitive throughout: the design system uppercases labels in CSS, so
 * `innerText` reads "SPRINT 1 MVP" — which is how the footer's stale label got
 * past the first version of this list.
 */
const FORBIDDEN = [/Coming soon/i, /Sprint [123]\b/i, /12K\+/, /\b\d{2,3}\/5\b/, /not built yet/i, /illustrative/i];

let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${String(detail).slice(0, 300)}` : ''}`);
  }
}

async function api(method, path, { token, body } = {}) {
  const headers = { Origin: new URL(UI).origin };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function signup(tag, firstName, roles) {
  const email = `ui-${STAMP}-${tag}@taptim.test`;
  const response = await api('POST', '/api/auth/signup', {
    body: { firstName, lastName: 'Tester', email, password: PASSWORD, roles },
  });
  if (response.status !== 201) throw new Error(`signup ${tag} failed: ${JSON.stringify(response.body)}`);
  return { email, token: response.body.data.accessToken, id: response.body.data.user.id, firstName };
}

const accounts = {};
let browser;

async function setUp() {
  accounts.a = await signup('a', 'Avery', ['Backend Developer']);
  accounts.b = await signup('b', 'Blake', ['UI/UX Designer']);
  const { a, b } = accounts;
  for (const [person, body] of [
    [a, { skills: ['Node.js', 'PostgreSQL'], skillLevels: { 'Node.js': 84, PostgreSQL: 76 }, availability: ['weekday-evenings'], lookingForTeam: true, onboardingCompleted: true }],
    [b, { skills: ['Figma', 'React'], skillLevels: { Figma: 88, React: 60 }, availability: ['weekday-evenings'], lookingForTeam: true, onboardingCompleted: true, bio: 'Designs first, builds second.' }],
  ]) {
    await api('PATCH', '/api/users/me', { token: person.token, body });
  }
  const events = await api('GET', '/api/events?limit=2');
  accounts.eventId = events.body.data[0].id;
  // Avery gets a team on the first event only, so the lab can turn a room into
  // a real team on the second.
  accounts.otherEventId = events.body.data[1].id;
  const team = await api('POST', '/api/teams', {
    token: a.token,
    body: { eventId: accounts.eventId, name: `UI Squad ${STAMP}`, maxSize: 4 },
  });
  accounts.teamId = team.body.data.id;
  await api('POST', `/api/teams/${accounts.teamId}/invitations`, { token: a.token, body: { userId: b.id, message: null } });

  // Connected, with a message between them, so the chat checks have a real thread.
  await api('POST', '/api/connections', { token: a.token, body: { userId: b.id } });
  const waiting = await api('GET', '/api/connections', { token: b.token });
  await api('PATCH', `/api/connections/${waiting.body.data.incoming[0].id}`, { token: b.token, body: { action: 'accept' } });
  await api('POST', `/api/connections/messages/${b.id}`, { token: a.token, body: { body: 'Hello from the UI suite.' } });
}

async function tearDown() {
  for (const person of [accounts.b, accounts.a]) {
    if (!person) continue;
    const gone = await api('DELETE', '/api/users/me', { token: person.token, body: { confirmEmail: person.email } });
    check(`clean-up: delete ${person.firstName}`, gone.status === 204, JSON.stringify(gone.body));
  }
}

async function openPage(context, path) {
  const page = await context.newPage();
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`exception: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(UI + path, { waitUntil: 'networkidle' });
  // Reveal animations settle, and late data (stats, the lab) lands.
  await page.waitForTimeout(400);
  return { page, problems };
}

async function sweep(token) {
  const { a, b, teamId, eventId } = accounts;
  const routes = [
    ['/', false],
    ['/events', false],
    [`/events/${eventId}`, false],
    ['/recruiting', false],
    [`/r/${teamId}`, false],
    ['/login', false],
    ['/signup', false],
    ['/this-page-does-not-exist', false],
    ['/teams', true],
    [`/teams/${teamId}`, true],
    ['/connections', true],
    ['/compatibility', true],
    [`/participants/${b.id}`, true],
    [`/participants/${a.id}`, true],
    ['/profile', true],
    ['/settings', true],
  ];

  for (const viewport of WIDTHS) {
    console.log(`\n${viewport.name} (${viewport.width}px)`);
    for (const [path, signedIn] of routes) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      if (signedIn) {
        await context.addInitScript((value) => window.localStorage.setItem('taptim-token', value), token);
      }
      const { page, problems } = await openPage(context, path);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const text = await page.evaluate(() => document.body.innerText);
      const forbidden = FORBIDDEN.filter((pattern) => pattern.test(text)).map(String);

      check(
        `${path} — no horizontal overflow, no errors, no placeholder copy`,
        overflow <= 1 && problems.length === 0 && forbidden.length === 0,
        [overflow > 1 ? `overflows by ${overflow}px` : '', ...problems, ...forbidden.map((f) => `found ${f}`)]
          .filter(Boolean)
          .join('; '),
      );

      if (SHOTS) {
        const file = `${viewport.name}-${path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}.png`;
        await page.screenshot({ path: join(SHOTS, file), fullPage: true });
      }
      await context.close();
    }
  }
}

/**
 * The pages this sprint built or rebuilt, in dark mode. The theme is seeded the
 * way a returning visitor's would be, before first paint. Same checks as the
 * sweep; the screenshots (with SHOTS_DIR) are for a person to look at, since
 * "readable in the dark" is not something a script can judge.
 */
async function darkSweep(token) {
  const { b, teamId } = accounts;
  const routes = ['/', `/participants/${b.id}`, `/teams/${teamId}`, '/teams', '/compatibility', '/settings', '/connections'];
  for (const viewport of [WIDTHS[0], WIDTHS[2]]) {
    console.log(`\ndark (${viewport.width}px)`);
    for (const path of routes) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      await context.addInitScript((value) => {
        window.localStorage.setItem('taptim-token', value);
        window.localStorage.setItem('taptim-theme', 'dark');
      }, token);
      const { page, problems } = await openPage(context, path);
      const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(
        `dark ${path} — dark theme applied, no overflow, no errors`,
        dark && overflow <= 1 && problems.length === 0,
        [dark ? '' : 'not dark', overflow > 1 ? `overflows by ${overflow}px` : '', ...problems].filter(Boolean).join('; '),
      );
      if (SHOTS) {
        const file = `dark-${viewport.name}-${path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}.png`;
        await page.screenshot({ path: join(SHOTS, file), fullPage: true });
      }
      await context.close();
    }
  }
}

/**
 * An open chat must poll, not loop. The panel used to blank its header to
 * "Loading…" and refetch the thread several times a second, because a new
 * `onRead` from the parent re-ran its reset on every render.
 */
async function chatStaysPut(context, path, open, label) {
  const { b } = accounts;
  const { page, problems } = await openPage(context, path);
  let fetches = 0;
  page.on('request', (request) => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === `/api/connections/messages/${b.id}`) {
      fetches += 1;
    }
  });
  await open(page);
  const header = page.locator('header').filter({ hasText: new RegExp(`${b.firstName} Tester|Loading…`) }).last();
  await header.getByText(`${b.firstName} Tester`, { exact: true }).waitFor({ timeout: 15000 });
  fetches = 0;
  let blank = 0;
  const until = Date.now() + 8000;
  while (Date.now() < until) {
    if ((await header.innerText().catch(() => '')).includes('Loading…')) blank += 1;
    await page.waitForTimeout(100);
  }
  check(
    `${label}: an open chat polls instead of refetching in a loop`,
    fetches <= 3 && blank === 0 && problems.length === 0,
    `fetched ${fetches}× in 8 s; header blank in ${blank} samples${problems.length ? `; ${problems.join('; ')}` : ''}`,
  );
  await page.close();
}

async function flows(token) {
  const { b, teamId } = accounts;
  console.log('\nflows (desktop)');
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript((value) => window.localStorage.setItem('taptim-token', value), token);

  // The landing numbers are counted, not the invented ones.
  {
    const { page } = await openPage(context, '/');
    // Twice on the page — a screen-reader <dt> and the visible label.
    await page.getByText('People on TapTim', { exact: true }).last().waitFor();
    const rail = await page.evaluate(() => document.body.innerText);
    check('landing shows live platform numbers', /People on TapTim/i.test(rail) && !/12K\+|480\b/.test(rail));
    await page.close();
  }

  // A profile answers "should I team up with them?" on its own.
  {
    const { page } = await openPage(context, `/participants/${b.id}`);
    check('profile: compatibility with you, broken down', await page.getByText(`You and ${b.firstName}`, { exact: true }).first().isVisible());
    check('profile: a connection can be messaged from their profile', await page.getByRole('button', { name: `Message ${b.firstName}`, exact: true }).isVisible());
    check('profile: skills and at-a-glance stats', (await page.getByText('At a glance', { exact: true }).isVisible()) && (await page.getByText('Figma').first().isVisible()));
    await page.close();
  }

  // The team page says who has been invited.
  {
    const { page } = await openPage(context, `/teams/${teamId}`);
    check('team page: pending invitations listed by name', (await page.getByText('Waiting for an answer', { exact: true }).isVisible()) && (await page.getByRole('link', { name: `${b.firstName} Tester` }).first().isVisible()));
    await page.close();
  }

  // Teams overview: sent by you.
  {
    const { page } = await openPage(context, '/teams');
    check('teams: "sent by you" names who and which team', await page.getByText('Sent by you, waiting for an answer', { exact: true }).isVisible());
    await page.close();
  }

  // The lab: put someone in the room and get a verdict.
  {
    const { page } = await openPage(context, '/compatibility');
    await page.getByLabel('Add someone').fill(b.firstName);
    await page.getByRole('button', { name: new RegExp(`${b.firstName} Tester`) }).first().click();
    await page.getByText('Every pair', { exact: true }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(300);
    if (SHOTS) await page.screenshot({ path: join(SHOTS, 'flow-lab.png'), fullPage: true });
    const text = await page.evaluate(() => document.body.innerText);
    check('lab: scores the pair and the group', /Every pair/i.test(text) && /How well they get on/i.test(text) && /Ready for this event/i.test(text));
    check('lab: flags that you are already on a team for this event', /already on/i.test(text));
    await page.close();
  }

  // Settings offers what it used to describe.
  {
    const { page } = await openPage(context, '/settings');
    check('settings: change password and delete account', (await page.getByRole('button', { name: 'Change', exact: true }).isVisible()) && (await page.getByText('Danger zone', { exact: true }).isVisible()));
    await page.close();
  }

  // Chat, on its own page and in the dock opened from a profile.
  await chatStaysPut(context, `/connections?with=${b.id}`, async () => {}, 'connections page');
  await chatStaysPut(
    context,
    `/participants/${b.id}`,
    async (page) => page.getByRole('button', { name: `Message ${b.firstName}`, exact: true }).click(),
    'chat dock',
  );

  // The lab, all the way to a real team: a different event, Blake in the room,
  // a name, one click — and the team page that follows lists Blake as invited.
  {
    const { page, problems } = await openPage(context, '/compatibility');
    await page.getByLabel('For which event?').selectOption(accounts.otherEventId);
    await page.getByLabel('Add someone').fill(b.firstName);
    await page.getByRole('button', { name: new RegExp(`${b.firstName} Tester`) }).first().click();
    await page.getByText('Every pair', { exact: true }).waitFor({ timeout: 15000 });
    await page.getByLabel('Team name').fill(`Lab Squad ${STAMP}`);
    await page.getByRole('button', { name: /Create team & invite 1/ }).click();
    await page.waitForURL(/\/teams\/[0-9a-f-]{36}$/, { timeout: 15000 });
    await page.getByText('Waiting for an answer', { exact: true }).waitFor({ timeout: 15000 });
    const createdId = new URL(page.url()).pathname.split('/').pop();
    const pending = await api('GET', `/api/teams/${createdId}/requests`, { token });
    check(
      'lab: "Create team & invite" makes the team and invites the room',
      (await page.getByRole('link', { name: `${b.firstName} Tester` }).first().isVisible()) &&
        pending.body?.data?.some((request) => request.kind === 'invite' && request.userId === b.id) &&
        problems.length === 0,
      problems.join('; ') || JSON.stringify(pending.body),
    );
    if (SHOTS) await page.screenshot({ path: join(SHOTS, 'flow-lab-created.png'), fullPage: true });
    await page.close();
  }

  await context.close();
}

try {
  console.log(`TapTim UI — ${UI}`);
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  await setUp();
  browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' },
  );
  await sweep(accounts.a.token);
  await darkSweep(accounts.a.token);
  await flows(accounts.a.token);
} catch (error) {
  failures.push('unexpected error');
  console.error('\n  unexpected error:', error);
} finally {
  await browser?.close();
  await tearDown().catch((error) => {
    failures.push('clean-up');
    console.error('  clean-up failed:', error);
  });
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exitCode = 1;
