import { toIso } from '../../utils/dates.js';

export const EVENT_CATEGORIES = [
  'Hackathons',
  'AI',
  'Programming',
  'Design',
  'Web3',
  'Cybersecurity',
  'Startup',
  'Data Science',
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_MODES = ['onsite', 'online', 'hybrid'] as const;
export type EventMode = (typeof EVENT_MODES)[number];

export interface EventItem {
  id: string;
  name: string;
  description: string;
  category: EventCategory;
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
  /** Null for the seeded catalogue; set for organiser-created events. */
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventRow {
  id: string;
  name: string;
  description: string;
  category: string;
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
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export function mapEventRow(row: EventRow): EventItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category as EventCategory,
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
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
