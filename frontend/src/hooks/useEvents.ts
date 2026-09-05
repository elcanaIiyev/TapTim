import { useEffect, useState } from 'react';
import { eventsApi } from '../lib/api';
import type { EventQuery } from '../lib/api';
import type { EventFacets, EventItem } from '../lib/types';

interface EventsState {
  events: EventItem[];
  total: number;
  loading: boolean;
  error: string | null;
}

/** Fetches events whenever the query changes, discarding stale responses. */
export function useEvents(query: EventQuery): EventsState {
  const [state, setState] = useState<EventsState>({
    events: [],
    total: 0,
    loading: true,
    error: null,
  });

  const { format, domains, search, featured, limit } = query;

  // Joined for the dependency list: a fresh array each render would otherwise
  // refetch on every keystroke elsewhere on the page.
  const domainKey = (domains ?? []).join(',');

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true, error: null }));

    eventsApi
      .list({ format, domains, search, featured, limit })
      .then((response) => {
        if (cancelled) return;
        setState({
          events: response.data,
          total: response.meta.total,
          loading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          events: [],
          total: 0,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load events.',
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- domainKey stands in for `domains`
  }, [format, domainKey, search, featured, limit]);

  return state;
}

/** Both filter axes with their counts. */
export function useEventFacets(): EventFacets | null {
  const [facets, setFacets] = useState<EventFacets | null>(null);

  useEffect(() => {
    let cancelled = false;
    eventsApi
      .facets()
      .then((data) => {
        if (!cancelled) setFacets(data);
      })
      .catch(() => {
        // The filter bar degrades to "Any format"; the event list surfaces the
        // error, so failing here twice would only be noise.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return facets;
}
