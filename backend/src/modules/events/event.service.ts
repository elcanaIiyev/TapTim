import { HttpError } from '../../utils/http-error.js';
import { MOCK_EVENTS } from './event.data.js';
import { EVENT_CATEGORIES, type EventItem } from './event.model.js';
import type { ListEventsQuery } from './event.schema.js';

export interface ListEventsResult {
  items: EventItem[];
  total: number;
  limit: number;
  offset: number;
}

export function listEvents(query: ListEventsQuery): ListEventsResult {
  const { category, search, featured, limit, offset } = query;
  const needle = search?.toLowerCase();

  const filtered = MOCK_EVENTS.filter((event) => {
    if (category !== 'All' && event.category !== category) return false;
    if (featured !== undefined && event.featured !== featured) return false;
    if (needle) {
      const haystack = [event.name, event.description, event.location, ...event.tags]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  }).sort((a, b) => a.startDate.localeCompare(b.startDate));

  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset,
  };
}

export function getEventById(id: string): EventItem {
  const event = MOCK_EVENTS.find((item) => item.id === id);
  if (!event) {
    throw HttpError.notFound(`No event found with id "${id}".`);
  }
  return event;
}

/** Category list with live counts, used to render the frontend filter bar. */
export function listCategories() {
  return EVENT_CATEGORIES.map((category) => ({
    name: category,
    count: MOCK_EVENTS.filter((event) => event.category === category).length,
  }));
}
