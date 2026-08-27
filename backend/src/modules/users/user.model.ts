/** Primary roles a participant can pick when they join a team. */
export const PRIMARY_ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Full-Stack Developer',
  'Mobile Developer',
  'AI / ML Engineer',
  'Data Scientist',
  'UI/UX Designer',
  'Product Manager',
  'DevOps Engineer',
  'Cybersecurity',
] as const;

export type PrimaryRole = (typeof PRIMARY_ROLES)[number];

/** Internal shape kept in the store. Never serialised to a client as-is. */
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  primaryRole: PrimaryRole;
  skills: string[];
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Public projection returned by the API. */
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  primaryRole: PrimaryRole;
  skills: string[];
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
  createdAt: string;
}

export function toPublicUser(user: UserRecord): PublicUser {
  const { passwordHash, updatedAt, ...pub } = user;
  void passwordHash;
  void updatedAt;
  return pub;
}
