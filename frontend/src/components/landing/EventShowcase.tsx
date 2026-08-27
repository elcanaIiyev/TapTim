import { useState } from 'react';
import { useCategories, useEvents } from '../../hooks/useEvents';
import { CategoryFilter } from '../events/CategoryFilter';
import { EventGrid } from '../events/EventGrid';
import { Button } from '../ui/Button';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';

export function EventShowcase() {
  const [category, setCategory] = useState('All');
  const categories = useCategories();
  const { events, total, loading, error } = useEvents({ category, limit: 6 });

  const totalAcrossCategories = categories.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="py-20 sm:py-24">
      <Container>
        <SectionHeading
          overline="Event Showcase"
          title="Pick an event, then build the team for it"
          description="Browse hackathons, AI sprints, design jams, and CTFs. Every listing shows the team size it expects, so you know what you are recruiting for."
        />

        <div className="mt-10">
          <CategoryFilter
            categories={categories}
            active={category}
            onChange={setCategory}
            total={totalAcrossCategories}
          />
        </div>

        <div className="mt-10">
          <EventGrid events={events} loading={loading} error={error} skeletonCount={6} />
        </div>

        {!loading && !error && total > events.length && (
          <div className="mt-10 text-center">
            <Button variant="outline" to="/events">
              View all {total} events
            </Button>
          </div>
        )}
      </Container>
    </section>
  );
}
