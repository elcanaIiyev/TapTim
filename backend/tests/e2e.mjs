/**
 * End-to-end checks against a running API.
 *
 *   npm test --workspace backend                        # against http://localhost:4000
 *   API_BASE=https://tap-tim.vercel.app npm test --workspace backend
 *
 * Plain `fetch`, no framework: it drives the API exactly as the browser does,
 * including an `Origin` header on every request. Every "it works" call that
 * missed the production CORS bug was made without one, because curl does not
 * send it and browsers always do on a POST.
 *
 * It creates two throwaway accounts (`@taptim.test`) and deletes them through
 * the API at the end — the same self-serve deletion it tests — so it leaves
 * nothing behind and never touches the seed accounts or anything they own.
 */

const BASE = (process.env.API_BASE ?? 'http://localhost:4000').replace(/\/$/, '');
const ORIGIN = new URL(BASE).origin;
const STAMP = Date.now();
const PASSWORD = 'Verify12345';
const NEW_PASSWORD = 'Changed67890';

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail === undefined ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300)}`}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function call(method, path, { token, body } = {}) {
  const headers = { Origin: ORIGIN };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: response.status, body: json };
}

async function signup(tag, roles) {
  const email = `e2e-${STAMP}-${tag}@taptim.test`;
  const response = await call('POST', '/api/auth/signup', {
    body: { firstName: tag === 'a' ? 'Avery' : 'Blake', lastName: 'Tester', email, password: PASSWORD, roles },
  });
  return { email, status: response.status, token: response.body?.data?.accessToken, id: response.body?.data?.user?.id };
}

const accounts = {};
let teamId = null;

async function main() {
  console.log(`TapTim end-to-end — ${BASE}`);

  section('platform');
  const health = await call('GET', '/health');
  check('health reports the database up', health.status === 200 && health.body?.database === 'up', health.body);
  const stats = await call('GET', '/api/stats');
  check(
    'live stats are counted numbers',
    stats.status === 200 && ['participants', 'teams', 'onTeams', 'events'].every((key) => Number.isInteger(stats.body?.data?.[key])),
    stats.body,
  );

  section('accounts');
  accounts.a = await signup('a', ['Backend Developer']);
  accounts.b = await signup('b', ['UI/UX Designer', 'Frontend Developer']);
  check('sign up (A)', accounts.a.status === 201 && accounts.a.token, accounts.a.status);
  check('sign up (B)', accounts.b.status === 201 && accounts.b.token, accounts.b.status);
  const { a, b } = accounts;

  const profileA = await call('PATCH', '/api/users/me', {
    token: a.token,
    body: {
      skills: ['Node.js', 'PostgreSQL', 'TypeScript'],
      skillLevels: { 'Node.js': 85, PostgreSQL: 78, TypeScript: 70 },
      availability: ['weekday-evenings', 'weekend-mornings'],
      hoursPerWeek: 15,
      timezoneOffset: 4,
      personality: { leadership: 4, structure: 5, pace: 3 },
      lookingForTeam: true,
      experienceLevel: 'advanced',
    },
  });
  check('build a profile (A)', profileA.status === 200, profileA.body);
  const profileB = await call('PATCH', '/api/users/me', {
    token: b.token,
    body: {
      skills: ['Figma', 'React', 'UI design'],
      skillLevels: { Figma: 88, React: 60, 'UI design': 82 },
      availability: ['weekday-evenings', 'weekend-afternoons'],
      hoursPerWeek: 12,
      lookingForTeam: true,
      experienceLevel: 'intermediate',
      bio: 'Designs the thing, then builds the front of it.',
    },
  });
  check('build a profile (B)', profileB.status === 200, profileB.body);

  const experience = await call('POST', '/api/users/me/experiences', {
    token: b.token,
    body: { kind: 'hackathon', title: 'Finalist, E2E Hack', organisation: 'TapTim', skills: ['Figma'] },
  });
  check('add an experience (B)', experience.status === 201, experience.body);

  section('profiles');
  const viewB = await call('GET', `/api/users/${b.id}`);
  const personB = viewB.body?.data;
  check('a profile opens without signing in', viewB.status === 200);
  check('the profile lists experience', personB?.experiences?.some((entry) => entry.title === 'Finalist, E2E Hack'), personB?.experiences);
  check('the profile lists teams', Array.isArray(personB?.teams));
  check('the profile carries working hours and time zone', 'hoursPerWeek' in (personB ?? {}) && 'timezoneOffset' in (personB ?? {}));
  check('another person’s email is never exposed', personB && !('email' in personB), Object.keys(personB ?? {}));
  const missingPerson = await call('GET', '/api/users/00000000-0000-4000-8000-000000000000');
  check('an unknown profile is a 404', missingPerson.status === 404, missingPerson.status);

  section('compatibility');
  const pair = await call('POST', '/api/compatibility', { token: a.token, body: { userIds: [b.id] } });
  check('you-and-them score breaks into five components', pair.status === 200 && pair.body?.data?.components?.length === 5, pair.body);
  const matches = await call('GET', '/api/compatibility/matches?limit=5', { token: a.token });
  check('matches come back ranked', matches.status === 200 && Array.isArray(matches.body?.data), matches.body);

  const events = await call('GET', '/api/events?limit=5');
  const eventId = events.body?.data?.[0]?.id;
  check('there is an event to work with', Boolean(eventId), events.body);

  section('team lab');
  const lab = await call('POST', '/api/compatibility/lab', { token: a.token, body: { eventId, userIds: [a.id, b.id] } });
  const report = lab.body?.data;
  check('the lab scores a roster that does not exist', lab.status === 200, lab.body);
  check('the lab scores every pair', report?.pairs?.length === 1 && Number.isInteger(report.pairs[0].score), report?.pairs);
  check('the lab reports readiness and cohesion', Number.isInteger(report?.readiness) && Number.isInteger(report?.cohesion));
  check('the lab reads each person against the event', report?.members?.length === 2 && report.members.every((m) => Number.isInteger(m.eventFit)));
  check('the lab carries a recruit brief and risks', Boolean(report?.brief?.headline) && Array.isArray(report?.risks));
  const loneLab = await call('POST', '/api/compatibility/lab', { token: a.token, body: { eventId, userIds: [a.id] } });
  check('the lab refuses a roster of one', loneLab.status === 400, loneLab.status);
  const ghostLab = await call('POST', '/api/compatibility/lab', {
    token: a.token,
    body: { eventId, userIds: [a.id, '00000000-0000-4000-8000-000000000000'] },
  });
  check('the lab names a participant who does not exist', ghostLab.status === 404, ghostLab.status);
  const anonLab = await call('POST', '/api/compatibility/lab', { body: { eventId, userIds: [a.id, b.id] } });
  check('the lab needs a session', anonLab.status === 401, anonLab.status);

  section('teams and pending invitations');
  const created = await call('POST', '/api/teams', {
    token: a.token,
    body: { eventId, name: `E2E Squad ${STAMP}`, maxSize: 4 },
  });
  teamId = created.body?.data?.id;
  check('create a team', created.status === 201 && teamId, created.body);

  const invite = await call('POST', `/api/teams/${teamId}/invitations`, { token: a.token, body: { userId: b.id, message: null } });
  check('invite someone', invite.status === 201, invite.body);

  const pending = await call('GET', `/api/teams/${teamId}/requests`, { token: a.token });
  const pendingInvite = pending.body?.data?.find((request) => request.kind === 'invite');
  check('the team sees who it has invited', pending.status === 200 && pendingInvite?.user?.id === b.id, pending.body);
  check('a pending invite names the person and the team', pendingInvite?.user?.fullName && pendingInvite?.team?.name === `E2E Squad ${STAMP}`, pendingInvite);

  const sent = await call('GET', '/api/teams/requests?direction=outgoing&status=pending', { token: a.token });
  check('the owner’s sent list includes it', sent.body?.data?.some((request) => request.id === pendingInvite?.id), sent.body);
  const received = await call('GET', '/api/teams/requests?direction=incoming&status=pending', { token: b.token });
  check('the invitee sees which team invited them', received.body?.data?.some((request) => request.team?.id === teamId), received.body);

  const outsider = await call('GET', `/api/teams/${teamId}/requests`, { token: b.token });
  check('someone not on the team cannot read its pending list', outsider.status === 403, outsider.status);

  const withdrawn = await call('PATCH', `/api/teams/requests/${pendingInvite?.id}`, { token: a.token, body: { action: 'cancel' } });
  check('the owner can withdraw an invitation', withdrawn.status === 200 && withdrawn.body?.data?.status === 'cancelled', withdrawn.body);
  const afterWithdraw = await call('GET', `/api/teams/${teamId}/requests`, { token: a.token });
  check('a withdrawn invitation leaves the pending list', afterWithdraw.body?.data?.length === 0, afterWithdraw.body);

  const reinvite = await call('POST', `/api/teams/${teamId}/invitations`, { token: a.token, body: { userId: b.id, message: 'Second try' } });
  const accepted = await call('PATCH', `/api/teams/requests/${reinvite.body?.data?.id}`, { token: b.token, body: { action: 'accept' } });
  check('the invitee can accept', accepted.status === 200, accepted.body);
  const memberView = await call('GET', `/api/teams/${teamId}/requests`, { token: b.token });
  check('once on the team, a member can read the pending list', memberView.status === 200, memberView.status);

  const publicPage = await call('GET', `/api/teams/${teamId}/public`);
  check('the public recruiting page links its members', publicPage.body?.data?.members?.every((member) => typeof member.id === 'string'), publicPage.body?.data?.members);
  const profileAfterJoin = await call('GET', `/api/users/${b.id}`);
  check('the profile shows the team they joined', profileAfterJoin.body?.data?.teams?.some((team) => team.id === teamId), profileAfterJoin.body?.data?.teams);

  section('password');
  const wrong = await call('POST', '/api/auth/password', { token: a.token, body: { currentPassword: 'NotIt12345', newPassword: NEW_PASSWORD } });
  check('a wrong current password is refused', wrong.status === 400, wrong.body);
  const weak = await call('POST', '/api/auth/password', { token: a.token, body: { currentPassword: PASSWORD, newPassword: 'short' } });
  check('a weak new password is refused', weak.status === 400, weak.status);
  const changed = await call('POST', '/api/auth/password', { token: a.token, body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD } });
  check('the password changes', changed.status === 204, changed.body);
  const oldLogin = await call('POST', '/api/auth/login', { body: { email: a.email, password: PASSWORD } });
  const newLogin = await call('POST', '/api/auth/login', { body: { email: a.email, password: NEW_PASSWORD } });
  check('the old password stops working', oldLogin.status === 401, oldLogin.status);
  check('the new password works', newLogin.status === 200, newLogin.status);

  section('account deletion');
  const mismatch = await call('DELETE', '/api/users/me', { token: a.token, body: { confirmEmail: 'someone@else.test' } });
  check('deletion needs your own address typed back', mismatch.status === 400, mismatch.status);
  const sharedTeam = await call('DELETE', '/api/users/me', { token: a.token, body: { confirmEmail: a.email } });
  check('an owner cannot delete a team out from under its members', sharedTeam.status === 409, sharedTeam.body);
}

async function cleanUp() {
  section('clean-up');
  const { a, b } = accounts;
  if (teamId && b?.token) await call('POST', `/api/teams/${teamId}/leave`, { token: b.token });
  if (b?.token) {
    const gone = await call('DELETE', '/api/users/me', { token: b.token, body: { confirmEmail: b.email } });
    check('delete account (B)', gone.status === 204, gone.body);
  }
  if (a?.token) {
    const gone = await call('DELETE', '/api/users/me', { token: a.token, body: { confirmEmail: a.email } });
    check('delete account (A), taking its now-solo team with it', gone.status === 204, gone.body);
    const after = await call('POST', '/api/auth/login', { body: { email: a.email, password: NEW_PASSWORD } });
    check('a deleted account cannot sign in', after.status === 401, after.status);
  }
}

try {
  await main();
} catch (error) {
  failures.push('unexpected error');
  console.error('\n  unexpected error:', error);
} finally {
  await cleanUp().catch((error) => {
    failures.push('clean-up');
    console.error('  clean-up failed:', error);
  });
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log(`Failed: ${failures.join('; ')}`);
  process.exitCode = 1;
}
