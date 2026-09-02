import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  applyToTeamHandler,
  createTeamHandler,
  deleteTeamHandler,
  getTeamHandler,
  inviteToTeamHandler,
  leaveTeamHandler,
  listRequestsHandler,
  listTeamsHandler,
  removeMemberHandler,
  respondToRequestHandler,
  suggestMembersHandler,
  teamGapsHandler,
  transferOwnershipHandler,
  updateTeamHandler,
} from './team.controller.js';
import {
  applyToTeamSchema,
  createTeamSchema,
  inviteToTeamSchema,
  listRequestsQuerySchema,
  listTeamsQuerySchema,
  respondToRequestSchema,
  suggestionsQuerySchema,
  transferOwnershipSchema,
  updateTeamSchema,
} from './team.schema.js';

const idParam = z.object({ id: z.string().uuid('Team id must be a UUID.') });
const requestIdParam = z.object({ requestId: z.string().uuid('Request id must be a UUID.') });
const memberParams = z.object({
  id: z.string().uuid('Team id must be a UUID.'),
  userId: z.string().uuid('Participant id must be a UUID.'),
});

export const teamRouter = Router();

// `/requests` is registered before `/:id` so the literal is not read as a team id.
teamRouter.get(
  '/requests',
  requireAuth,
  validateQuery(listRequestsQuerySchema),
  asyncHandler(listRequestsHandler),
);
teamRouter.patch(
  '/requests/:requestId',
  requireAuth,
  validateParams(requestIdParam),
  validateBody(respondToRequestSchema),
  asyncHandler(respondToRequestHandler),
);

teamRouter.get('/', optionalAuth, validateQuery(listTeamsQuerySchema), asyncHandler(listTeamsHandler));
teamRouter.post('/', requireAuth, validateBody(createTeamSchema), asyncHandler(createTeamHandler));

teamRouter.get('/:id', validateParams(idParam), asyncHandler(getTeamHandler));
teamRouter.patch(
  '/:id',
  requireAuth,
  validateParams(idParam),
  validateBody(updateTeamSchema),
  asyncHandler(updateTeamHandler),
);
teamRouter.delete('/:id', requireAuth, validateParams(idParam), asyncHandler(deleteTeamHandler));

teamRouter.post(
  '/:id/applications',
  requireAuth,
  validateParams(idParam),
  validateBody(applyToTeamSchema),
  asyncHandler(applyToTeamHandler),
);
teamRouter.post(
  '/:id/invitations',
  requireAuth,
  validateParams(idParam),
  validateBody(inviteToTeamSchema),
  asyncHandler(inviteToTeamHandler),
);

teamRouter.get(
  '/:id/gaps',
  requireAuth,
  validateParams(idParam),
  asyncHandler(teamGapsHandler),
);

teamRouter.get(
  '/:id/suggestions',
  requireAuth,
  validateParams(idParam),
  validateQuery(suggestionsQuerySchema),
  asyncHandler(suggestMembersHandler),
);

teamRouter.post('/:id/leave', requireAuth, validateParams(idParam), asyncHandler(leaveTeamHandler));
teamRouter.post(
  '/:id/transfer-ownership',
  requireAuth,
  validateParams(idParam),
  validateBody(transferOwnershipSchema),
  asyncHandler(transferOwnershipHandler),
);
teamRouter.delete(
  '/:id/members/:userId',
  requireAuth,
  validateParams(memberParams),
  asyncHandler(removeMemberHandler),
);
