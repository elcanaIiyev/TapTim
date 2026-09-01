import bcrypt from 'bcryptjs';
import { MOCK_EVENTS } from '../modules/events/event.data.js';
import { closePool, query } from './pool.js';
import { runMigrations } from './migrate.js';

/**
 * Seeds the Sprint 1 event catalogue and a small set of demo participants.
 *
 * Every statement is an upsert keyed on a natural key, so running the seed
 * twice is harmless and never duplicates a row.
 */

const DEMO_PASSWORD = 'demo1234';

interface DemoUser {
  email: string;
  fullName: string;
  primaryRole: string;
  skills: string[];
  bio: string;
  experienceLevel: string;
  availability: string[];
  hoursPerWeek: number;
  timezoneOffset: number;
  personality: Record<string, number>;
}

/**
 * Deliberately varied: different roles, overlapping-but-not-identical skills,
 * and different schedules, so the compatibility engine produces a spread of
 * scores rather than a flat list.
 */
const DEMO_USERS: DemoUser[] = [
  {
    email: 'ada@taptim.dev',
    fullName: 'Ada Rzayeva',
    primaryRole: 'Backend Developer',
    skills: ['Node.js', 'PostgreSQL', 'TypeScript', 'Docker'],
    bio: 'API and data-model person. I like getting the schema right before anyone writes a component.',
    experienceLevel: 'advanced',
    availability: ['weekday-evenings', 'weekend-mornings', 'weekend-afternoons'],
    hoursPerWeek: 20,
    timezoneOffset: 4,
    personality: { leadership: 4, communication: 4, structure: 5, pace: 3, risk: 2 },
  },
  {
    email: 'kenan@taptim.dev',
    fullName: 'Kenan Mammadov',
    primaryRole: 'Frontend Developer',
    skills: ['React', 'TypeScript', 'Tailwind CSS', 'Vite'],
    bio: 'I build the parts people actually touch. Obsessive about loading and empty states.',
    experienceLevel: 'intermediate',
    availability: ['weekday-evenings', 'weekend-afternoons'],
    hoursPerWeek: 18,
    timezoneOffset: 4,
    personality: { leadership: 2, communication: 5, structure: 3, pace: 4, risk: 3 },
  },
  {
    email: 'leyla@taptim.dev',
    fullName: 'Leyla Hasanova',
    primaryRole: 'UI/UX Designer',
    skills: ['Figma', 'Design Systems', 'Prototyping', 'User Research'],
    bio: 'Designer who ships. I prototype in Figma and stay in the room while it gets built.',
    experienceLevel: 'advanced',
    availability: ['weekday-mornings', 'weekday-afternoons', 'weekend-afternoons'],
    hoursPerWeek: 25,
    timezoneOffset: 4,
    personality: { leadership: 3, communication: 5, structure: 4, pace: 3, risk: 4 },
  },
  {
    email: 'tural@taptim.dev',
    fullName: 'Tural Aliyev',
    primaryRole: 'AI / ML Engineer',
    skills: ['Python', 'PyTorch', 'LLMs', 'Vector Search'],
    bio: 'Applied ML. I care more about evaluation than about the demo looking clever.',
    experienceLevel: 'expert',
    availability: ['weekday-evenings', 'weekend-mornings'],
    hoursPerWeek: 15,
    timezoneOffset: 4,
    personality: { leadership: 3, communication: 3, structure: 4, pace: 2, risk: 4 },
  },
  {
    email: 'nigar@taptim.dev',
    fullName: 'Nigar Quliyeva',
    primaryRole: 'Product Manager',
    skills: ['Roadmapping', 'User Research', 'Analytics', 'Pitching'],
    bio: 'I keep scope honest and make sure we can explain the thing in one sentence.',
    experienceLevel: 'intermediate',
    availability: ['weekday-mornings', 'weekday-afternoons', 'weekday-evenings'],
    hoursPerWeek: 30,
    timezoneOffset: 4,
    personality: { leadership: 5, communication: 5, structure: 4, pace: 4, risk: 3 },
  },
  {
    email: 'orkhan@taptim.dev',
    fullName: 'Orkhan Suleymanli',
    primaryRole: 'DevOps Engineer',
    skills: ['Docker', 'CI/CD', 'AWS', 'Terraform'],
    bio: 'Deploys, pipelines, and the boring reliability work nobody volunteers for.',
    experienceLevel: 'advanced',
    availability: ['weekend-mornings', 'weekend-afternoons', 'weekend-evenings'],
    hoursPerWeek: 12,
    timezoneOffset: 3,
    personality: { leadership: 2, communication: 3, structure: 5, pace: 3, risk: 1 },
  },
  {
    email: 'sabina@taptim.dev',
    fullName: 'Sabina Karimova',
    primaryRole: 'Data Scientist',
    skills: ['Python', 'Pandas', 'SQL', 'Visualisation'],
    bio: 'I turn the messy CSV into the chart that decides the argument.',
    experienceLevel: 'intermediate',
    availability: ['weekday-afternoons', 'weekend-mornings'],
    hoursPerWeek: 22,
    timezoneOffset: 4,
    personality: { leadership: 2, communication: 4, structure: 4, pace: 3, risk: 2 },
  },
  {
    email: 'emin@taptim.dev',
    fullName: 'Emin Bayramov',
    primaryRole: 'Full-Stack Developer',
    skills: ['React', 'Node.js', 'PostgreSQL', 'GraphQL'],
    bio: 'Comfortable anywhere in the stack. Happiest gluing the last 20% together.',
    experienceLevel: 'advanced',
    availability: ['weekday-evenings', 'weekend-mornings', 'weekend-evenings'],
    hoursPerWeek: 20,
    timezoneOffset: 4,
    personality: { leadership: 4, communication: 4, structure: 3, pace: 5, risk: 4 },
  },
];

async function seedEvents(): Promise<number> {
  for (const event of MOCK_EVENTS) {
    await query(
      `insert into events (
         id, name, description, category, tags, start_date, end_date, location,
         mode, team_size_min, team_size_max, prize_pool, registration_deadline,
         participants, featured
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       on conflict (id) do update set
         name = excluded.name,
         description = excluded.description,
         category = excluded.category,
         tags = excluded.tags,
         start_date = excluded.start_date,
         end_date = excluded.end_date,
         location = excluded.location,
         mode = excluded.mode,
         team_size_min = excluded.team_size_min,
         team_size_max = excluded.team_size_max,
         prize_pool = excluded.prize_pool,
         registration_deadline = excluded.registration_deadline,
         participants = excluded.participants,
         featured = excluded.featured`,
      [
        event.id,
        event.name,
        event.description,
        event.category,
        event.tags,
        event.startDate,
        event.endDate,
        event.location,
        event.mode,
        event.teamSize.min,
        event.teamSize.max,
        event.prizePool,
        event.registrationDeadline,
        event.participants,
        event.featured,
      ],
    );
  }
  return MOCK_EVENTS.length;
}

async function seedUsers(): Promise<number> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const user of DEMO_USERS) {
    await query(
      `insert into users (
         email, password_hash, full_name, primary_role, skills, bio,
         experience_level, availability, hours_per_week, timezone_offset,
         personality, looking_for_team
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,true)
       on conflict (email) do update set
         full_name = excluded.full_name,
         primary_role = excluded.primary_role,
         skills = excluded.skills,
         bio = excluded.bio,
         experience_level = excluded.experience_level,
         availability = excluded.availability,
         hours_per_week = excluded.hours_per_week,
         timezone_offset = excluded.timezone_offset,
         personality = excluded.personality`,
      [
        user.email,
        passwordHash,
        user.fullName,
        user.primaryRole,
        user.skills,
        user.bio,
        user.experienceLevel,
        user.availability,
        user.hoursPerWeek,
        user.timezoneOffset,
        JSON.stringify(user.personality),
      ],
    );
  }
  return DEMO_USERS.length;
}

try {
  // Seeding a database with no schema is the most common way to run this by
  // mistake, so migrate first rather than failing on a missing table.
  await runMigrations();

  const events = await seedEvents();
  const users = await seedUsers();

  console.log(`[seed] ${events} events upserted.`);
  console.log(`[seed] ${users} demo participants upserted (password: ${DEMO_PASSWORD}).`);
} catch (error) {
  console.error('[seed] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closePool();
}
