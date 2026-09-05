import type { EventItem } from './event.model.js';

/**
 * The starter event catalogue. It is no longer read at request time — Sprint 2
 * moved events into Postgres — but it remains the source `npm run db:seed`
 * loads from, so the ids the frontend already links to stay stable.
 *
 * `createdBy` and the timestamps are omitted: the database assigns them, and a
 * seeded event has no organiser account behind it. `statProfile` is omitted
 * too — every seeded event is a normal example of its category, so it uses that
 * category's archetype rather than carrying an override.
 */
export type EventSeed = Omit<
  EventItem,
  'createdBy' | 'createdAt' | 'updatedAt' | 'statProfile'
>;

/**
 * Cover photos are Unsplash URLs, one per event, each confirmed to return 200
 * before being written in. They are sized and cropped by query string so a card
 * cover never pulls a multi-megapixel original.
 *
 * If one ever dies, nothing breaks: `EventCover` falls back to a generated
 * cover keyed on the category.
 */
export const MOCK_EVENTS: EventSeed[] = [
  {
    id: 'evt-001',
    coverImageUrl:
      'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=900&h=600&q=75&auto=format&fit=crop',
    name: 'TapTim Global Hack 2026',
    description:
      'A 48-hour flagship hackathon where cross-functional teams ship a working product from scratch.',
    category: 'Hackathons',
    tags: ['48h', 'Open Track', 'Beginner Friendly'],
    startDate: '2026-09-12T09:00:00.000Z',
    endDate: '2026-09-14T18:00:00.000Z',
    location: 'Baku, Azerbaijan',
    mode: 'hybrid',
    teamSize: { min: 3, max: 5 },
    prizePool: '$25,000',
    registrationDeadline: '2026-09-05T23:59:00.000Z',
    participants: 640,
    featured: true,
  },
  {
    id: 'evt-002',
    coverImageUrl:
      'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=900&h=600&q=75&auto=format&fit=crop',
    name: 'Applied LLM Agents Sprint',
    description:
      'Build autonomous agents that solve a real operational workflow end to end, judged on reliability.',
    category: 'AI',
    tags: ['LLM', 'Agents', 'Advanced'],
    startDate: '2026-09-20T10:00:00.000Z',
    endDate: '2026-09-21T20:00:00.000Z',
    location: 'Online',
    mode: 'online',
    teamSize: { min: 2, max: 4 },
    prizePool: '$12,000',
    registrationDeadline: '2026-09-15T23:59:00.000Z',
    participants: 415,
    featured: true,
  },
  {
    id: 'evt-003',
    coverImageUrl:
      'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=900&h=600&q=75&auto=format&fit=crop',
    name: 'Product Design Jam',
    description:
      'Designers and researchers reimagine a public service interface in one intense weekend.',
    category: 'Design',
    tags: ['UX Research', 'Figma', 'Prototyping'],
    startDate: '2026-10-03T09:30:00.000Z',
    endDate: '2026-10-04T17:00:00.000Z',
    location: 'Istanbul, Türkiye',
    mode: 'onsite',
    teamSize: { min: 2, max: 4 },
    prizePool: '$6,000',
    registrationDeadline: '2026-09-27T23:59:00.000Z',
    participants: 180,
    featured: false,
  },
  {
    id: 'evt-004',
    coverImageUrl:
      'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=900&h=600&q=75&auto=format&fit=crop',
    name: 'Competitive Programming Cup',
    description:
      'Team-based algorithmic contest across five rounds of increasing difficulty.',
    category: 'Programming',
    tags: ['Algorithms', 'ICPC Style', 'Team of 3'],
    startDate: '2026-09-28T08:00:00.000Z',
    endDate: '2026-09-28T14:00:00.000Z',
    location: 'Online',
    mode: 'online',
    teamSize: { min: 3, max: 3 },
    prizePool: '$8,500',
    registrationDeadline: '2026-09-24T23:59:00.000Z',
    participants: 902,
    featured: false,
  },
  {
    id: 'evt-005',
    coverImageUrl:
      'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=900&h=600&q=75&auto=format&fit=crop',
    name: 'ZeroDay Defense CTF',
    description:
      'Attack-and-defend capture the flag with live scoreboard and infrastructure hardening rounds.',
    category: 'Cybersecurity',
    tags: ['CTF', 'Blue Team', 'Red Team'],
    startDate: '2026-10-10T12:00:00.000Z',
    endDate: '2026-10-11T12:00:00.000Z',
    location: 'Berlin, Germany',
    mode: 'onsite',
    teamSize: { min: 3, max: 6 },
    prizePool: '$15,000',
    registrationDeadline: '2026-10-01T23:59:00.000Z',
    participants: 260,
    featured: true,
  },
  {
    id: 'evt-006',
    coverImageUrl:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&h=600&q=75&auto=format&fit=crop',
    name: 'Open Data Insight Challenge',
    description:
      'Turn municipal open data into a decision-ready dashboard and a defensible recommendation.',
    category: 'Data Science',
    tags: ['Open Data', 'Visualization', 'Statistics'],
    startDate: '2026-10-17T09:00:00.000Z',
    endDate: '2026-10-18T18:00:00.000Z',
    location: 'Online',
    mode: 'online',
    teamSize: { min: 2, max: 5 },
    prizePool: '$7,000',
    registrationDeadline: '2026-10-12T23:59:00.000Z',
    participants: 334,
    featured: false,
  },
  {
    id: 'evt-007',
    coverImageUrl:
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=900&h=600&q=75&auto=format&fit=crop',
    name: 'Founders Weekend',
    description:
      'From idea to pitch deck in 54 hours, mentored by operators and closed with an investor panel.',
    category: 'Startup',
    tags: ['Pitch', 'MVP', 'Mentorship'],
    startDate: '2026-11-06T17:00:00.000Z',
    endDate: '2026-11-08T21:00:00.000Z',
    location: 'Dubai, UAE',
    mode: 'onsite',
    teamSize: { min: 3, max: 5 },
    prizePool: '$20,000',
    registrationDeadline: '2026-10-30T23:59:00.000Z',
    participants: 210,
    featured: false,
  },
  {
    id: 'evt-008',
    coverImageUrl:
      'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=900&h=600&q=75&auto=format&fit=crop',
    name: 'On-Chain Builders Hack',
    description:
      'Ship a smart-contract product with a real user flow; audited demos score highest.',
    category: 'Web3',
    tags: ['Solidity', 'DeFi', 'Audits'],
    startDate: '2026-11-14T10:00:00.000Z',
    endDate: '2026-11-16T16:00:00.000Z',
    location: 'Online',
    mode: 'hybrid',
    teamSize: { min: 2, max: 4 },
    prizePool: '$18,000',
    registrationDeadline: '2026-11-07T23:59:00.000Z',
    participants: 288,
    featured: false,
  },
  {
    id: 'evt-009',
    coverImageUrl:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&h=600&q=75&auto=format&fit=crop',
    name: 'Computer Vision Grand Prix',
    description:
      'Train and deploy a vision model under a strict latency budget on edge hardware.',
    category: 'AI',
    tags: ['Vision', 'Edge', 'MLOps'],
    startDate: '2026-11-21T09:00:00.000Z',
    endDate: '2026-11-22T19:00:00.000Z',
    location: 'Tbilisi, Georgia',
    mode: 'onsite',
    teamSize: { min: 2, max: 4 },
    prizePool: '$10,000',
    registrationDeadline: '2026-11-14T23:59:00.000Z',
    participants: 195,
    featured: false,
  },
  {
    id: 'evt-010',
    coverImageUrl:
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=900&h=600&q=75&auto=format&fit=crop',
    name: 'Accessibility First Sprint',
    description:
      'Rebuild a widely used interface to meet WCAG 2.2 AA, judged with assistive tech in the room.',
    category: 'Design',
    tags: ['a11y', 'WCAG', 'Inclusive Design'],
    startDate: '2026-12-05T09:00:00.000Z',
    endDate: '2026-12-06T17:00:00.000Z',
    location: 'Online',
    mode: 'online',
    teamSize: { min: 2, max: 4 },
    prizePool: '$5,000',
    registrationDeadline: '2026-11-29T23:59:00.000Z',
    participants: 148,
    featured: false,
  },
  {
    id: 'evt-011',
    coverImageUrl:
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=900&h=600&q=75&auto=format&fit=crop',
    name: 'Systems Programming Marathon',
    description:
      'Low-level challenge set spanning schedulers, allocators, and lock-free data structures.',
    category: 'Programming',
    tags: ['Rust', 'C++', 'Performance'],
    startDate: '2026-12-12T08:00:00.000Z',
    endDate: '2026-12-13T20:00:00.000Z',
    location: 'Online',
    mode: 'online',
    teamSize: { min: 1, max: 3 },
    prizePool: '$9,000',
    registrationDeadline: '2026-12-06T23:59:00.000Z',
    participants: 377,
    featured: false,
  },
  {
    id: 'evt-012',
    coverImageUrl:
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=900&h=600&q=75&auto=format&fit=crop',
    name: 'Winter Campus Hackathon',
    description:
      'Student-only hackathon with a mentorship track for first-time participants.',
    category: 'Hackathons',
    tags: ['Students', 'Beginner Friendly', 'Mentored'],
    startDate: '2026-12-19T10:00:00.000Z',
    endDate: '2026-12-20T18:00:00.000Z',
    location: 'Baku, Azerbaijan',
    mode: 'onsite',
    teamSize: { min: 3, max: 5 },
    prizePool: '$4,000',
    registrationDeadline: '2026-12-13T23:59:00.000Z',
    participants: 420,
    featured: false,
  },
  {
    id: 'evt-013',
    coverImageUrl:
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=900&h=600&q=75&auto=format&fit=crop',
    name: 'Caspian Game Jam',
    description:
      'A 72-hour game jam on a theme announced at kickoff. Engine skill and art carry it — ship something playable.',
    category: 'Gaming',
    tags: ['72h', 'Unity', 'Godot', 'Theme reveal'],
    startDate: '2026-10-16T18:00:00.000Z',
    endDate: '2026-10-19T18:00:00.000Z',
    location: 'Baku, Azerbaijan',
    mode: 'hybrid',
    teamSize: { min: 2, max: 5 },
    prizePool: '$6,000',
    registrationDeadline: '2026-10-12T23:59:00.000Z',
    participants: 210,
    featured: true,
  },
];
