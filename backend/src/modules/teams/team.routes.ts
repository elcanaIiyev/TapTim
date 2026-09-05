import { Router } from 'express';
import multer from 'multer';
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
  publicTeamPageHandler,
  removeTeamLogoHandler,
  sendTeamMessageHandler,
  teamChannelHandler,
  respondToRequestHandler,
  suggestMembersHandler,
  teamGapsHandler,
  transferOwnershipHandler,
  updateTeamHandler,
  uploadTeamLogoHandler,
} from './team.controller.js';
import {
  applyToTeamSchema,
  createTeamSchema,
  inviteToTeamSchema,
  listRequestsQuerySchema,
  listTeamsQuerySchema,
  respondToRequestSchema,
  sendTeamMessageSchema,
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

// The public recruiting page. No auth at all — the whole point is that it can be
// shared with somebody who does not have an account yet. It answers 404 unless
// the team is actually recruiting, so a full team never publishes its gaps.
teamRouter.get('/:id/public', validateParams(idParam), asyncHandler(publicTeamPageHandler));
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

/**
 * Held in memory rather than written to a temp file: the buffer goes straight
 * back out to storage, so touching the disk would only add a cleanup problem.
 * The cap is enforced here too, so an oversized body is rejected before it is
 * fully buffered.
 */
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

// The team channel. Membership-gated in the service, so a non-member gets a
// 403 rather than a 404 — they can see the team exists, just not its room.
teamRouter.get(
  '/:id/messages',
  requireAuth,
  validateParams(idParam),
  asyncHandler(teamChannelHandler),
);

teamRouter.post(
  '/:id/messages',
  requireAuth,
  validateParams(idParam),
  validateBody(sendTeamMessageSchema),
  asyncHandler(sendTeamMessageHandler),
);

teamRouter.post(
  '/:id/logo',
  requireAuth,
  validateParams(idParam),
  logoUpload.single('logo'),
  asyncHandler(uploadTeamLogoHandler),
);

teamRouter.delete(
  '/:id/logo',
  requireAuth,
  validateParams(idParam),
  asyncHandler(removeTeamLogoHandler),
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
