import { eventStore, type EventUpdate } from '../../data/event.store.js';
import { canModerate } from '../../middleware/admin.middleware.js';
import { HttpError } from '../../utils/http-error.js';
import type { UserRecord } from '../users/user.model.js';
import { EVENT_DOMAINS, EVENT_FORMATS, type EventItem } from './event.model.js';
import type { CreateEventInput, ListEventsQuery, UpdateEventInput } from './event.schema.js';

export interface ListEventsResult {
  items: EventItem[];
  total: number;
  limit: number;
  offset: number;
}

export async function listEvents(query: ListEventsQuery): Promise<ListEventsResult> {
  const { items, total } = await eventStore.list({
    format: query.format,
    domains: query.domains,
    search: query.search,
    featured: query.featured,
    mode: query.mode,
    limit: query.limit,
    offset: query.offset,
  });

  return { items, total, limit: query.limit, offset: query.offset };
}

export async function getEventById(id: string): Promise<EventItem> {
  const event = await eventStore.findById(id);
  if (!event) {
    throw HttpError.notFound(`No event found with id "${id}".`);
  }
  return event;
}

export interface EventFacets {
  formats: Array<{ name: string; count: number }>;
  domains: Array<{ name: string; count: number }>;
}

/**
 * Both filter axes with live counts.
 *
 * The full set is returned including empty entries: the filter bar renders all
 * of them, and would otherwise change shape as data comes and goes.
 *
 * A domain count is not a partition — an event tagged Web *and* Design is
 * counted under both, so the domain counts deliberately sum to more than the
 * number of events. That is the whole point of the axis, and the UI says so
 * rather than showing a total that does not add up.
 */
export async function listFacets(): Promise<EventFacets> {
  const [formats, domains] = await Promise.all([
    eventStore.formatCounts(),
    eventStore.domainCounts(),
  ]);

  const byFormat = new Map(formats.map((entry) => [entry.name, entry.count]));
  const byDomain = new Map(domains.map((entry) => [entry.name, entry.count]));

  return {
    formats: EVENT_FORMATS.map((name) => ({ name, count: byFormat.get(name) ?? 0 })),
    domains: EVENT_DOMAINS.map((name) => ({ name, count: byDomain.get(name) ?? 0 })),
  };
}

export async function createEvent(
  input: CreateEventInput,
  createdBy: string,
): Promise<EventItem> {
  return eventStore.create(
    {
      name: input.name,
      description: input.description,
      format: input.format,
      domains: input.domains,
      tags: input.tags,
      startDate: input.startDate,
      endDate: input.endDate,
      location: input.location,
      mode: input.mode,
      teamSize: input.teamSize,
      prizePool: input.prizePool,
      registrationDeadline: input.registrationDeadline,
      participants: input.participants,
      featured: input.featured,
    },
    createdBy,
  );
}

/**
 * Only the account that created an event may change it. The seeded catalogue
 * has no creator, so it is read-only for everyone rather than editable by the
 * first person who asks.
 */
async function assertCanManage(id: string, actorId: string): Promise<EventItem> {
  const event = await getEventById(id);
  if (event.createdBy === null) {
    throw HttpError.forbidden('Events from the seeded catalogue cannot be modified.');
  }
  if (event.createdBy !== actorId) {
    throw HttpError.forbidden('Only the organiser who created this event can modify it.');
  }
  return event;
}

export async function updateEvent(
  id: string,
  input: UpdateEventInput,
  actorId: string,
): Promise<EventItem> {
  const existing = await assertCanManage(id, actorId);

  // The schema can only compare fields present in the same request, so a PATCH
  // that moves one end of a range is checked against what is already stored.
  const startDate = input.startDate ?? existing.startDate;
  const endDate = input.endDate ?? existing.endDate;
  const deadline = input.registrationDeadline ?? existing.registrationDeadline;

  if (Date.parse(endDate) < Date.parse(startDate)) {
    throw HttpError.badRequest('End date must be on or after the start date.', [
      { field: 'endDate', message: 'End date must be on or after the start date.' },
    ]);
  }
  if (Date.parse(deadline) > Date.parse(startDate)) {
    throw HttpError.badRequest('Registration must close on or before the start date.', [
      {
        field: 'registrationDeadline',
        message: 'Registration must close on or before the start date.',
      },
    ]);
  }

  const patch: EventUpdate = {
    name: input.name,
    description: input.description,
    format: input.format,
    domains: input.domains,
    // `undefined` leaves it alone; `null` clears the override back to the
    // archetype. The store drops undefined and keeps null, so the two stay
    // distinguishable all the way to the column.
    statProfile: input.statProfile,
    tags: input.tags,
    startDate: input.startDate,
    endDate: input.endDate,
    location: input.location,
    mode: input.mode,
    prizePool: input.prizePool,
    registrationDeadline: input.registrationDeadline,
    participants: input.participants,
    featured: input.featured,
    teamSizeMin: input.teamSize?.min,
    teamSizeMax: input.teamSize?.max,
  };

  for (const key of Object.keys(patch) as Array<keyof EventUpdate>) {
    if (patch[key] === undefined) delete patch[key];
  }

  const updated = await eventStore.update(id, patch);
  if (!updated) throw HttpError.notFound(`No event found with id "${id}".`);
  return updated;
}

/**
 * Moderators can delete an organiser's event without owning it. The seeded
 * catalogue stays immutable for everyone — it is reference data, not something
 * a person created and might need taking down.
 */
export async function deleteEvent(id: string, actor: UserRecord): Promise<void> {
  const event = await getEventById(id);

  if (event.createdBy === null) {
    throw HttpError.forbidden('Events from the seeded catalogue cannot be modified.');
  }
  if (event.createdBy !== actor.id && !canModerate(actor.accountRole)) {
    throw HttpError.forbidden('Only the organiser who created this event can modify it.');
  }

  const removed = await eventStore.remove(id);
  if (!removed) throw HttpError.notFound(`No event found with id "${id}".`);
}
