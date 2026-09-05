import { toIso } from '../../utils/dates.js';
import type { EventStatProfileOverride } from './event-stats.js';

/**
 * How an event runs.
 *
 * This is the axis that decides *scoring*: a weekend build lives on overlapping
 * hours and a broad roster, a capture-the-flag lives on proven depth. It says
 * nothing about subject matter — that is `EVENT_DOMAINS`.
 */
export const EVENT_FORMATS = [
  'Hackathon',
  'Jam',
  'Capture the Flag',
  'Competitive contest',
  'Sprint',
  'Startup weekend',
] as const;

export type EventFormat = (typeof EVENT_FORMATS)[number];

/**
 * What an event is about.
 *
 * Several per event, because most events genuinely are: a hackathon judged on
 * a working product is Web *and* Product & business, and a game jam is Game
 * development *and* Design. Forcing one was the whole problem with the old
 * single `category` — a design hackathon had nowhere to sit, and filing it
 * under either axis hid it from the people looking along the other.
 */
export const EVENT_DOMAINS = [
  'AI & ML',
  'Data',
  'Web',
  'Mobile',
  'Game development',
  'Design',
  'Security',
  'Web3',
  'Hardware & IoT',
  'Product & business',
] as const;

export type EventDomain = (typeof EVENT_DOMAINS)[number];

/** Mirrors the check constraint in `016_event_taxonomy.sql`. */
export const MAX_EVENT_DOMAINS = 4;

export const EVENT_MODES = ['onsite', 'online', 'hybrid'] as const;
export type EventMode = (typeof EVENT_MODES)[number];

export interface EventItem {
  id: string;
  name: string;
  description: string;
  format: EventFormat;
  /** What it is about, 1–4. */
  domains: EventDomain[];
  tags: string[];
  startDate: string;
  endDate: string;
  location: string;
  mode: EventMode;
  teamSize: { min: number; max: number };
  prizePool: string | null;
  registrationDeadline: string;
  participants: number;
  featured: boolean;
  /**
   * Cover image. Null falls back to a generated cover keyed on the category, so
   * an event without one still looks deliberate rather than unfinished.
   */
  coverImageUrl: string | null;
  /**
   * Which skill areas, roles and scoring weights this event rewards. Null means
   * "whatever this category normally means" — the archetype in `event-stats.ts`.
   */
  statProfile: EventStatProfileOverride | null;
  /** Null for the seeded catalogue; set for organiser-created events. */
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventRow {
  id: string;
  name: string;
  description: string;
  format: string;
  domains: string[];
  tags: string[];
  start_date: Date;
  end_date: Date;
  location: string;
  mode: string;
  team_size_min: number;
  team_size_max: number;
  prize_pool: string | null;
  registration_deadline: Date;
  participants: number;
  featured: boolean;
  cover_image_url: string | null;
  stat_profile: EventStatProfileOverride | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export function mapEventRow(row: EventRow): EventItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    format: row.format as EventFormat,
    domains: (row.domains ?? []) as EventDomain[],
    tags: row.tags ?? [],
    startDate: toIso(row.start_date),
    endDate: toIso(row.end_date),
    location: row.location,
    mode: row.mode as EventMode,
    teamSize: { min: row.team_size_min, max: row.team_size_max },
    prizePool: row.prize_pool,
    registrationDeadline: toIso(row.registration_deadline),
    participants: row.participants,
    featured: row.featured,
    coverImageUrl: row.cover_image_url,
    statProfile: row.stat_profile,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
