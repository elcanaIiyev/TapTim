import { useEffect, useState } from 'react';
import { CategoryFilter } from '../components/events/CategoryFilter';
import { EventGrid } from '../components/events/EventGrid';
import { Container } from '../components/ui/Container';
import { useCategories, useEvents } from '../hooks/useEvents';

export function EventsPage() {
  const [category, setCategory] = useState('All');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce so each keystroke does not fire a request.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const categories = useCategories();
  const { events, total, loading, error } = useEvents({
    category,
    search: search || undefined,
    limit: 50,
  });

  const totalAcrossCategories = categories.reduce((sum, item) => sum + item.count, 0);

  return (
    <Container className="py-14 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl dark:text-white">
          Explore <span className="text-gradient">Events</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-600 sm:text-lg dark:text-ink-400">
          Hackathons, AI sprints, design jams, and CTFs — filtered the way you think about them.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-md">
        <label htmlFor="event-search" className="sr-only">
          Search events
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            id="event-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name, tag, or location…"
            className="w-full rounded-xl border border-ink-300 bg-white py-2.5 pl-10 pr-4 text-sm text-ink-900 placeholder:text-ink-400 hover:border-ink-400 focus:border-brand-500 dark:border-ink-700 dark:bg-ink-950/60 dark:text-white dark:hover:border-ink-600"
          />
        </div>
      </div>

      <div className="mt-8">
        <CategoryFilter
          categories={categories}
          active={category}
          onChange={setCategory}
          total={totalAcrossCategories}
        />
      </div>

      {!loading && !error && (
        <p className="mt-8 text-center text-sm text-ink-500 dark:text-ink-400">
          {total} {total === 1 ? 'event' : 'events'} found
        </p>
      )}

      <div className="mt-8">
        <EventGrid events={events} loading={loading} error={error} skeletonCount={9} />
      </div>
    </Container>
  );
}
