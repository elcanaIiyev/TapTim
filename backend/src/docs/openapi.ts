import { env } from '../config/env.js';
import { EVENT_CATEGORIES } from '../modules/events/event.model.js';
import { PRIMARY_ROLES } from '../modules/users/user.model.js';

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
} as const;

function errorFor(description: string) {
  return {
    description,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  };
}

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'TapTim API',
    version: '0.1.0',
    description:
      'Backend for TapTim — a matchmaking platform that helps hackathon and tech-event ' +
      'participants find teammates by skills, roles, personality, and compatibility.\n\n' +
      '**Sprint 1 scope:** authentication and a placeholder event catalogue. Users are held ' +
      'in an in-memory store, so data resets whenever the server restarts.\n\n' +
      '### Trying protected routes\n' +
      '1. Call `POST /api/auth/signup` (or `/login`) and copy `data.accessToken`.\n' +
      '2. Click **Authorize** at the top right and paste the token.\n' +
      '3. `GET /api/auth/me` now resolves.',
    contact: { name: 'TapTim Team' },
    license: { name: 'MIT' },
  },
  servers: [
    { url: `http://localhost:${env.port}`, description: 'Local development' },
  ],
  tags: [
    { name: 'Health', description: 'Service liveness and metadata.' },
    { name: 'Auth', description: 'Registration, login, and current-user lookup.' },
    { name: 'Events', description: 'Event catalogue and category filters.' },
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
    schemas: {
      ErrorResponse: errorResponse,
      PrimaryRole: { type: 'string', enum: [...PRIMARY_ROLES], example: PRIMARY_ROLES[2] },
      EventCategory: { type: 'string', enum: [...EVENT_CATEGORIES], example: 'Hackathons' },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email', example: 'ada@taptim.dev' },
          fullName: { type: 'string', example: 'Ada Lovelace' },
          primaryRole: { $ref: '#/components/schemas/PrimaryRole' },
          skills: { type: 'array', items: { type: 'string' }, example: ['React', 'Node.js'] },
          bio: { type: 'string', nullable: true },
          avatarUrl: { type: 'string', nullable: true },
          verified: { type: 'boolean', example: false },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthResult: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          tokenType: { type: 'string', example: 'Bearer' },
          expiresIn: { type: 'integer', description: 'Seconds until the token expires.', example: 604800 },
        },
      },
      SignupRequest: {
        type: 'object',
        required: ['email', 'password', 'fullName', 'primaryRole'],
        properties: {
          email: { type: 'string', format: 'email', example: 'ada@taptim.dev' },
          password: { type: 'string', minLength: 8, format: 'password', example: 'hunter2hunter2' },
          fullName: { type: 'string', minLength: 2, example: 'Ada Lovelace' },
          primaryRole: { $ref: '#/components/schemas/PrimaryRole' },
          skills: { type: 'array', items: { type: 'string' }, example: ['React', 'TypeScript'] },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'ada@taptim.dev' },
          password: { type: 'string', format: 'password', example: 'hunter2hunter2' },
        },
      },
      Event: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'evt-001' },
          name: { type: 'string', example: 'TapTim Global Hack 2026' },
          description: { type: 'string' },
          category: { $ref: '#/components/schemas/EventCategory' },
          tags: { type: 'array', items: { type: 'string' } },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          location: { type: 'string', example: 'Baku, Azerbaijan' },
          mode: { type: 'string', enum: ['onsite', 'online', 'hybrid'] },
          teamSize: {
            type: 'object',
            properties: { min: { type: 'integer', example: 3 }, max: { type: 'integer', example: 5 } },
          },
          prizePool: { type: 'string', nullable: true, example: '$25,000' },
          registrationDeadline: { type: 'string', format: 'date-time' },
          participants: { type: 'integer', example: 640 },
          featured: { type: 'boolean' },
        },
      },
      EventCategoryCount: {
        type: 'object',
        properties: {
          name: { $ref: '#/components/schemas/EventCategory' },
          count: { type: 'integer', example: 2 },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        description: 'Returns service status, uptime, and environment. Requires no auth.',
        responses: {
          200: {
            description: 'Service is healthy.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    uptime: { type: 'number', example: 12.34 },
                    environment: { type: 'string', example: 'development' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new participant',
        description:
          'Creates an account and immediately returns a signed JWT, so the client can move ' +
          'straight into onboarding without a second round trip.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SignupRequest' } } },
        },
        responses: {
          201: {
            description: 'Account created.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/AuthResult' } },
                },
              },
            },
          },
          400: errorFor('Validation failed.'),
          409: errorFor('Email already registered.'),
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate and receive an access token',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: {
            description: 'Authenticated.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/AuthResult' } },
                },
              },
            },
          },
          400: errorFor('Validation failed.'),
          401: errorFor('Incorrect email or password.'),
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Fetch the authenticated user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Current user.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/User' } },
                },
              },
            },
          },
          401: errorFor('Missing, expired, or invalid token.'),
        },
      },
    },
    '/api/events': {
      get: {
        tags: ['Events'],
        summary: 'List events',
        description:
          'Returns the placeholder event catalogue sorted by start date, filterable by ' +
          'category, free-text search, and featured flag.',
        parameters: [
          {
            name: 'category',
            in: 'query',
            schema: { type: 'string', enum: ['All', ...EVENT_CATEGORIES], default: 'All' },
            description: 'Restrict to a single category. `All` disables the filter.',
          },
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string', maxLength: 80 },
            description: 'Case-insensitive match on name, description, location, and tags.',
          },
          {
            name: 'featured',
            in: 'query',
            schema: { type: 'string', enum: ['true', 'false'] },
            description: 'Return only featured (or only non-featured) events.',
          },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
        ],
        responses: {
          200: {
            description: 'Matching events.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Event' } },
                    meta: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer', example: 12 },
                        limit: { type: 'integer', example: 20 },
                        offset: { type: 'integer', example: 0 },
                      },
                    },
                  },
                },
              },
            },
          },
          400: errorFor('Invalid query parameters.'),
        },
      },
    },
    '/api/events/categories': {
      get: {
        tags: ['Events'],
        summary: 'List categories with event counts',
        responses: {
          200: {
            description: 'Categories and how many events each holds.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/EventCategoryCount' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/events/{id}': {
      get: {
        tags: ['Events'],
        summary: 'Fetch a single event',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'evt-001' },
        ],
        responses: {
          200: {
            description: 'The event.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/Event' } },
                },
              },
            },
          },
          404: errorFor('No event with that id.'),
        },
      },
    },
  },
} as const;
