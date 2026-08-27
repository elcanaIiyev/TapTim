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
      {/* Masthead: title left, live count right, sitting on a hard rule. */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b-2 border-ink-950 pb-8 dark:border-ink-100">
        <div>
          <span className="type-label text-accent-text">Catalogue</span>
          <h1 className="type-display mt-4 text-ink-950 dark:text-white">Explore events</h1>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          Hackathons, AI sprints, design jams, and CTFs — filtered the way you think about them.
        </p>
      </div>

      <div className="mt-8">
        <label htmlFor="event-search" className="sr-only">
          Search events
        </label>
        <div className="relative max-w-lg">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-accent-text">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
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
            className="w-full border-2 border-ink-950 bg-white py-2.5 pl-10 pr-4 text-sm text-ink-950 transition-colors duration-150 placeholder:text-ink-400 hover:border-flame-600 dark:border-ink-400 dark:bg-ink-950 dark:text-white dark:hover:border-flame-500"
          />
        </div>
      </div>

      <div className="mt-6">
        <CategoryFilter
          categories={categories}
          active={category}
          onChange={setCategory}
          total={totalAcrossCategories}
        />
      </div>

      {!loading && !error && (
        <p className="type-label mt-8 border-l-4 border-flame-600 pl-3 text-ink-600 dark:text-ink-400">
          {total} {total === 1 ? 'event' : 'events'} found
        </p>
      )}

      <div className="mt-6">
        <EventGrid events={events} loading={loading} error={error} skeletonCount={9} />
      </div>
    </Container>
  );
}
