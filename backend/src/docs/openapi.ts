import { env } from '../config/env.js';
import { CERTIFICATE_STATUSES } from '../modules/certificates/certificate.model.js';
import {
  EVENT_DOMAINS,
  EVENT_FORMATS,
  EVENT_MODES,
  MAX_EVENT_DOMAINS,
} from '../modules/events/event.model.js';
import { TEAM_STATUSES } from '../modules/teams/team.model.js';
import { NOTIFICATION_KINDS } from '../data/notification.store.js';
import { ACCOUNT_ROLES } from '../modules/users/account-role.js';
import { EXPERIENCE_KINDS, PRONOUN_OPTIONS } from '../modules/users/profile-options.js';
import {
  MAX_SKILL_LEVEL,
  MIN_SKILL_LEVEL,
  SKILL_LEVELS,
} from '../modules/users/skill-catalogue.js';
import {
  AVAILABILITY_SLOTS,
  EXPERIENCE_LEVELS,
  MAX_TEAM_ROLES,
  PERSONALITY_TRAITS,
  TEAM_ROLES,
} from '../modules/users/user.model.js';

/**
 * Hand-authored OpenAPI 3.0.3 document.
 *
 * It is written as a TypeScript object rather than a YAML file so the enums
 * below are the *same* constants the validators use — a role added to
 * `TEAM_ROLES` shows up in the docs without anyone remembering to update
 * them.
 */

const errorResponse = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'VALIDATION_ERROR' },
        message: { type: 'string', example: 'Request validation failed.' },
        details: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string', example: 'email' },
              message: { type: 'string', example: 'Provide a valid email address.' },
            },
          },
        },
      },
      required: ['code', 'message'],
    },
  },
};

// -- response helpers ---------------------------------------------------------

function ref(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}

function errorFor(description: string) {
  return {
    description,
    content: { 'application/json': { schema: ref('ErrorResponse') } },
  };
}

/** `{ data: <schema> }` — the envelope every single-resource response uses. */
function dataResponse(description: string, schema: object) {
  return {
    description,
    content: {
      'application/json': {
        schema: { type: 'object', properties: { data: schema } },
      },
    },
  };
}

/** `{ data: [<schema>], meta: { total, limit, offset } }` for list endpoints. */
function listResponse(description: string, schema: object, paginated = true) {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            data: { type: 'array', items: schema },
            meta: {
              type: 'object',
              properties: {
                total: { type: 'integer', example: 12 },
                ...(paginated
                  ? {
                      limit: { type: 'integer', example: 20 },
                      offset: { type: 'integer', example: 0 },
                    }
                  : {}),
              },
            },
          },
        },
      },
    },
  };
}

function jsonBody(schema: object, required = true) {
  return {
    required,
    content: { 'application/json': { schema } },
  };
}

function pathParam(name: string, description: string, format?: string) {
  return {
    name,
    in: 'path',
    required: true,
    schema: format ? { type: 'string', format } : { type: 'string' },
    description,
  };
}

function queryParam(name: string, schema: object, description: string) {
  return { name, in: 'query', required: false, schema, description };
}

const paginationParams = [
  queryParam('limit', { type: 'integer', minimum: 1, maximum: 50, default: 20 }, 'Page size.'),
  queryParam('offset', { type: 'integer', minimum: 0, default: 0 }, 'Page offset.'),
];

const AUTH = [{ bearerAuth: [] }];

const RESP_400 = errorFor('Validation failed.');
const RESP_401 = errorFor('Missing, malformed, or expired access token.');
const RESP_403 = errorFor('Authenticated, but not allowed to do this.');
const RESP_404 = errorFor('Resource not found.');

// -- schemas ------------------------------------------------------------------

const personalityProperties = Object.fromEntries(
  PERSONALITY_TRAITS.map((trait) => [
    trait,
    { type: 'integer', minimum: 1, maximum: 5, example: 3 },
  ]),
);

const profileFields = {
  id: { type: 'string', format: 'uuid' },
  fullName: { type: 'string', example: 'Ada Rzayeva' },
roles: {
        type: 'array',
        items: ref('TeamRole'),
        minItems: 1,
        maxItems: MAX_TEAM_ROLES,
        description: 'Positions this person can play. Not job titles.',
      },
  skills: { type: 'array', items: { type: 'string' }, example: ['React', 'Node.js'] },
  bio: { type: 'string', nullable: true },
  avatarUrl: { type: 'string', nullable: true },
  verified: {
    type: 'boolean',
    example: false,
    description: 'True when the account has at least one verified certificate.',
  },
  experienceLevel: ref('ExperienceLevel'),
  availability: { type: 'array', items: ref('AvailabilitySlot') },
  availabilityConfirmedAt: {
    type: 'string',
    format: 'date-time',
    nullable: true,
    description:
      'When availability was last confirmed as still true. Distinct from `updatedAt`, which ' +
      'moves on any profile edit — an availability answer nobody has revisited in months is ' +
      'the quietest way this engine goes wrong.',
  },
  hoursPerWeek: { type: 'integer', nullable: true, minimum: 0, maximum: 80, example: 20 },
  timezoneOffset: {
    type: 'integer',
    nullable: true,
    minimum: -12,
    maximum: 14,
    example: 4,
    description: 'Whole-hour UTC offset.',
  },
  personality: ref('Personality'),
  lookingForTeam: { type: 'boolean', example: true },
  githubUrl: { type: 'string', nullable: true },
  linkedinUrl: { type: 'string', nullable: true },
  portfolioUrl: { type: 'string', nullable: true },
  createdAt: { type: 'string', format: 'date-time' },
};

const schemas = {
  ErrorResponse: errorResponse,

  TeamRole: { type: 'string', enum: [...TEAM_ROLES], example: TEAM_ROLES[2] },
  ExperienceLevel: { type: 'string', enum: [...EXPERIENCE_LEVELS], example: 'intermediate' },
  AvailabilitySlot: { type: 'string', enum: [...AVAILABILITY_SLOTS], example: 'weekday-evenings' },
  EventFormat: {
    type: 'string',
    enum: [...EVENT_FORMATS],
    description: 'How the event runs. Drives the scoring weights.',
    example: 'Hackathon',
  },

  EventDomain: {
    type: 'string',
    enum: [...EVENT_DOMAINS],
    description: 'What the event is about. Drives the focus areas.',
    example: 'Web',
  },
  EventMode: { type: 'string', enum: [...EVENT_MODES], example: 'hybrid' },
  TeamStatus: { type: 'string', enum: [...TEAM_STATUSES], example: 'recruiting' },
  CertificateStatus: { type: 'string', enum: [...CERTIFICATE_STATUSES], example: 'verified' },

  Personality: {
    type: 'object',
    description:
      'Working-style answers, each scored 1–5. Traits may be omitted; an omitted trait ' +
      'is treated as unknown by the compatibility engine rather than as a middling score.',
    properties: personalityProperties,
  },

  /** The signed-in account's own view — includes the email. */
  User: {
    type: 'object',
    properties: {
      ...profileFields,
      email: { type: 'string', format: 'email', example: 'ada@taptim.dev' },
    },
  },

  /**
   * How other participants appear. Email is deliberately absent: nothing in the
   * matching UI needs it, so it is never exposed outside the owning account.
   */
  Participant: {
    type: 'object',
    properties: {
      ...profileFields,
      verifiedCertificates: { type: 'integer', example: 2 },
      profileCompleteness: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        example: 75,
        description: 'How much of the matching-relevant profile is filled in.',
      },
      next: {
        type: 'string',
        enum: ['verify-email', 'onboarding', 'dashboard'],
        description:
          'Where this account should be sent. The server decides, so clients do not ' +
          'reimplement the rule — `verify-email` is only ever returned when ' +
          '`REQUIRE_EMAIL_VERIFICATION` is on.',
      },
    },
  },

  AuthResult: {
    type: 'object',
    properties: {
      user: ref('User'),
      accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs…' },
      tokenType: { type: 'string', example: 'Bearer' },
      expiresIn: { type: 'integer', example: 604800 },
    },
  },

  SignupRequest: {
    type: 'object',
    required: ['email', 'password', 'fullName'],
    properties: {
      email: { type: 'string', format: 'email', example: 'ada@taptim.dev' },
      password: { type: 'string', minLength: 8, maxLength: 128, example: 'hunter2hunter2' },
      fullName: { type: 'string', minLength: 2, maxLength: 80, example: 'Ada Rzayeva' },
      roles: {
        type: 'array',
        items: ref('TeamRole'),
        minItems: 1,
        maxItems: MAX_TEAM_ROLES,
        description: 'Positions this person can play. Not job titles.',
      },
      skills: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    },
  },

  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'ada@taptim.dev' },
      password: { type: 'string', example: 'demo1234' },
    },
  },

  UpdateProfileRequest: {
    type: 'object',
    minProperties: 1,
    description: 'Every field is optional; send only what changed.',
    properties: {
      fullName: { type: 'string', minLength: 2, maxLength: 80 },
      roles: {
        type: 'array',
        items: ref('TeamRole'),
        minItems: 1,
        maxItems: MAX_TEAM_ROLES,
        description: 'Positions this person can play. Not job titles.',
      },
      skills: { type: 'array', items: { type: 'string' }, maxItems: 20 },
      bio: { type: 'string', maxLength: 600, nullable: true },
      avatarUrl: { type: 'string', format: 'uri', nullable: true },
      experienceLevel: ref('ExperienceLevel'),
      availability: { type: 'array', items: ref('AvailabilitySlot') },
      hoursPerWeek: { type: 'integer', minimum: 0, maximum: 80, nullable: true },
      timezoneOffset: { type: 'integer', minimum: -12, maximum: 14, nullable: true },
      personality: ref('Personality'),
      lookingForTeam: { type: 'boolean' },
      githubUrl: { type: 'string', format: 'uri', nullable: true },
      linkedinUrl: { type: 'string', format: 'uri', nullable: true },
      portfolioUrl: { type: 'string', format: 'uri', nullable: true },
    },
  },

  Event: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'evt-001' },
      name: { type: 'string', example: 'TapTim Global Hack 2026' },
      description: { type: 'string' },
      format: ref('EventFormat'),
      domains: {
        type: 'array',
        items: ref('EventDomain'),
        minItems: 1,
        maxItems: MAX_EVENT_DOMAINS,
        description:
          'What it is about. Several, because most events are — a hackathon judged on a ' +
          'working product is Web *and* Product & business.',
      },
      tags: { type: 'array', items: { type: 'string' }, example: ['48h', 'Open Track'] },
      coverImageUrl: {
        type: 'string',
        nullable: true,
        description:
          'Cover image. Null falls back to a cover generated from the category, so a ' +
          'missing or dead URL degrades to something deliberate rather than a broken image.',
      },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      location: { type: 'string', example: 'Baku, Azerbaijan' },
      mode: ref('EventMode'),
      teamSize: {
        type: 'object',
        properties: { min: { type: 'integer', example: 3 }, max: { type: 'integer', example: 5 } },
      },
      prizePool: { type: 'string', nullable: true, example: '$25,000' },
      registrationDeadline: { type: 'string', format: 'date-time' },
      participants: { type: 'integer', example: 640 },
      featured: { type: 'boolean' },
      createdBy: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'Null for the seeded catalogue, which is read-only.',
      },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  EventUpdateRequest: {
    allOf: [
      ref('EventWriteRequest'),
      {
        type: 'object',
        properties: { statProfile: ref('StatProfileOverride') },
      },
    ],
  },

  EventWriteRequest: {
    type: 'object',
    required: [
      'name',
      'description',
      'category',
      'startDate',
      'endDate',
      'location',
      'mode',
      'teamSize',
      'registrationDeadline',
    ],
    description:
      '`endDate` must be on or after `startDate`, and `registrationDeadline` on or before it.',
    properties: {
      name: { type: 'string', minLength: 3, maxLength: 120 },
      description: { type: 'string', minLength: 20, maxLength: 2000 },
      format: ref('EventFormat'),
      domains: {
        type: 'array',
        items: ref('EventDomain'),
        minItems: 1,
        maxItems: MAX_EVENT_DOMAINS,
      },
      tags: { type: 'array', items: { type: 'string' }, maxItems: 10 },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      location: { type: 'string', minLength: 2, maxLength: 120 },
      mode: ref('EventMode'),
      teamSize: {
        type: 'object',
        required: ['min', 'max'],
        properties: {
          min: { type: 'integer', minimum: 1, maximum: 12 },
          max: { type: 'integer', minimum: 1, maximum: 12 },
        },
      },
      prizePool: { type: 'string', maxLength: 60, nullable: true },
      registrationDeadline: { type: 'string', format: 'date-time' },
      participants: { type: 'integer', minimum: 0, default: 0 },
      featured: { type: 'boolean', default: false },
    },
  },

  StatProfileOverride: {
    type: 'object',
    nullable: true,
    description:
      "An organiser's override of how their event is scored. Every field is optional and " +
      'falls back to the archetype composed from format and domains, so one thing can be ' +
      'adjusted without restating the rest. `null` clears the override entirely — a ' +
      'different intent from "change nothing", which is `undefined`.',
    properties: {
      summary: { type: 'string', minLength: 10, maxLength: 400 },
      weights: {
        type: 'object',
        description:
          'Must add up to exactly 100. Not normalised silently: a weighting is a statement ' +
          'about relative importance, and numbers adding to 140 mean something the organiser ' +
          'did not say.',
        properties: {
          skills: { type: 'integer', minimum: 0, maximum: 100 },
          roles: { type: 'integer', minimum: 0, maximum: 100 },
          availability: { type: 'integer', minimum: 0, maximum: 100 },
          workingStyle: { type: 'integer', minimum: 0, maximum: 100 },
          credibility: { type: 'integer', minimum: 0, maximum: 100 },
        },
      },
      focusAreas: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 6,
        description:
          'Skill-catalogue category names, most important first. Validated against the ' +
          'catalogue — anything outside it would name an area nobody can ever cover.',
      },
      keyRoles: { type: 'array', items: ref('TeamRole'), maxItems: 8 },
    },
  },

  EventFacets: {
    type: 'object',
    description:
      'Both filter axes with live counts. Domain counts are not a partition — an event ' +
      'tagged Web *and* Design is counted under both, so they sum to more than the number ' +
      'of events.',
    properties: {
      formats: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: ref('EventFormat'), count: { type: 'integer' } },
        },
      },
      domains: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: ref('EventDomain'), count: { type: 'integer' } },
        },
      },
    },
  },

  TeamMember: {
    type: 'object',
    properties: {
      userId: { type: 'string', format: 'uuid' },
      role: ref('TeamRole'),
      isOwner: { type: 'boolean' },
      joinedAt: { type: 'string', format: 'date-time' },
      user: ref('Participant'),
    },
  },

  Team: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      eventId: { type: 'string', example: 'evt-001' },
      ownerId: { type: 'string', format: 'uuid' },
      name: { type: 'string', example: 'Kernel Panic' },
      description: { type: 'string', nullable: true },
      lookingFor: {
        type: 'array',
        items: ref('TeamRole'),
        description: 'Roles the team still needs. Drives suggestion ranking.',
      },
      requiredSkills: { type: 'array', items: { type: 'string' } },
      maxSize: { type: 'integer', example: 5 },
      status: ref('TeamStatus'),
      logoUrl: {
        type: 'string',
        nullable: true,
        description: 'Null falls back to a generated monogram in the UI.',
      },
      unread: {
        type: 'integer',
        description:
          "Unread channel messages for the caller. Present only on `?mine=true`, where " +
          'the badge is actually shown.',
      },
      memberCount: { type: 'integer', example: 3 },
      openSeats: { type: 'integer', example: 2 },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  TeamDetail: {
    allOf: [
      ref('Team'),
      {
        type: 'object',
        properties: { members: { type: 'array', items: ref('TeamMember') } },
      },
    ],
  },

  CreateTeamRequest: {
    type: 'object',
    required: ['eventId', 'name', 'maxSize'],
    properties: {
      eventId: { type: 'string', example: 'evt-001' },
      name: { type: 'string', minLength: 3, maxLength: 60, example: 'Kernel Panic' },
      description: { type: 'string', maxLength: 600, nullable: true },
      lookingFor: { type: 'array', items: ref('TeamRole') },
      requiredSkills: { type: 'array', items: { type: 'string' }, maxItems: 20 },
      maxSize: {
        type: 'integer',
        minimum: 2,
        maximum: 12,
        example: 5,
        description: "Cannot exceed the event's maximum team size.",
      },
    },
  },

  UpdateTeamRequest: {
    type: 'object',
    minProperties: 1,
    properties: {
      name: { type: 'string', minLength: 3, maxLength: 60 },
      description: { type: 'string', maxLength: 600, nullable: true },
      lookingFor: { type: 'array', items: ref('TeamRole') },
      requiredSkills: { type: 'array', items: { type: 'string' } },
      maxSize: {
        type: 'integer',
        minimum: 2,
        maximum: 12,
        description: 'Cannot be lowered below the current member count.',
      },
      status: ref('TeamStatus'),
    },
  },

  TeamRequest: {
    type: 'object',
    description:
      'One record covers both directions: `invite` is a team inviting a participant, ' +
      '`application` is a participant asking to join.',
    properties: {
      id: { type: 'string', format: 'uuid' },
      teamId: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      kind: { type: 'string', enum: ['invite', 'application'] },
      status: { type: 'string', enum: ['pending', 'accepted', 'declined', 'cancelled'] },
      message: { type: 'string', nullable: true },
      createdBy: { type: 'string', format: 'uuid' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  ScoreComponent: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        enum: ['skills', 'roles', 'availability', 'workingStyle', 'credibility'],
      },
      label: { type: 'string', example: 'Skill complementarity' },
      score: { type: 'integer', minimum: 0, maximum: 100, example: 72 },
      weight: {
        type: 'integer',
        example: 25,
        description: 'Share of the final score this component can contribute.',
      },
      explanation: { type: 'string', example: '3 shared skills and 5 that only one of you brings.' },
    },
  },

  Compatibility: {
    type: 'object',
    properties: {
      score: { type: 'integer', minimum: 0, maximum: 100, example: 78 },
      band: { type: 'string', enum: ['excellent', 'strong', 'moderate', 'weak'] },
      summary: { type: 'string' },
      components: { type: 'array', items: ref('ScoreComponent') },
      sharedSkills: { type: 'array', items: { type: 'string' } },
      complementarySkills: { type: 'array', items: { type: 'string' } },
      sharedAvailability: { type: 'array', items: ref('AvailabilitySlot') },
    },
  },

  PairCompatibility: {
    allOf: [
      ref('Compatibility'),
      {
        type: 'object',
        properties: { participants: { type: 'array', items: ref('Participant') } },
      },
    ],
  },

  Match: {
    allOf: [
      ref('Compatibility'),
      { type: 'object', properties: { user: ref('Participant') } },
    ],
  },

  MemberSuggestion: {
    type: 'object',
    properties: {
      user: ref('Participant'),
      score: { type: 'integer', minimum: 0, maximum: 100, example: 84 },
      band: { type: 'string', enum: ['excellent', 'strong', 'moderate', 'weak'] },
      averagePairScore: {
        type: 'integer',
        example: 72,
        description: 'Mean compatibility with the current members, before role/skill bonuses.',
      },
      fillsNeededRole: { type: 'boolean' },
      matchedRequiredSkills: { type: 'array', items: { type: 'string' } },
      summary: { type: 'string' },
    },
  },

  Certificate: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      title: { type: 'string', example: 'Meta Front-End Developer' },
      issuer: { type: 'string', example: 'Coursera' },
      issuedOn: { type: 'string', format: 'date', nullable: true, example: '2026-03-14' },
      credentialId: { type: 'string', nullable: true },
      credentialUrl: { type: 'string', nullable: true },
      skills: { type: 'array', items: { type: 'string' } },
      status: ref('CertificateStatus'),
      confidence: {
        type: 'number',
        format: 'float',
        minimum: 0,
        maximum: 1,
        nullable: true,
        example: 0.85,
      },
      verdictReason: { type: 'string', nullable: true },
      verifiedBy: {
        type: 'string',
        nullable: true,
        example: 'claude:claude-opus-5',
        description: 'Which verifier produced the verdict — `claude:<model>` or `rules`.',
      },
      verifiedAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  CertificateWriteRequest: {
    type: 'object',
    required: ['title', 'issuer'],
    properties: {
      title: { type: 'string', minLength: 3, maxLength: 140 },
      issuer: { type: 'string', minLength: 2, maxLength: 80 },
      issuedOn: { type: 'string', format: 'date', nullable: true, example: '2026-03-14' },
      credentialId: { type: 'string', maxLength: 120, nullable: true },
      credentialUrl: { type: 'string', format: 'uri', maxLength: 300, nullable: true },
      skills: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    },
  },

  // -- onboarding -------------------------------------------------------------

  AccountRole: {
    type: 'string',
    enum: [...ACCOUNT_ROLES],
    description: 'Site role — authority on the platform, not a profession.',
    example: 'user',
  },

  SkillLevel: {
    type: 'integer',
    minimum: MIN_SKILL_LEVEL,
    maximum: MAX_SKILL_LEVEL,
    description:
      'Proficiency. The number is what gets scored; the bands are what a person reads — ' +
      SKILL_LEVELS.map((band) => `${band.min}–${band.max} ${band.label}`).join(', ') + '.',
    example: 70,
  },

  CheckEmailRequest: {
    type: 'object',
    required: ['email'],
    properties: { email: { type: 'string', format: 'email' } },
  },

  CheckEmailResult: {
    type: 'object',
    properties: {
      available: { type: 'boolean', example: true },
      // Deliberately not "that address belongs to a Google account": telling an
      // anonymous caller *how* someone signs in is more than they need to know.
      reason: { type: 'string', nullable: true, example: 'That address is already registered.' },
    },
  },

  VerifyEmailRequest: {
    type: 'object',
    required: ['token'],
    properties: { token: { type: 'string', description: 'From the confirmation link.' } },
  },

  ResendVerificationRequest: {
    type: 'object',
    required: ['email'],
    properties: { email: { type: 'string', format: 'email' } },
  },

  AuthProvider: {
    type: 'object',
    properties: {
      id: { type: 'string', enum: ['google', 'linkedin'], example: 'google' },
      label: { type: 'string', example: 'Google' },
      // False when the credentials are unset, so the SPA renders the button
      // disabled rather than sending people into a broken redirect.
      enabled: { type: 'boolean', example: true },
    },
  },

  ProfileOptions: {
    type: 'object',
    description: 'Every closed list the profile builder renders, in one call.',
    properties: {
      teamRoles: { type: 'array', items: ref('TeamRole') },
      maxTeamRoles: { type: 'integer', example: MAX_TEAM_ROLES },
      experienceLevels: { type: 'array', items: ref('ExperienceLevel') },
      availability: { type: 'array', items: ref('AvailabilitySlot') },
      pronouns: { type: 'array', items: { type: 'string' }, example: [...PRONOUN_OPTIONS] },
      languages: { type: 'array', items: { type: 'string' } },
      interestDomains: { type: 'array', items: { type: 'string' } },
      goals: { type: 'array', items: { type: 'string' } },
      experienceKinds: { type: 'array', items: { type: 'string' }, example: [...EXPERIENCE_KINDS] },
      skillCategories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'Languages' },
            skills: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      popularSkills: {
        type: 'array',
        items: { type: 'string' },
        description: 'The starter set shown as chips before anyone searches.',
      },
      skillLevels: { type: 'array', items: { type: 'string' }, example: [...SKILL_LEVELS] },
    },
  },

  SkillEndorsement: {
    type: 'object',
    properties: {
      skill: { type: 'string', example: 'Node.js' },
      count: { type: 'integer', example: 2 },
      verified: {
        type: 'integer',
        example: 1,
        description:
          'How many of those carry the event they came from. One that does is a claim two ' +
          "people's team membership can confirm, and it counts for twice as much in the " +
          'coverage engine as one that does not.',
      },
      byViewer: { type: 'boolean', description: 'Whether the caller endorsed this one.' },
    },
  },

  ProfileEndorsements: {
    type: 'object',
    properties: {
      skills: { type: 'array', items: ref('SkillEndorsement') },
      canEndorse: {
        type: 'boolean',
        description: 'True when the caller has shared a team with this person.',
      },
    },
  },

  EndorseSkillRequest: {
    type: 'object',
    required: ['skill'],
    properties: { skill: { type: 'string', maxLength: 60, example: 'Node.js' } },
  },

  Experience: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      kind: { type: 'string', example: EXPERIENCE_KINDS[0] },
      title: { type: 'string', example: 'Runner-up, BakuHack 2025' },
      organisation: { type: 'string', nullable: true },
      description: { type: 'string', nullable: true },
      startedOn: { type: 'string', format: 'date', nullable: true },
      endedOn: { type: 'string', format: 'date', nullable: true },
      url: { type: 'string', format: 'uri', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  ExperienceWriteRequest: {
    type: 'object',
    required: ['kind', 'title'],
    properties: {
      kind: { type: 'string', enum: [...EXPERIENCE_KINDS] },
      title: { type: 'string', minLength: 2, maxLength: 140 },
      organisation: { type: 'string', maxLength: 120, nullable: true },
      description: { type: 'string', maxLength: 600, nullable: true },
      startedOn: { type: 'string', format: 'date', nullable: true },
      endedOn: { type: 'string', format: 'date', nullable: true },
      url: { type: 'string', format: 'uri', maxLength: 300, nullable: true },
    },
  },

  // -- per-event stats --------------------------------------------------------

  ComponentWeights: {
    type: 'object',
    description: 'How much each component counts for this event. Sums to 100.',
    properties: {
      skills: { type: 'integer', example: 25 },
      roles: { type: 'integer', example: 25 },
      availability: { type: 'integer', example: 20 },
      workingStyle: { type: 'integer', example: 20 },
      credibility: { type: 'integer', example: 10 },
    },
  },

  EventStatProfile: {
    type: 'object',
    description:
      'What an event rewards. Derived from its category and overridable per event — ' +
      'a game jam weights game-dev skills heavily and credibility barely; a security ' +
      'CTF does the reverse.',
    properties: {
      summary: { type: 'string' },
      weights: ref('ComponentWeights'),
      focusAreas: {
        type: 'array',
        items: { type: 'string' },
        description: 'Skill-catalogue categories that matter here, most important first.',
      },
      keyRoles: { type: 'array', items: ref('TeamRole') },
    },
  },

  FocusCoverage: {
    type: 'object',
    properties: {
      area: { type: 'string', example: 'Game development' },
      matched: { type: 'array', items: { type: 'string' } },
      depth: {
        type: 'integer',
        description: 'The strongest single skill here, 0–100 — not the mean.',
      },
      deepest: {
        type: 'string',
        nullable: true,
        description: 'Which skill that is, so a reader can see what carries the area.',
      },
      score: { type: 'integer', minimum: 0, maximum: 100 },
      confidence: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description:
          'How much the score is worth believing. Every number here comes from someone ' +
          'describing themselves; this says whether anything corroborates it. A skill that ' +
          'was never rated is scored at the default and reported at low confidence, so a ' +
          'thin profile reads as thin instead of as a confident guess.',
      },
      unrated: {
        type: 'array',
        items: { type: 'string' },
        description: 'Skills here the person never actually put a number on.',
      },
      endorsements: { type: 'integer', description: 'Endorsements backing this area.' },
    },
  },

  FitBand: { type: 'string', enum: ['excellent', 'strong', 'moderate', 'weak'] },

  SkillNeed: {
    type: 'object',
    description: 'One area a team wants somebody for, and how strong that somebody must be.',
    properties: {
      area: { type: 'string', example: 'Security' },
      current: { type: 'integer', description: 'What the team has here now, 0–100.' },
      target: {
        type: 'integer',
        description:
          'What a recruit should bring. Pitched above the current level — matching it adds ' +
          'breadth but does not close the gap.',
      },
      examples: { type: 'array', items: { type: 'string' } },
      priority: { type: 'string', enum: ['critical', 'important', 'nice to have'] },
    },
  },

  RecruitBrief: {
    type: 'object',
    description:
      'Who a team should go and find. A description rather than a search result — it holds ' +
      'whether or not anybody matching it has signed up, which is the point of returning it ' +
      'separately from the candidate list.',
    properties: {
      roles: {
        type: 'array',
        items: ref('TeamRole'),
        description: 'Positions nobody on the roster plays, most important first.',
      },
      confidence: {
        type: 'integer',
        description: 'How much evidence this brief rests on, 0–100.',
      },
      caveat: {
        type: 'string',
        nullable: true,
        description:
          'Set when confidence is low enough that the brief should be read as provisional — ' +
          'the gaps it names may be real, or may be an artefact of nobody filling in a profile.',
      },
      skills: { type: 'array', items: ref('SkillNeed') },
      emphasis: {
        type: 'string',
        enum: ['roles', 'skills', 'both', 'none'],
        description: "Whether the team's real problem is a missing position or thin skills.",
      },
      headline: { type: 'string', example: 'Looking for a Presenter strong in Security.' },
      reasons: { type: 'array', items: { type: 'string' } },
    },
  },

  EventStats: {
    type: 'object',
    properties: {
      eventId: { type: 'string', format: 'uuid' },
      profile: ref('EventStatProfile'),
      participantsOnTeams: { type: 'integer', example: 14 },
      teamCount: { type: 'integer', example: 5 },
      openTeams: { type: 'integer', example: 3 },
    },
  },

  MyEventFit: {
    type: 'object',
    description: 'One person’s stat sheet for one event — their profile, re-weighted.',
    properties: {
      eventId: { type: 'string', format: 'uuid' },
      profile: ref('EventStatProfile'),
      score: { type: 'integer', minimum: 0, maximum: 100 },
      confidence: { type: 'integer', minimum: 0, maximum: 100 },
      band: ref('FitBand'),
      coverage: { type: 'array', items: ref('FocusCoverage') },
      gaps: { type: 'array', items: { type: 'string' } },
      fillsKeyRole: { type: 'boolean' },
      summary: { type: 'string' },
      myTeamId: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'The team this person is already on here, if any.',
      },
    },
  },

  PublicTeamPage: {
    type: 'object',
    description: 'Everything a stranger needs to decide whether to ask to join.',
    properties: {
      teamId: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      description: { type: 'string', nullable: true },
      logoUrl: { type: 'string', nullable: true },
      event: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          format: ref('EventFormat'),
          domains: { type: 'array', items: ref('EventDomain') },
          startDate: { type: 'string', format: 'date-time' },
          location: { type: 'string' },
          mode: ref('EventMode'),
        },
      },
      members: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            fullName: { type: 'string' },
            firstName: { type: 'string' },
            avatarUrl: { type: 'string', nullable: true },
            roles: { type: 'array', items: ref('TeamRole') },
            topSkills: {
              type: 'array',
              description:
                'Ordered by endorsements first, then self-rating — what somebody else ' +
                'vouched for is the more useful thing to lead with in public.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  endorsements: { type: 'integer' },
                },
              },
            },
            verified: { type: 'boolean' },
          },
        },
      },
      openSeats: { type: 'integer' },
      maxSize: { type: 'integer' },
      strengths: {
        type: 'array',
        description: 'What the team already covers, strongest first.',
        items: {
          type: 'object',
          properties: {
            area: { type: 'string' },
            score: { type: 'integer' },
            skills: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      lookingFor: { type: 'array', items: ref('TeamRole') },
      needs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Focus areas nobody on the team covers — the honest half of the pitch.',
      },
      pitch: {
        type: 'string',
        example: '3 people building at Winter Campus Hackathon, strong on Backend, looking for a UI/UX Designer.',
      },
    },
  },

  TeamRisk: {
    type: 'object',
    description:
      'A way this team could fail that has nothing to do with missing skills. Computed ' +
      'from data already stored — availability slots, working-style answers, the roster. ' +
      'Nothing fires on absent data: a team that has not filled in working style is not a ' +
      'team with a working-style problem.',
    properties: {
      id: { type: 'string', example: 'no-shared-time' },
      severity: { type: 'string', enum: ['high', 'medium', 'low'] },
      title: { type: 'string', example: 'There is no time when everyone is free' },
      detail: {
        type: 'string',
        description: 'The evidence behind the claim. A warning you cannot check gets ignored.',
      },
      suggestion: { type: 'string', nullable: true },
    },
  },

  SlotCoverage: {
    type: 'object',
    description: 'One cell of the week grid: how many of the team can make this slot.',
    properties: {
      slot: { type: 'string', example: 'weekend-afternoons' },
      label: { type: 'string', example: 'weekend afternoons' },
      count: { type: 'integer' },
      who: { type: 'array', items: { type: 'string' } },
    },
  },

  TeamEventReport: {
    type: 'object',
    description: 'What a team is missing for the event it belongs to, and who to look for.',
    properties: {
      teamId: { type: 'string', format: 'uuid' },
      teamName: { type: 'string' },
      eventId: { type: 'string', format: 'uuid' },
      eventName: { type: 'string' },
      size: {
        type: 'object',
        properties: {
          current: { type: 'integer' },
          max: { type: 'integer' },
        },
      },
      brief: ref('RecruitBrief'),
      risks: { type: 'array', items: ref('TeamRisk') },
      availability: { type: 'array', items: ref('SlotCoverage') },
      profile: ref('EventStatProfile'),
      coverage: { type: 'array', items: ref('FocusCoverage') },
      missingAreas: { type: 'array', items: { type: 'string' } },
      missingRoles: { type: 'array', items: ref('TeamRole') },
      readiness: { type: 'integer', minimum: 0, maximum: 100 },
      summary: { type: 'string' },
    },
  },

  EventCandidate: {
    type: 'object',
    properties: {
      user: ref('User'),
      score: {
        type: 'integer',
        description:
          'The headline number, and the order this list is returned in. Blends team ' +
          'compatibility (60%) with the candidate’s own event fit (40%), then adds a bonus ' +
          'per gap closed and for filling a missing role.',
      },
      teamFit: {
        type: 'integer',
        description: 'Compatibility with the team, scored under this event’s weights.',
      },
      band: ref('FitBand'),
      eventFit: {
        type: 'integer',
        description: 'How well they cover what the event asks for, team aside.',
      },
      closesGaps: { type: 'array', items: { type: 'string' } },
      fillsMissingRole: { type: 'boolean' },
      reasons: { type: 'array', items: { type: 'string' } },
    },
  },

  // -- connections ------------------------------------------------------------

  ConnectionState: {
    type: 'string',
    enum: ['none', 'pending-sent', 'pending-received', 'connected', 'declined'],
  },

  ConnectionView: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'Null when there is no row yet — the two have never interacted.',
      },
      state: ref('ConnectionState'),
      person: ref('User'),
      unread: { type: 'integer', example: 0 },
      lastMessage: {
        type: 'object',
        nullable: true,
        properties: {
          body: { type: 'string' },
          sentByMe: { type: 'boolean' },
          at: { type: 'string', format: 'date-time' },
        },
      },
      connectedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  ConnectionsOverview: {
    type: 'object',
    properties: {
      connected: { type: 'array', items: ref('ConnectionView') },
      incoming: {
        type: 'array',
        items: ref('ConnectionView'),
        description: 'Requests waiting on you to answer.',
      },
      outgoing: {
        type: 'array',
        items: ref('ConnectionView'),
        description: 'Requests you sent that nobody has answered.',
      },
      totalUnread: { type: 'integer', example: 2 },
    },
  },

  TeamChatMessage: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      teamId: { type: 'string', format: 'uuid' },
      senderId: { type: 'string', format: 'uuid' },
      body: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      sender: {
        type: 'object',
        description: 'Denormalised, so rendering a channel needs no extra lookups.',
        properties: {
          id: { type: 'string', format: 'uuid' },
          fullName: { type: 'string' },
          firstName: { type: 'string' },
          avatarUrl: { type: 'string', nullable: true },
        },
      },
    },
  },

  TeamChannel: {
    type: 'object',
    properties: {
      teamId: { type: 'string', format: 'uuid' },
      teamName: { type: 'string' },
      members: { type: 'array', items: ref('User') },
      messages: { type: 'array', items: ref('TeamChatMessage') },
    },
  },

  Message: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      senderId: { type: 'string', format: 'uuid' },
      body: { type: 'string' },
      readAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  Conversation: {
    type: 'object',
    properties: {
      partner: ref('User'),
      state: ref('ConnectionState'),
      canSend: {
        type: 'boolean',
        description: 'False unless the two are connected, so the composer disables itself.',
      },
      messages: { type: 'array', items: ref('Message') },
    },
  },

  RequestConnectionRequest: {
    type: 'object',
    required: ['userId'],
    properties: { userId: { type: 'string', format: 'uuid' } },
  },

  RespondConnectionRequest: {
    type: 'object',
    required: ['action'],
    properties: { action: { type: 'string', enum: ['accept', 'decline', 'cancel'] } },
  },

  SendMessageRequest: {
    type: 'object',
    required: ['body'],
    properties: { body: { type: 'string', minLength: 1, maxLength: 2000 } },
  },

  // -- notifications ----------------------------------------------------------

  Notification: {
    type: 'object',
    description:
      'Denormalised at emit time: the title and link are written when it happens, so a ' +
      'notification keeps saying what it said after the team is renamed or the request ' +
      'withdrawn.',
    properties: {
      id: { type: 'string', format: 'uuid' },
      kind: { type: 'string', enum: [...NOTIFICATION_KINDS] },
      title: { type: 'string', example: 'Kenan Mammadov invited you to Kernel Panic' },
      body: { type: 'string', nullable: true },
      link: { type: 'string', nullable: true, example: '/teams/…' },
      actorId: { type: 'string', format: 'uuid', nullable: true },
      actor: {
        type: 'object',
        nullable: true,
        description: 'Resolved for the avatar; null once that account is gone.',
        properties: {
          id: { type: 'string', format: 'uuid' },
          fullName: { type: 'string' },
          avatarUrl: { type: 'string', nullable: true },
        },
      },
      readAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  NotificationFeed: {
    type: 'object',
    properties: {
      items: { type: 'array', items: ref('Notification') },
      unread: { type: 'integer', example: 3 },
    },
  },

  // -- staff console ----------------------------------------------------------

  AdminAccount: {
    type: 'object',
    description: 'A directory profile plus the fields only staff may see.',
    properties: {
      ...profileFields,
      email: { type: 'string', format: 'email' },
      accountRole: ref('AccountRole'),
      emailVerified: { type: 'boolean' },
      onboardingCompleted: { type: 'boolean' },
      bannedUntil: {
        type: 'string',
        nullable: true,
        description:
          'Null when active, an ISO timestamp while suspended, "infinity" when permanent.',
      },
      bannedReason: { type: 'string', nullable: true },
    },
  },

  UpdateAccountRequest: {
    type: 'object',
    required: ['accountRole'],
    description:
      'The site role, and nothing else. Profile data is the participant’s own ' +
      'description of themselves and is not staff’s to rewrite.',
    properties: { accountRole: ref('AccountRole') },
  },

  BanAccountRequest: {
    type: 'object',
    required: ['reason'],
    description: 'Either a duration in days or explicitly permanent — never both, never neither.',
    properties: {
      permanent: { type: 'boolean', default: false },
      durationDays: { type: 'integer', minimum: 1, maximum: 3650, nullable: true },
      reason: {
        type: 'string',
        minLength: 3,
        maxLength: 300,
        description: 'Shown to the person when they try to sign in, so it is required.',
      },
    },
  },

  DeleteAccountRequest: {
    type: 'object',
    required: ['confirmEmail'],
    description: 'The account email, typed back. A stray click cannot satisfy this.',
    properties: { confirmEmail: { type: 'string', format: 'email' } },
  },
};

// -- paths --------------------------------------------------------------------

const paths = {
  '/health': {
    get: {
      tags: ['Health'],
      summary: 'Liveness and readiness',
      description: 'Returns 503 when the database cannot be reached — the API is useless without it.',
      responses: {
        200: dataResponse('Service and database are up.', {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            database: { type: 'string', enum: ['up', 'down'] },
            uptime: { type: 'number', example: 42.5 },
            environment: { type: 'string', example: 'development' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        }),
        503: errorFor('The database is unreachable.'),
      },
    },
  },

  '/': {
    get: {
      tags: ['Health'],
      summary: 'API metadata',
      responses: { 200: { description: 'Name, version, and documentation links.' } },
    },
  },

  // -- auth -------------------------------------------------------------------

  '/api/auth/signup': {
    post: {
      tags: ['Auth'],
      summary: 'Register a new account',
      requestBody: jsonBody(ref('SignupRequest')),
      responses: {
        201: dataResponse('Account created.', ref('AuthResult')),
        400: RESP_400,
        409: errorFor('An account with this email already exists.'),
      },
    },
  },

  '/api/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Sign in',
      requestBody: jsonBody(ref('LoginRequest')),
      responses: {
        200: dataResponse('Signed in.', ref('AuthResult')),
        400: RESP_400,
        401: errorFor('Incorrect email or password.'),
      },
    },
  },

  '/api/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Current account',
      security: AUTH,
      responses: { 200: dataResponse('The signed-in account.', ref('User')), 401: RESP_401 },
    },
  },

  '/api/auth/check-email': {
    post: {
      tags: ['Auth'],
      summary: 'Is this address free?',
      description:
        'Step 1 of the signup wizard — asked before the form collects anything else, so ' +
        'nobody fills in a whole page to be told the address is taken.',
      requestBody: jsonBody(ref('CheckEmailRequest')),
      responses: { 200: dataResponse('Availability.', ref('CheckEmailResult')), 400: RESP_400 },
    },
  },

  '/api/auth/verify-email': {
    post: {
      tags: ['Auth'],
      summary: 'Confirm an email address',
      description: 'Consumes the single-use token from the confirmation link.',
      requestBody: jsonBody(ref('VerifyEmailRequest')),
      responses: {
        200: dataResponse('Address confirmed.', ref('AuthResult')),
        400: errorFor('The token is unknown, already used, or expired.'),
      },
    },
  },

  '/api/auth/resend-verification': {
    post: {
      tags: ['Auth'],
      summary: 'Send the confirmation email again',
      description:
        'Always answers 200, whether or not the address exists — a different answer would ' +
        'turn this into a way to test which addresses are registered.',
      requestBody: jsonBody(ref('ResendVerificationRequest')),
      responses: {
        200: dataResponse('Sent, if the address needed it.', ref('CheckEmailResult')),
        400: RESP_400,
      },
    },
  },

  '/api/auth/providers': {
    get: {
      tags: ['Auth'],
      summary: 'Which social sign-ins are configured',
      description: 'Lets the SPA disable a button rather than redirect into a broken flow.',
      responses: { 200: listResponse('Providers.', ref('AuthProvider'), false) },
    },
  },

  '/api/auth/oauth/{provider}': {
    get: {
      tags: ['Auth'],
      summary: 'Start a social sign-in',
      description:
        'A browser entry point, not an XHR one: it **302s** to the provider’s consent ' +
        'screen carrying a signed `state`.',
      parameters: [
        pathParam('provider', 'google | linkedin.'),
        queryParam('next', { type: 'string' }, 'Where to land afterwards.'),
      ],
      responses: {
        302: { description: 'Redirect to the provider.' },
        404: errorFor('That provider is not configured.'),
      },
    },
    delete: {
      tags: ['Auth'],
      summary: 'Unlink a provider',
      description:
        'Refused when it would leave the account with no way back in — no password and no ' +
        'other provider.',
      security: AUTH,
      parameters: [pathParam('provider', 'google | linkedin.')],
      responses: {
        204: { description: 'Unlinked.' },
        400: errorFor('That is the only way you can sign in. Set a password first.'),
        401: RESP_401,
        404: RESP_404,
      },
    },
  },

  '/api/auth/oauth/{provider}/callback': {
    get: {
      tags: ['Auth'],
      summary: 'Provider redirect target',
      description:
        'Called by the provider, not by you. Verifies `state`, exchanges the code, then ' +
        '**302s** back to the SPA with the token in the URL *fragment* — a fragment is ' +
        'never sent to a server, so the token stays out of access logs and referrer headers.',
      parameters: [
        pathParam('provider', 'google | linkedin.'),
        queryParam('code', { type: 'string' }, 'Authorization code from the provider.'),
        queryParam('state', { type: 'string' }, 'The signed state issued at the start.'),
      ],
      responses: { 302: { description: 'Redirect back to the SPA.' } },
    },
  },

  '/api/auth/oauth/{provider}/connect': {
    get: {
      tags: ['Auth'],
      summary: 'Link a provider to the signed-in account',
      security: AUTH,
      parameters: [pathParam('provider', 'google | linkedin.')],
      responses: { 302: { description: 'Redirect to the provider.' }, 401: RESP_401 },
    },
  },

  // -- users ------------------------------------------------------------------

  '/api/users/profile-options': {
    get: {
      tags: ['Participants'],
      summary: 'Every closed list the profile builder needs',
      description:
        'Public, because the SPA renders its chips and sliders from this before anyone ' +
        'signs in. One call rather than nine so the builder has no waterfall.',
      responses: { 200: dataResponse('The option lists.', ref('ProfileOptions')) },
    },
  },

  '/api/users/{id}/endorsements': {
    get: {
      tags: ['Participants'],
      summary: "Endorsements on a participant's skills",
      description:
        'Counts per skill, plus whether the caller has endorsed each one and whether they ' +
        'are allowed to. Driven off the profile’s own skill list, so a skill since removed ' +
        'stops showing even if rows for it remain.',
      parameters: [pathParam('id', 'Participant UUID.', 'uuid')],
      responses: {
        200: dataResponse('Endorsement state.', ref('ProfileEndorsements')),
        404: RESP_404,
      },
    },
    post: {
      tags: ['Participants'],
      summary: 'Endorse a skill',
      description:
        'Only for someone you have shared a team with — that rule is what makes an ' +
        'endorsement evidence rather than a "like". Idempotent: endorsing twice leaves the ' +
        'count alone and sends no second notification.',
      security: AUTH,
      parameters: [pathParam('id', 'Participant UUID.', 'uuid')],
      requestBody: jsonBody(ref('EndorseSkillRequest')),
      responses: {
        201: dataResponse('The new count.', ref('SkillEndorsement')),
        400: errorFor('Not in the skill list, not on their profile, or your own account.'),
        401: RESP_401,
        403: errorFor('You can only endorse someone you have been on a team with.'),
        404: RESP_404,
      },
    },
    delete: {
      tags: ['Participants'],
      summary: 'Withdraw your endorsement',
      security: AUTH,
      parameters: [pathParam('id', 'Participant UUID.', 'uuid')],
      requestBody: jsonBody(ref('EndorseSkillRequest')),
      responses: {
        200: dataResponse('The new count.', ref('SkillEndorsement')),
        401: RESP_401,
        404: errorFor('You have not endorsed that skill.'),
      },
    },
  },

  '/api/users/me/availability/confirm': {
    post: {
      tags: ['Participants'],
      summary: 'Confirm that your availability is still accurate',
      description:
        'Stamps `availabilityConfirmedAt` without changing anything. Availability is the ' +
        'heaviest single component the matching engine weighs — up to 28 of 100 for a ' +
        'hackathon — and it is the field people set once during onboarding and never revisit. ' +
        'Stale availability is worse than none, because the engine trusts it. Saving any ' +
        'availability field through `PATCH /api/users/me` stamps the same clock.',
      security: AUTH,
      responses: {
        200: dataResponse('Confirmed.', ref('User')),
        401: RESP_401,
      },
    },
  },

  '/api/users/me/avatar': {
    post: {
      tags: ['Participants'],
      summary: 'Upload a profile picture',
      description:
        'PNG, JPEG, or WebP, up to 2 MB. Each upload takes a fresh random path so a CDN ' +
        'never serves the previous picture from cache.',
      security: AUTH,
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['avatar'],
              properties: { avatar: { type: 'string', format: 'binary' } },
            },
          },
        },
      },
      responses: {
        200: dataResponse('Uploaded.', ref('User')),
        400: errorFor('Not an image, or larger than 2 MB.'),
        401: RESP_401,
      },
    },
    delete: {
      tags: ['Participants'],
      summary: 'Remove the profile picture',
      security: AUTH,
      responses: { 200: dataResponse('Removed.', ref('User')), 401: RESP_401 },
    },
  },

  '/api/users/me/experiences': {
    get: {
      tags: ['Participants'],
      summary: 'My past hackathons, jobs, and projects',
      security: AUTH,
      responses: { 200: listResponse('Experiences.', ref('Experience'), false), 401: RESP_401 },
    },
    post: {
      tags: ['Participants'],
      summary: 'Add an experience',
      security: AUTH,
      requestBody: jsonBody(ref('ExperienceWriteRequest')),
      responses: {
        201: dataResponse('Added.', ref('Experience')),
        400: RESP_400,
        401: RESP_401,
      },
    },
  },

  '/api/users/me/experiences/{id}': {
    patch: {
      tags: ['Participants'],
      summary: 'Edit one of mine',
      security: AUTH,
      parameters: [pathParam('id', 'Experience UUID.', 'uuid')],
      requestBody: jsonBody(ref('ExperienceWriteRequest')),
      responses: {
        200: dataResponse('Updated.', ref('Experience')),
        400: RESP_400,
        401: RESP_401,
        404: RESP_404,
      },
    },
    delete: {
      tags: ['Participants'],
      summary: 'Delete one of mine',
      security: AUTH,
      parameters: [pathParam('id', 'Experience UUID.', 'uuid')],
      responses: { 204: { description: 'Deleted.' }, 401: RESP_401, 404: RESP_404 },
    },
  },

  '/api/users': {
    get: {
      tags: ['Participants'],
      summary: 'Browse participants',
      description:
        'The participant directory. When called with a token, the caller is excluded from ' +
        'their own results.',
      parameters: [
        queryParam('search', { type: 'string', maxLength: 80 }, 'Matches name, bio, or skills.'),
        queryParam(
          'roles',
          { type: 'array', items: { type: 'string', enum: [...TEAM_ROLES] } },
          'Anyone who can play any of these roles. Repeatable, or comma-joined.',
        ),
        queryParam(
          'experienceLevel',
          { type: 'string', enum: [...EXPERIENCE_LEVELS] },
          'Exact experience match.',
        ),
        queryParam(
          'skills',
          { type: 'string' },
          'Comma-separated. Matches anyone with *any* of these skills.',
        ),
        queryParam('availability', { type: 'string' }, 'Comma-separated availability slots.'),
        queryParam('lookingForTeam', { type: 'boolean' }, 'Only people open to joining a team.'),
        queryParam('verified', { type: 'boolean' }, 'Only verified profiles.'),
        ...paginationParams,
      ],
      responses: { 200: listResponse('Matching participants.', ref('Participant')), 400: RESP_400 },
    },
  },

  '/api/users/me': {
    get: {
      tags: ['Participants'],
      summary: 'My profile',
      security: AUTH,
      responses: {
        200: dataResponse('The signed-in profile, with completeness.', ref('User')),
        401: RESP_401,
      },
    },
    patch: {
      tags: ['Participants'],
      summary: 'Update my profile',
      description:
        'The matching inputs live here — skills, availability, and working style feed the ' +
        'compatibility engine directly.',
      security: AUTH,
      requestBody: jsonBody(ref('UpdateProfileRequest')),
      responses: {
        200: dataResponse('Updated profile.', ref('User')),
        400: RESP_400,
        401: RESP_401,
      },
    },
  },

  '/api/users/{id}': {
    get: {
      tags: ['Participants'],
      summary: 'A participant profile',
      parameters: [pathParam('id', 'Participant UUID.', 'uuid')],
      responses: {
        200: dataResponse('The participant.', ref('Participant')),
        400: RESP_400,
        404: RESP_404,
      },
    },
  },

  // -- events -----------------------------------------------------------------

  '/api/events': {
    get: {
      tags: ['Events'],
      summary: 'List events',
      parameters: [
        queryParam(
          'format',
          { type: 'string', enum: ['All', ...EVENT_FORMATS], default: 'All' },
          'Exact format match — how the event runs.',
        ),
        queryParam(
          'domains',
          { type: 'array', items: { type: 'string', enum: [...EVENT_DOMAINS] } },
          'Anything touching any of these. Repeatable, or comma-joined.',
        ),
        queryParam(
          'search',
          { type: 'string', maxLength: 80 },
          'Matches name, description, location, or tags.',
        ),
        queryParam('mode', { type: 'string', enum: [...EVENT_MODES] }, 'Onsite, online, or hybrid.'),
        queryParam('featured', { type: 'boolean' }, 'Filter on the featured flag.'),
        ...paginationParams,
      ],
      responses: {
        200: listResponse('Events, earliest start date first.', ref('Event')),
        400: RESP_400,
      },
    },
    post: {
      tags: ['Events'],
      summary: 'Create an event',
      description: 'The creating account becomes the organiser and is the only one who can edit it.',
      security: AUTH,
      requestBody: jsonBody(ref('EventWriteRequest')),
      responses: {
        201: dataResponse('Event created.', ref('Event')),
        400: RESP_400,
        401: RESP_401,
      },
    },
  },

  '/api/events/facets': {
    get: {
      tags: ['Events'],
      summary: 'Both filter axes with counts',
      description:
        'Format and domain are orthogonal — "Hackathon" is how an event runs, "Design" is ' +
        'what it is about, and a design hackathon is both. Filing them in one list meant ' +
        'such an event was hidden from whichever axis it was not filed under. Every entry ' +
        'is returned including empty ones, so the filter bar does not change shape as data ' +
        'comes and goes.',
      responses: { 200: dataResponse('Counts on both axes.', ref('EventFacets')) },
    },
  },

  '/api/events/{id}': {
    get: {
      tags: ['Events'],
      summary: 'A single event',
      parameters: [pathParam('id', 'Event id, e.g. `evt-001`.')],
      responses: { 200: dataResponse('The event.', ref('Event')), 404: RESP_404 },
    },
    patch: {
      tags: ['Events'],
      summary: 'Update an event',
      description:
        'Organiser only. Seeded catalogue events have no organiser and cannot be edited. ' +
        'Accepts `statProfile` to override how the event is scored — the column has existed ' +
        'since `007_event_stats` but until now only a developer could write it, so every ' +
        'event of a given format was judged identically.',
      security: AUTH,
      parameters: [pathParam('id', 'Event id.')],
      requestBody: jsonBody(ref('EventUpdateRequest')),
      responses: {
        200: dataResponse('Updated event.', ref('Event')),
        400: RESP_400,
        401: RESP_401,
        403: RESP_403,
        404: RESP_404,
      },
    },
    delete: {
      tags: ['Events'],
      summary: 'Delete an event',
      description: 'Organiser only. Cascades to every team created for the event.',
      security: AUTH,
      parameters: [pathParam('id', 'Event id.')],
      responses: {
        204: { description: 'Deleted.' },
        401: RESP_401,
        403: RESP_403,
        404: RESP_404,
      },
    },
  },

  // -- teams ------------------------------------------------------------------

  '/api/events/{id}/stats': {
    get: {
      tags: ['Events'],
      summary: 'What this event rewards',
      description:
        'The weighting every score on this event is computed under, plus how busy it is. ' +
        'Public — you should be able to judge whether an event suits you before signing up.',
      parameters: [pathParam('id', 'Event UUID.', 'uuid')],
      responses: { 200: dataResponse('Event stats.', ref('EventStats')), 404: RESP_404 },
    },
  },

  '/api/events/{id}/my-fit': {
    get: {
      tags: ['Events', 'Compatibility'],
      summary: 'My stat sheet for this event',
      description:
        'The profile, filtered and re-weighted to what this event actually asks for — ' +
        'the same person scores differently at a game jam and at a security CTF.',
      security: AUTH,
      parameters: [pathParam('id', 'Event UUID.', 'uuid')],
      responses: {
        200: dataResponse('Your fit for this event.', ref('MyEventFit')),
        401: RESP_401,
        404: RESP_404,
      },
    },
  },

  '/api/teams': {
    get: {
      tags: ['Teams'],
      summary: 'Browse teams',
      parameters: [
        queryParam('eventId', { type: 'string' }, 'Teams for one event.'),
        queryParam(
          'status',
          { type: 'string', enum: [...TEAM_STATUSES] },
          'Defaults to everything except disbanded.',
        ),
        queryParam(
          'lookingForRole',
          { type: 'string', enum: [...TEAM_ROLES] },
          'Teams that still need this role.',
        ),
        queryParam('search', { type: 'string', maxLength: 80 }, 'Matches name or description.'),
        queryParam('hasOpenSeats', { type: 'boolean' }, 'Only teams with room left.'),
        queryParam('mine', { type: 'boolean' }, 'Only teams I belong to. Requires a token.'),
        ...paginationParams,
      ],
      responses: {
        200: listResponse('Matching teams.', ref('Team')),
        400: RESP_400,
        401: errorFor('`mine=true` was sent without a token.'),
      },
    },
    post: {
      tags: ['Teams'],
      summary: 'Create a team',
      description:
        'The creator becomes the owner and first member. A participant can belong to only one ' +
        'team per event.',
      security: AUTH,
      requestBody: jsonBody(ref('CreateTeamRequest')),
      responses: {
        201: dataResponse('Team created.', ref('TeamDetail')),
        400: RESP_400,
        401: RESP_401,
        404: errorFor('No such event.'),
        409: errorFor('Already on a team for this event, or the name is taken.'),
      },
    },
  },

  '/api/teams/requests': {
    get: {
      tags: ['Teams'],
      summary: 'My invitations and applications',
      security: AUTH,
      parameters: [
        queryParam(
          'direction',
          { type: 'string', enum: ['incoming', 'outgoing'], default: 'incoming' },
          '`incoming` = addressed to me or my teams; `outgoing` = raised by me.',
        ),
        queryParam('kind', { type: 'string', enum: ['invite', 'application'] }, 'Filter by kind.'),
        queryParam(
          'status',
          { type: 'string', enum: ['pending', 'accepted', 'declined', 'cancelled'] },
          'Filter by status.',
        ),
      ],
      responses: {
        200: listResponse('Requests, newest first.', ref('TeamRequest'), false),
        401: RESP_401,
      },
    },
  },

  '/api/teams/requests/{requestId}': {
    patch: {
      tags: ['Teams'],
      summary: 'Accept, decline, or cancel a request',
      description:
        'An invitation is answered by the invited participant; an application by the team ' +
        'owner. `cancel` is for whoever raised it. Accepting seats the member in the same ' +
        'transaction that resolves the request.',
      security: AUTH,
      parameters: [pathParam('requestId', 'Request UUID.', 'uuid')],
      requestBody: jsonBody({
        type: 'object',
        required: ['action'],
        properties: { action: { type: 'string', enum: ['accept', 'decline', 'cancel'] } },
      }),
      responses: {
        200: dataResponse('The resolved request.', ref('TeamRequest')),
        400: RESP_400,
        401: RESP_401,
        403: errorFor('This request is not addressed to you.'),
        404: RESP_404,
        409: errorFor('Already resolved, or the team is now full or locked.'),
      },
    },
  },

  '/api/teams/{id}': {
    get: {
      tags: ['Teams'],
      summary: 'A team and its roster',
      parameters: [pathParam('id', 'Team UUID.', 'uuid')],
      responses: {
        200: dataResponse('The team.', ref('TeamDetail')),
        400: RESP_400,
        404: RESP_404,
      },
    },
    patch: {
      tags: ['Teams'],
      summary: 'Update a team',
      security: AUTH,
      parameters: [pathParam('id', 'Team UUID.', 'uuid')],
      requestBody: jsonBody(ref('UpdateTeamRequest')),
      responses: {
        200: dataResponse('Updated team.', ref('TeamDetail')),
        400: RESP_400,
        401: RESP_401,
        403: RESP_403,
        404: RESP_404,
        409: errorFor('The name is taken for this event.'),
      },
    },
    delete: {
      tags: ['Teams'],
      summary: 'Delete a team',
      description: 'Owner only. Removes the roster and every request attached to the team.',
      security: AUTH,
      parameters: [pathParam('id', 'Team UUID.', 'uuid')],
      responses: {
        204: { description: 'Deleted.' },
        401: RESP_401,
        403: RESP_403,
        404: RESP_404,
      },
    },
  },

  '/api/teams/{id}/applications': {
    post: {
      tags: ['Teams'],
      summary: 'Ask to join a team',
      security: AUTH,
      parameters: [pathParam('id', 'Team UUID.', 'uuid')],
      requestBody: jsonBody({
        type: 'object',
        properties: { message: { type: 'string', maxLength: 400, nullable: true } },
      }),
      responses: {
        201: dataResponse('Application raised.', ref('TeamRequest')),
        400: RESP_400,
        401: RESP_401,
        404: RESP_404,
        409: errorFor(
          'Already a member, already on a team for this event, already applied, or the ' +
            'team already invited you.',
        ),
      },
    },
  },

  '/api/teams/{id}/invitations': {
    post: {
      tags: ['Teams'],
      summary: 'Invite a participant',
      security: AUTH,
      parameters: [pathParam('id', 'Team UUID.', 'uuid')],
      requestBody: jsonBody({
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
          message: { type: 'string', maxLength: 400, nullable: true },
        },
      }),
      responses: {
        201: dataResponse('Invitation sent.', ref('TeamRequest')),
        400: RESP_400,
        401: RESP_401,
        403: RESP_403,
        404: errorFor('No such team or participant.'),
        409: errorFor('Already a member, on another team for this event, or already invited.'),
      },
    },
  },

  '/api/teams/{id}/public': {
    get: {
      tags: ['Teams'],
      summary: "A team's public recruiting page",
      description:
        'No authentication — the point is that it can be shared with somebody who does not ' +
        'have an account yet. Not a copy of the team page: that answers "how are we doing", ' +
        'this answers "why should you join us", and they want different things on screen. ' +
        'Carries no internal assessment. The risk panel, the readiness score and the ' +
        'confidence caveats are for the team, not for the person deciding whether to apply. ' +
        'Answers **404** unless the team is actually recruiting, so a full or locked team ' +
        'never publishes its gaps — and a 404 rather than a 403, so it does not confirm the ' +
        'page ever existed.',
      parameters: [pathParam('id', 'Team UUID.', 'uuid')],
      responses: {
        200: dataResponse('The recruiting page.', ref('PublicTeamPage')),
        404: errorFor('No such team, or it is not recruiting.'),
      },
    },
  },

  '/api/teams/{id}/messages': {
    get: {
      tags: ['Teams'],
      summary: 'Read the team channel',
      description:
        'Members only, and only while still on the roster — leaving a team ends access ' +
        'to its channel. Opening it also marks it read. Returns the last 200 messages, ' +
        'oldest first, each with its sender denormalised so the UI does not fetch a ' +
        'profile per message.',
      security: AUTH,
      parameters: [pathParam('id', 'Team UUID.', 'uuid')],
      responses: {
        200: dataResponse('The channel.', ref('TeamChannel')),
        401: RESP_401,
        403: errorFor('Only members of this team can use its channel.'),
        404: RESP_404,
      },
    },
    post: {
      tags: ['Teams'],
      summary: 'Post to the team channel',
      security: AUTH,
      parameters: [pathParam('id', 'Team UUID.', 'uuid')],
      requestBody: jsonBody(ref('SendMessageRequest')),
      responses: {
        201: dataResponse('Sent.', ref('TeamChatMessage')),
        400: RESP_400,
        401: RESP_401,
        403: errorFor('Only members of this team can use its channel.'),
        404: RESP_404,
      },
    },
  },

  '/api/teams/{id}/logo': {
    post: {
      tags: ['Teams'],
      summary: 'Upload or replace the team logo',
      description:
        'Owner only. PNG, JPEG, or WebP up to 2 MB. Each upload takes a fresh random ' +
        'path so a CDN never serves the previous logo from cache, and the object it ' +
        'replaces is deleted only after the row is written.',
      security: AUTH,
      parameters: [pathParam('id', 'Team UUID.', 'uuid')],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['logo'],
              properties: { logo: { type: 'string', format: 'binary' } },
            },
          },
        },
      },
      responses: {
        200: dataResponse('The updated team.', ref('Team')),
        400: errorFor('Not an image, larger than 2 MB, or uploads are not configured.'),
        401: RESP_401,
        403: errorFor('Only the team owner can do this.'),
        404: RESP_404,
      },
    },
    delete: {
      tags: ['Teams'],
      summary: 'Remove the team logo',
      description: 'Owner only. The UI falls back to a generated monogram.',
      security: AUTH,
      parameters: [pathParam('id', 'Team UUID.', 'uuid')],
      responses: {
        200: dataResponse('The updated team.', ref('Team')),
        401: RESP_401,
        403: RESP_403,
        404: RESP_404,
      },
    },
  },

  '/api/teams/{id}/gaps': {
    get: {
      tags: ['Teams', 'Compatibility'],
      summary: 'What this team is missing for its event',
      description:
        'Coverage of the event’s focus areas across the current roster, which areas and ' +
        'roles are still uncovered, and a readiness score.',
      parameters: [pathParam('id', 'Team UUID.', 'uuid')],
      responses: { 200: dataResponse('The gap report.', ref('TeamEventReport')), 404: RESP_404 },
    },
  },

  '/api/teams/{id}/suggestions': {
    get: {
      tags: ['Teams', 'Compatibility'],
      summary: 'Suggested members for a team',
      description:
        'Owner only. Ranks available participants by mean compatibility with the current ' +
        'roster, then adds a bonus for filling a role in `lookingFor` or covering a ' +
        '`requiredSkills` entry. People already on a team for the event are excluded.',
      security: AUTH,
      parameters: [
        pathParam('id', 'Team UUID.', 'uuid'),
        queryParam('limit', { type: 'integer', minimum: 1, maximum: 25, default: 10 }, 'How many.'),
      ],
      responses: {
        200: listResponse('Ranked candidates, best first.', ref('MemberSuggestion'), false),
        401: RESP_401,
        403: RESP_403,
        404: RESP_404,
      },
    },
  },

  '/api/teams/{id}/leave': {
    post: {
      tags: ['Teams'],
      summary: 'Leave a team',
      description:
        'The owner cannot leave — transfer ownership first, or delete the team if they are ' +
        'the last member.',
      security: AUTH,
      parameters: [pathParam('id', 'Team UUID.', 'uuid')],
      responses: {
        204: { description: 'Left the team.' },
        400: errorFor('Not a member, or the owner tried to leave.'),
        401: RESP_401,
        404: RESP_404,
      },
    },
  },

  '/api/teams/{id}/transfer-ownership': {
    post: {
      tags: ['Teams'],
      summary: 'Hand the team to another member',
      security: AUTH,
      parameters: [pathParam('id', 'Team UUID.', 'uuid')],
      requestBody: jsonBody({
        type: 'object',
        required: ['newOwnerId'],
        properties: { newOwnerId: { type: 'string', format: 'uuid' } },
      }),
      responses: {
        200: dataResponse('The team, with its new owner.', ref('TeamDetail')),
        400: errorFor('The new owner is not a member of the team.'),
        401: RESP_401,
        403: RESP_403,
        404: RESP_404,
      },
    },
  },

  '/api/teams/{id}/members/{userId}': {
    delete: {
      tags: ['Teams'],
      summary: 'Remove a member',
      description: 'Owner only, and the owner cannot remove themselves.',
      security: AUTH,
      parameters: [
        pathParam('id', 'Team UUID.', 'uuid'),
        pathParam('userId', 'Participant UUID.', 'uuid'),
      ],
      responses: {
        204: { description: 'Removed.' },
        400: errorFor('Tried to remove the owner.'),
        401: RESP_401,
        403: RESP_403,
        404: RESP_404,
      },
    },
  },

  // -- compatibility ----------------------------------------------------------

  '/api/compatibility': {
    post: {
      tags: ['Compatibility'],
      summary: 'Score two participants',
      description:
        'Send one id to score that person against yourself, or two to score any pair.\n\n' +
        'The score is a weighted sum of five components — skill complementarity (25), role ' +
        'synergy (25), availability overlap (20), working style (20), and verified ' +
        'credentials (10). Every component comes back with its own score and a plain-language ' +
        'explanation, so the number can always be justified to a user. Fields a participant ' +
        'has not filled in score as neutral rather than as zero.',
      security: AUTH,
      requestBody: jsonBody({
        type: 'object',
        required: ['userIds'],
        properties: {
          userIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            minItems: 1,
            maxItems: 2,
          },
        },
      }),
      responses: {
        200: dataResponse('The compatibility breakdown.', ref('PairCompatibility')),
        400: RESP_400,
        401: RESP_401,
        404: RESP_404,
      },
    },
  },

  '/api/compatibility/matches': {
    get: {
      tags: ['Compatibility'],
      summary: 'My best matches',
      description:
        'Ranks participants who are open to joining a team against the signed-in profile.',
      security: AUTH,
      parameters: [
        queryParam(
          'eventId',
          { type: 'string' },
          'Excludes anyone already on a team for this event.',
        ),
        queryParam(
          'roles',
          { type: 'array', items: { type: 'string', enum: [...TEAM_ROLES] } },
          'Anyone who can play any of these roles. Repeatable, or comma-joined.',
        ),
        queryParam(
          'minScore',
          { type: 'integer', minimum: 0, maximum: 100, default: 0 },
          'Drop matches below this score.',
        ),
        queryParam('limit', { type: 'integer', minimum: 1, maximum: 25, default: 10 }, 'How many.'),
      ],
      responses: {
        200: listResponse('Ranked matches, best first.', ref('Match'), false),
        400: RESP_400,
        401: RESP_401,
      },
    },
  },

  // -- certificates -----------------------------------------------------------

  '/api/certificates': {
    get: {
      tags: ['Certificates'],
      summary: 'My certificates',
      security: AUTH,
      parameters: [
        queryParam(
          'status',
          { type: 'string', enum: [...CERTIFICATE_STATUSES] },
          'Filter by verdict.',
        ),
      ],
      responses: {
        200: listResponse('Your certificates, newest first.', ref('Certificate'), false),
        401: RESP_401,
      },
    },
    post: {
      tags: ['Certificates'],
      summary: 'Submit a certificate',
      description:
        'Verification runs during the request, so the response already carries the verdict.\n\n' +
        'With `ANTHROPIC_API_KEY` set, Claude assesses the claim; otherwise a deterministic ' +
        'rule-based verifier runs. `verifiedBy` records which one produced the verdict.\n\n' +
        '**Scope:** both verifiers assess *plausibility* from the submitted metadata. Neither ' +
        'opens the credential URL, so a verdict is evidence for the badge, not proof the ' +
        'credential exists.',
      security: AUTH,
      requestBody: jsonBody(ref('CertificateWriteRequest')),
      responses: {
        201: dataResponse('Certificate submitted and assessed.', ref('Certificate')),
        400: RESP_400,
        401: RESP_401,
      },
    },
  },

  '/api/certificates/{id}': {
    get: {
      tags: ['Certificates'],
      summary: 'One of my certificates',
      security: AUTH,
      parameters: [pathParam('id', 'Certificate UUID.', 'uuid')],
      responses: {
        200: dataResponse('The certificate.', ref('Certificate')),
        401: RESP_401,
        404: RESP_404,
      },
    },
    patch: {
      tags: ['Certificates'],
      summary: 'Edit a certificate',
      description:
        'Editing the claim clears the previous verdict and re-runs verification — a rejected ' +
        'certificate cannot be edited into a verified one.',
      security: AUTH,
      parameters: [pathParam('id', 'Certificate UUID.', 'uuid')],
      requestBody: jsonBody(ref('CertificateWriteRequest')),
      responses: {
        200: dataResponse('Updated and re-assessed.', ref('Certificate')),
        400: RESP_400,
        401: RESP_401,
        404: RESP_404,
      },
    },
    delete: {
      tags: ['Certificates'],
      summary: 'Delete a certificate',
      description: 'Removing the last verified certificate also clears the Verified badge.',
      security: AUTH,
      parameters: [pathParam('id', 'Certificate UUID.', 'uuid')],
      responses: { 204: { description: 'Deleted.' }, 401: RESP_401, 404: RESP_404 },
    },
  },

  // -- connections ------------------------------------------------------------

  '/api/connections': {
    get: {
      tags: ['Connections'],
      summary: 'My connections, and the requests either way',
      security: AUTH,
      responses: { 200: dataResponse('Overview.', ref('ConnectionsOverview')), 401: RESP_401 },
    },
    post: {
      tags: ['Connections'],
      summary: 'Ask to connect',
      description:
        'Asking someone who has already asked you accepts instead of opening a second, ' +
        'redundant request — both sides clearly want it.',
      security: AUTH,
      requestBody: jsonBody(ref('RequestConnectionRequest')),
      responses: {
        201: dataResponse('Request raised, or connected outright.', ref('ConnectionView')),
        400: errorFor('You cannot connect with yourself.'),
        401: RESP_401,
        404: RESP_404,
        409: errorFor('You are already connected.'),
      },
    },
  },

  '/api/connections/{id}': {
    patch: {
      tags: ['Connections'],
      summary: 'Answer or withdraw a request',
      description:
        '`accept` and `decline` are for the recipient; `cancel` is for the sender. ' +
        'Answering your own request is refused — otherwise anyone could connect to ' +
        'anyone unilaterally.',
      security: AUTH,
      parameters: [pathParam('id', 'Connection UUID.', 'uuid')],
      requestBody: jsonBody(ref('RespondConnectionRequest')),
      responses: {
        200: dataResponse('The new state.', ref('ConnectionView')),
        400: errorFor('You cannot answer your own request.'),
        401: RESP_401,
        403: errorFor('That request is not yours to answer.'),
        404: RESP_404,
        409: errorFor('That request was already answered.'),
      },
    },
    delete: {
      tags: ['Connections'],
      summary: 'Disconnect',
      description:
        'Removes the connection for both sides. The conversation is kept — reconnecting ' +
        'later picks the thread back up, as every messenger does.',
      security: AUTH,
      parameters: [pathParam('id', 'Connection UUID.', 'uuid')],
      responses: { 204: { description: 'Disconnected.' }, 401: RESP_401, 403: RESP_403, 404: RESP_404 },
    },
  },

  '/api/connections/messages/{userId}': {
    get: {
      tags: ['Connections'],
      summary: 'Read a conversation',
      description: 'Reading it also marks the other side’s messages as read.',
      security: AUTH,
      parameters: [pathParam('userId', 'The other participant’s UUID.', 'uuid')],
      responses: {
        200: dataResponse('The thread.', ref('Conversation')),
        401: RESP_401,
        404: RESP_404,
      },
    },
    post: {
      tags: ['Connections'],
      summary: 'Send a message',
      description:
        'Only to someone you are connected with. That single rule is what keeps the inbox ' +
        'from being a channel strangers can push into.',
      security: AUTH,
      parameters: [pathParam('userId', 'The other participant’s UUID.', 'uuid')],
      requestBody: jsonBody(ref('SendMessageRequest')),
      responses: {
        201: dataResponse('Sent.', ref('Message')),
        400: RESP_400,
        401: RESP_401,
        403: errorFor('You can only message people you are connected with.'),
      },
    },
  },

  // -- notifications ----------------------------------------------------------

  '/api/notifications': {
    get: {
      tags: ['Notifications'],
      summary: 'My feed',
      description:
        'The 50 most recent, newest first, with the unread count. Rows are stored rather ' +
        'than derived: "someone accepted your application" is a transition, not a state, ' +
        'so a feed computed from current rows would silently drop exactly the events ' +
        'people most want to be told about.',
      security: AUTH,
      responses: { 200: dataResponse('The feed.', ref('NotificationFeed')), 401: RESP_401 },
    },
  },

  '/api/notifications/read-all': {
    post: {
      tags: ['Notifications'],
      summary: 'Mark everything read',
      security: AUTH,
      responses: {
        200: dataResponse('How many were marked.', {
          type: 'object',
          properties: { marked: { type: 'integer', example: 4 } },
        }),
        401: RESP_401,
      },
    },
  },

  '/api/notifications/{id}/read': {
    post: {
      tags: ['Notifications'],
      summary: 'Mark one read',
      description:
        'Scoped by owner, so an id alone is not enough. "Not yours", "does not exist" and ' +
        '"already read" all answer 404 — distinguishing them would confirm whether ' +
        "someone else's id is real, and none is worth acting on differently.",
      security: AUTH,
      parameters: [pathParam('id', 'Notification UUID.', 'uuid')],
      responses: {
        200: dataResponse('Marked.', ref('Notification')),
        401: RESP_401,
        404: errorFor('No unread notification with that id.'),
      },
    },
  },

  // -- staff console ----------------------------------------------------------
  // Mounted at /api/ops rather than /api/admin, and every failure here is a 404
  // rather than a 403, so probing does not confirm the console exists.

  '/api/ops/accounts': {
    get: {
      tags: ['Staff'],
      summary: 'Every account',
      description: 'Moderator or admin. Search, and filter by site role, verification, or staff.',
      security: AUTH,
      parameters: [
        queryParam('search', { type: 'string', maxLength: 80 }, 'Name or email.'),
        queryParam('accountRole', ref('AccountRole'), 'Filter by site role.'),
        queryParam('verified', { type: 'boolean' }, 'Has a verified certificate.'),
        queryParam('staffOnly', { type: 'boolean' }, 'Moderators and admins only.'),
        queryParam('limit', { type: 'integer', minimum: 1, maximum: 100, default: 50 }, 'Page size.'),
        queryParam('offset', { type: 'integer', minimum: 0, default: 0 }, 'Page offset.'),
      ],
      responses: {
        200: listResponse('Accounts.', ref('AdminAccount')),
        404: errorFor('Returned instead of 403 — the console does not announce itself.'),
      },
    },
  },

  '/api/ops/accounts/{id}': {
    patch: {
      tags: ['Staff'],
      summary: 'Change someone’s site role',
      description:
        'Nobody may act on an account at or above their own rank, nobody may change their ' +
        'own role, and the last admin cannot be demoted.',
      security: AUTH,
      parameters: [pathParam('id', 'Account UUID.', 'uuid')],
      requestBody: jsonBody(ref('UpdateAccountRequest')),
      responses: {
        200: dataResponse('Updated.', ref('AdminAccount')),
        400: errorFor('You cannot change your own role, or demote the last admin.'),
        403: errorFor('That account is at or above your rank.'),
        404: RESP_404,
      },
    },
  },

  '/api/ops/accounts/{id}/ban': {
    post: {
      tags: ['Staff'],
      summary: 'Suspend an account',
      description:
        'Moderators and admins. A ban is either a duration or permanent, never both, and ' +
        'the reason is required because the person is shown it when they try to sign in.',
      security: AUTH,
      parameters: [pathParam('id', 'Account UUID.', 'uuid')],
      requestBody: jsonBody(ref('BanAccountRequest')),
      responses: {
        200: dataResponse('Suspended.', ref('AdminAccount')),
        400: RESP_400,
        403: errorFor('That account is at or above your rank.'),
        404: RESP_404,
      },
    },
    delete: {
      tags: ['Staff'],
      summary: 'Lift a suspension',
      security: AUTH,
      parameters: [pathParam('id', 'Account UUID.', 'uuid')],
      responses: {
        200: dataResponse('Reinstated.', ref('AdminAccount')),
        403: RESP_403,
        404: RESP_404,
      },
    },
  },

  '/api/ops/accounts/{id}/delete': {
    post: {
      tags: ['Staff'],
      summary: 'Delete an account and everything attached to it',
      description:
        'Admin only, and irreversible: profile, certificates, experiences, connections, ' +
        'messages, and team memberships all go. A POST rather than a DELETE because the ' +
        'confirmation has to travel in a body, and DELETE bodies are widely dropped.',
      security: AUTH,
      parameters: [pathParam('id', 'Account UUID.', 'uuid')],
      requestBody: jsonBody(ref('DeleteAccountRequest')),
      responses: {
        // 200 with a body rather than 204: the response names the address that
        // was removed, which is what the console needs to confirm the right row
        // went — and is worth having in an audit log.
        200: dataResponse(
          'Deleted.',
          {
            type: 'object',
            properties: {
              deleted: { type: 'boolean', example: true },
              email: { type: 'string', format: 'email' },
            },
          },
        ),
        400: errorFor('The confirmation email does not match the account.'),
        403: errorFor('Admin only, and never an account at or above your rank.'),
        404: RESP_404,
      },
    },
  },

  '/api/certificates/{id}/verify': {
    post: {
      tags: ['Certificates'],
      summary: 'Re-run verification',
      security: AUTH,
      parameters: [pathParam('id', 'Certificate UUID.', 'uuid')],
      responses: {
        200: dataResponse('The fresh verdict.', ref('Certificate')),
        401: RESP_401,
        404: RESP_404,
      },
    },
  },
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'TapTim API',
    version: '0.2.0',
    description:
      'Backend for TapTim — a matchmaking platform that helps hackathon and tech-event ' +
      'participants find teammates by skills, roles, personality, and compatibility.\n\n' +
      '**Sprint 2 scope:** participant profiles, the event catalogue, team formation with ' +
      'invitations and applications, the compatibility engine, and certificate verification. ' +
      'Everything is persisted in Supabase Postgres.\n\n' +
      '### Envelopes\n' +
      'Success: `{ "data": … }`, with `{ "meta": { total, limit, offset } }` on list ' +
      'endpoints. Failure is always ' +
      '`{ "error": { "code", "message", "details?" } }`.\n\n' +
      '### Trying protected routes\n' +
      '1. Call `POST /api/auth/login` with a seeded account — `ada@taptim.dev` / `demo1234` ' +
      'after `npm run db:seed` — and copy `data.accessToken`.\n' +
      '2. Click **Authorize** at the top right and paste the token.\n' +
      '3. Every 🔒 endpoint now resolves.',
    contact: { name: 'TapTim Team' },
    license: { name: 'MIT' },
  },
  servers: [{ url: `http://localhost:${env.port}`, description: 'Local development' }],
  tags: [
    { name: 'Health', description: 'Service liveness, readiness, and metadata.' },
    { name: 'Auth', description: 'Registration, login, and current-user lookup.' },
    {
      name: 'Participants',
      description: 'Profiles and the participant directory. Profile fields feed the matcher.',
    },
    { name: 'Events', description: 'Event catalogue and organiser CRUD.' },
    { name: 'Teams', description: 'Team formation: rosters, invitations, and applications.' },
    { name: 'Compatibility', description: 'Pair scoring, ranked matches, and team suggestions.' },
    { name: 'Certificates', description: 'Credential claims and the verification pipeline.' },
    {
      name: 'Notifications',
      description: 'What happened while you were away.',
    },
    {
      name: 'Connections',
      description: 'The people you know, and the conversations with them.',
    },
    {
      name: 'Staff',
      description:
        'The moderation console. Mounted at `/api/ops` and answers 404 rather than 403 ' +
        'to anyone without the rank, so it does not announce itself.',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the `accessToken` returned by signup or login.',
      },
    },
    schemas,
  },
  paths,
};
