import { useState } from 'react';
import { useEventFacets, useEvents } from '../../hooks/useEvents';
import { EventFilters } from '../events/EventFilters';
import { EventGrid } from '../events/EventGrid';
import { Button } from '../ui/Button';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

export function EventShowcase() {
  const [format, setFormat] = useState('All');
  const [domains, setDomains] = useState<string[]>([]);
  const facets = useEventFacets();
  const { events, total, loading, error } = useEvents({ format, domains, limit: 6 });

  const allEvents = (facets?.formats ?? []).reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="border-b border-ink-200 py-20 sm:py-24 dark:border-ink-700">
      <Container>
        <SectionHeading
          overline="Event Showcase"
          title="Pick an event, then build the team for it"
          description="Browse hackathons, AI sprints, design jams, and CTFs. Every listing shows the team size it expects, so you know what you are recruiting for."
        />

        <div className="mt-10">
          <EventFilters
            facets={facets}
            format={format}
            domains={domains}
            onFormatChange={setFormat}
            onDomainsChange={setDomains}
            total={allEvents}
          />
        </div>

        <div className="mt-10">
          <EventGrid events={events} loading={loading} error={error} skeletonCount={6} />
        </div>

        {!loading && !error && total > events.length && (
          <div className="mt-12">
            <Button variant="outline" to="/events">
              View all {total} events
            </Button>
          </div>
        )}
      </Container>
    </section>
  );
}
