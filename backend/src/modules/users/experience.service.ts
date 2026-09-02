import {
  experienceStore,
  type ExperienceRecord,
  type ExperienceUpdate,
} from '../../data/experience.store.js';
import { HttpError } from '../../utils/http-error.js';
import type { CreateExperienceInput, UpdateExperienceInput } from './experience.schema.js';

/** Enough for a real timeline, low enough that the profile page stays readable. */
const MAX_ENTRIES = 30;

async function requireOwn(id: string, userId: string): Promise<ExperienceRecord> {
  const entry = await experienceStore.findById(id);
  // 404 rather than 403 either way: whether someone else's entry exists is not
  // this caller's business.
  if (!entry || entry.userId !== userId) {
    throw HttpError.notFound(`No experience entry found with id "${id}".`);
  }
  return entry;
}

export function listExperiences(userId: string): Promise<ExperienceRecord[]> {
  return experienceStore.listByUser(userId);
}

export async function createExperience(
  userId: string,
  input: CreateExperienceInput,
): Promise<ExperienceRecord> {
  if ((await experienceStore.countFor(userId)) >= MAX_ENTRIES) {
    throw HttpError.badRequest(
      `A profile can hold ${MAX_ENTRIES} experience entries. Remove one to add another.`,
    );
  }

  return experienceStore.create(userId, {
    kind: input.kind,
    title: input.title,
    organisation: input.organisation,
    startDate: input.startDate,
    endDate: input.endDate,
    isCurrent: input.isCurrent,
    description: input.description,
    url: input.url,
    skills: input.skills,
  });
}

export async function updateExperience(
  id: string,
  userId: string,
  input: UpdateExperienceInput,
): Promise<ExperienceRecord> {
  const existing = await requireOwn(id, userId);

  // The schema can only compare fields present in the same request, so a PATCH
  // moving one end of the range is checked against what is already stored.
  const startDate = input.startDate !== undefined ? input.startDate : existing.startDate;
  const endDate = input.endDate !== undefined ? input.endDate : existing.endDate;
  const isCurrent = input.isCurrent !== undefined ? input.isCurrent : existing.isCurrent;

  if (!isCurrent && startDate && endDate && Date.parse(endDate) < Date.parse(startDate)) {
    throw HttpError.badRequest('This cannot end before it started.', [
      { field: 'endDate', message: 'This cannot end before it started.' },
    ]);
  }

  const patch: ExperienceUpdate = {
    kind: input.kind,
    title: input.title,
    organisation: input.organisation,
    startDate: input.startDate,
    endDate: input.endDate,
    isCurrent: input.isCurrent,
    description: input.description,
    url: input.url,
    skills: input.skills,
  };
  for (const key of Object.keys(patch) as Array<keyof ExperienceUpdate>) {
    if (patch[key] === undefined) delete patch[key];
  }

  const updated = await experienceStore.update(id, patch);
  if (!updated) throw HttpError.notFound(`No experience entry found with id "${id}".`);
  return updated;
}

export async function deleteExperience(id: string, userId: string): Promise<void> {
  await requireOwn(id, userId);
  await experienceStore.remove(id);
}
