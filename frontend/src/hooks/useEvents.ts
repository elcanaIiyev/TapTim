import { useEffect, useState } from 'react';
import { eventsApi } from '../lib/api';
import type { EventQuery } from '../lib/api';
import type { CategoryCount, EventItem } from '../lib/types';

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

  const { category, search, featured, limit } = query;

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true, error: null }));

    eventsApi
      .list({ category, search, featured, limit })
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
  }, [category, search, featured, limit]);

  return state;
}

export function useCategories(): CategoryCount[] {
  const [categories, setCategories] = useState<CategoryCount[]>([]);

  useEffect(() => {
    let cancelled = false;
    eventsApi
      .categories()
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch(() => {
        // Filter bar degrades to "All" only; the event list surfaces the error.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return categories;
}
