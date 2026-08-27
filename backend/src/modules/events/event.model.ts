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

export interface EventItem {
  id: string;
  name: string;
  description: string;
  category: EventCategory;
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
