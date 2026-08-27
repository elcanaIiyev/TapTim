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

export interface User {
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

export interface AuthResult {
  user: User;
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface EventItem {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  startDate: string;
  endDate: string;
  location: string;
  mode: 'onsite' | 'online' | 'hybrid';
  teamSize: { min: number; max: number };
  prizePool: string | null;
  registrationDeadline: string;
  participants: number;
  featured: boolean;
}

export interface CategoryCount {
  name: string;
  count: number;
}

export interface SignupPayload {
  email: string;
  password: string;
  fullName: string;
  primaryRole: PrimaryRole;
  skills?: string[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface FieldIssue {
  field: string;
  message: string;
}
