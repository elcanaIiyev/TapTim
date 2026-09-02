import { toIso } from '../../utils/dates.js';
import type { DirectoryUser, TeamRole } from '../users/user.model.js';

export const TEAM_STATUSES = ['recruiting', 'full', 'locked', 'disbanded'] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

export const REQUEST_KINDS = ['invite', 'application'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_STATUSES = ['pending', 'accepted', 'declined', 'cancelled'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface TeamRecord {
  id: string;
  eventId: string;
  ownerId: string;
  name: string;
  description: string | null;
  lookingFor: TeamRole[];
  requiredSkills: string[];
  maxSize: number;
  status: TeamStatus;
  memberCount: number;
  openSeats: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  userId: string;
  role: TeamRole;
  isOwner: boolean;
  joinedAt: string;
  user: DirectoryUser;
}

export interface TeamDetail extends TeamRecord {
  members: TeamMember[];
}

export interface TeamRequestRecord {
  id: string;
  teamId: string;
  userId: string;
  kind: RequestKind;
  status: RequestStatus;
  message: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamRow {
  id: string;
  event_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  looking_for: string[];
  required_skills: string[];
  max_size: number;
  status: string;
  member_count: string | number;
  created_at: Date;
  updated_at: Date;
}

export function mapTeamRow(row: TeamRow): TeamRecord {
  const memberCount = Number(row.member_count ?? 0);
  return {
    id: row.id,
    eventId: row.event_id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    lookingFor: (row.looking_for ?? []) as TeamRole[],
    requiredSkills: row.required_skills ?? [],
    maxSize: row.max_size,
    status: row.status as TeamStatus,
    memberCount,
    openSeats: Math.max(0, row.max_size - memberCount),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export interface TeamRequestRow {
  id: string;
  team_id: string;
  user_id: string;
  kind: string;
  status: string;
  message: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export function mapTeamRequestRow(row: TeamRequestRow): TeamRequestRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    kind: row.kind as RequestKind,
    status: row.status as RequestStatus,
    message: row.message,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
