import type { Request, Response } from 'express';
import { getValidatedQuery } from '../../middleware/validate.middleware.js';
import { deleteAvatar, isStorageConfigured, uploadAvatar } from '../../services/storage.js';
import { userStore } from '../../data/user.store.js';
import { HttpError } from '../../utils/http-error.js';
import * as experienceService from './experience.service.js';
import type { CreateExperienceInput, UpdateExperienceInput } from './experience.schema.js';
import {
  EVENT_GOALS,
  EXPERIENCE_KINDS,
  INTEREST_DOMAINS,
  LANGUAGES,
  PRONOUN_OPTIONS,
} from './profile-options.js';
import {
  ALL_SKILLS,
  MAX_SKILLS,
  POPULAR_SKILLS,
  SKILL_CATEGORIES,
  SKILL_LEVELS,
} from './skill-catalogue.js';
import {
  AVAILABILITY_SLOTS,
  EXPERIENCE_LEVELS,
  MAX_TEAM_ROLES,
  PERSONALITY_TRAITS,
  TEAM_ROLES,
  toPublicUser,
} from './user.model.js';
import type { ListUsersQuery, UpdateProfileInput } from './user.schema.js';
import * as userService from './user.service.js';

function requireUser(req: Request) {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}

export async function listUsersHandler(req: Request, res: Response) {
  const query = getValidatedQuery<ListUsersQuery>(req);
  const { items, total, limit, offset } = await userService.listUsers(query, req.user?.id);
  res.status(200).json({ data: items, meta: { total, limit, offset } });
}

export async function getMeHandler(req: Request, res: Response) {
  const user = requireUser(req);
  res.status(200).json({
    data: {
      ...toPublicUser(user),
      profileCompleteness: userService.profileCompleteness(user),
    },
  });
}

export async function updateMeHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const updated = await userService.updateProfile(user.id, req.body as UpdateProfileInput);
  res.status(200).json({ data: updated });
}

export async function getUserHandler(req: Request, res: Response) {
  res.status(200).json({ data: await userService.getProfile(req.params.id) });
}


/**
 * Every closed vocabulary the profile builder offers, in one call.
 *
 * The chips are rendered from this rather than from a hard-coded copy in the
 * SPA: a list that exists in two places drifts, and the half that drifts is the
 * one the validator does not use — so the person gets a rejection for picking
 * something the UI showed them.
 */
export function profileOptionsHandler(_req: Request, res: Response) {
  res.status(200).json({
    data: {
      teamRoles: TEAM_ROLES,
      maxTeamRoles: MAX_TEAM_ROLES,
      experienceLevels: EXPERIENCE_LEVELS,
      availabilitySlots: AVAILABILITY_SLOTS,
      personalityTraits: PERSONALITY_TRAITS,
      languages: LANGUAGES,
      interestDomains: INTEREST_DOMAINS,
      goals: EVENT_GOALS,
      pronouns: PRONOUN_OPTIONS,
      experienceKinds: EXPERIENCE_KINDS,
      // The whole catalogue ships in one call — ~200 short strings is a few kB,
      // far cheaper than a search endpoint round-tripping on every keystroke,
      // and it lets the picker filter instantly with no network at all.
      skills: {
        popular: POPULAR_SKILLS,
        categories: SKILL_CATEGORIES,
        all: ALL_SKILLS,
        levels: SKILL_LEVELS,
        max: MAX_SKILLS,
      },
      avatarUploadEnabled: isStorageConfigured(),
    },
  });
}

// -- avatar -------------------------------------------------------------------

export async function uploadAvatarHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const file = req.file;

  if (!file) {
    throw HttpError.badRequest('Attach an image under the field name "avatar".');
  }

  const stored = await uploadAvatar(user.id, {
    buffer: file.buffer,
    mimetype: file.mimetype,
    size: file.size,
  });

  const result = await userStore.setAvatar(user.id, stored.url, stored.path);
  if (!result) throw HttpError.notFound('The account for this token no longer exists.');

  // The replaced object is removed after the new one is safely recorded, so a
  // failure here never leaves the profile pointing at a deleted image.
  if (result.previousPath) void deleteAvatar(result.previousPath);

  res.status(200).json({ data: toPublicUser(result.user) });
}

export async function removeAvatarHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const result = await userStore.setAvatar(user.id, null, null);
  if (!result) throw HttpError.notFound('The account for this token no longer exists.');

  if (result.previousPath) void deleteAvatar(result.previousPath);
  res.status(200).json({ data: toPublicUser(result.user) });
}

// -- experience ---------------------------------------------------------------

export async function listExperiencesHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const items = await experienceService.listExperiences(user.id);
  res.status(200).json({ data: items, meta: { total: items.length } });
}

export async function createExperienceHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const created = await experienceService.createExperience(
    user.id,
    req.body as CreateExperienceInput,
  );
  res.status(201).json({ data: created });
}

export async function updateExperienceHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const updated = await experienceService.updateExperience(
    req.params.id,
    user.id,
    req.body as UpdateExperienceInput,
  );
  res.status(200).json({ data: updated });
}

export async function deleteExperienceHandler(req: Request, res: Response) {
  const user = requireUser(req);
  await experienceService.deleteExperience(req.params.id, user.id);
  res.status(204).send();
}
