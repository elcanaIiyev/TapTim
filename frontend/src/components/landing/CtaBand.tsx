import { Button } from '../ui/Button';
import { Container } from '../ui/Container';

/**
 * `onCreateProfile` and not the old shared "get started" handler.
 *
 * That handler routed anyone with a finished profile to /events, which meant a
 * button reading "Create profile" took you to the events list. One label, one
 * destination: this one goes to the profile, every time.
 */
export function CtaBand({ onCreateProfile }: { onCreateProfile: () => void }) {
  return (
    <section className="border-y border-ink-200 bg-iris-600 dark:border-ink-700">
      <Container className="py-16 sm:py-20">
        {/* Asymmetric: the statement takes the left, the actions sit right. */}
        <div className="grid items-end gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <span className="type-label text-iris-100">Last call</span>
            <h2 className="type-display mt-4 text-white">
              Your next team
              <br />
              is already registered.
            </h2>
          </div>

          <div className="lg:col-span-5">
            <p className="max-w-md text-base leading-relaxed text-iris-50">
              Create a profile in under a minute and let TapTim do the matching before the
              opening ceremony starts.
            </p>
            {/*
              `flex-wrap` matters at exactly the lg breakpoint: this column is
              5 of 12 tracks, and two nowrap buttons side by side are wider
              than it, which pushed the page into horizontal scroll at 1024px.
            */}
            <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
              <Button size="lg" variant="secondary" onClick={onCreateProfile}>
                Create profile
              </Button>
              {/*
                Plain `outline` here: white panel, black frame, black text. On
                the orange band that is the highest-contrast pairing available,
                and it needs no colour overrides to stay legible.
              */}
              <Button size="lg" variant="outline" to="/events">
                Browse events
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
