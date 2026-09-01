import { env } from '../config/env.js';
import { CERTIFICATE_STATUSES } from '../modules/certificates/certificate.model.js';
import { EVENT_CATEGORIES, EVENT_MODES } from '../modules/events/event.model.js';
import { TEAM_STATUSES } from '../modules/teams/team.model.js';
import {
  AVAILABILITY_SLOTS,
  EXPERIENCE_LEVELS,
  PERSONALITY_TRAITS,
  PRIMARY_ROLES,
} from '../modules/users/user.model.js';

/**
 * Hand-authored OpenAPI 3.0.3 document.
 *
 * It is written as a TypeScript object rather than a YAML file so the enums
 * below are the *same* constants the validators use — a role added to
 * `PRIMARY_ROLES` shows up in the docs without anyone remembering to update
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
  primaryRole: ref('PrimaryRole'),
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

  PrimaryRole: { type: 'string', enum: [...PRIMARY_ROLES], example: PRIMARY_ROLES[2] },
  ExperienceLevel: { type: 'string', enum: [...EXPERIENCE_LEVELS], example: 'intermediate' },
  AvailabilitySlot: { type: 'string', enum: [...AVAILABILITY_SLOTS], example: 'weekday-evenings' },
  EventCategory: { type: 'string', enum: [...EVENT_CATEGORIES], example: 'Hackathons' },
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
    required: ['email', 'password', 'fullName', 'primaryRole'],
    properties: {
      email: { type: 'string', format: 'email', example: 'ada@taptim.dev' },
      password: { type: 'string', minLength: 8, maxLength: 128, example: 'hunter2hunter2' },
      fullName: { type: 'string', minLength: 2, maxLength: 80, example: 'Ada Rzayeva' },
      primaryRole: ref('PrimaryRole'),
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
      primaryRole: ref('PrimaryRole'),
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
      category: ref('EventCategory'),
      tags: { type: 'array', items: { type: 'string' }, example: ['48h', 'Open Track'] },
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
      category: ref('EventCategory'),
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

  EventCategoryCount: {
    type: 'object',
    properties: {
      name: ref('EventCategory'),
      count: { type: 'integer', example: 2 },
    },
  },

  TeamMember: {
    type: 'object',
    properties: {
      userId: { type: 'string', format: 'uuid' },
      role: ref('PrimaryRole'),
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
        items: ref('PrimaryRole'),
        description: 'Roles the team still needs. Drives suggestion ranking.',
      },
      requiredSkills: { type: 'array', items: { type: 'string' } },
      maxSize: { type: 'integer', example: 5 },
      status: ref('TeamStatus'),
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
      lookingFor: { type: 'array', items: ref('PrimaryRole') },
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
      lookingFor: { type: 'array', items: ref('PrimaryRole') },
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

  // -- users ------------------------------------------------------------------

  '/api/users': {
    get: {
      tags: ['Participants'],
      summary: 'Browse participants',
      description:
        'The participant directory. When called with a token, the caller is excluded from ' +
        'their own results.',
      parameters: [
        queryParam('search', { type: 'string', maxLength: 80 }, 'Matches name, bio, or skills.'),
        queryParam('primaryRole', { type: 'string', enum: [...PRIMARY_ROLES] }, 'Exact role match.'),
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
          'category',
          { type: 'string', enum: ['All', ...EVENT_CATEGORIES], default: 'All' },
          'Exact category match.',
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

  '/api/events/categories': {
    get: {
      tags: ['Events'],
      summary: 'Categories with counts',
      description: 'All eight categories are always returned, including any sitting at zero.',
      responses: {
        200: listResponse('Category counts.', ref('EventCategoryCount'), false),
      },
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
      description: 'Organiser only. Seeded catalogue events have no organiser and cannot be edited.',
      security: AUTH,
      parameters: [pathParam('id', 'Event id.')],
      requestBody: jsonBody(ref('EventWriteRequest')),
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
          { type: 'string', enum: [...PRIMARY_ROLES] },
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
          'primaryRole',
          { type: 'string', enum: [...PRIMARY_ROLES] },
          'Only candidates in this role.',
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
