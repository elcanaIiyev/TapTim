import { Button } from '../ui/Button';
import { Container } from '../ui/Container';

export function CtaBand({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-ink-900 px-6 py-16 text-center sm:px-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, rgba(34,211,238,.35), transparent 45%), radial-gradient(circle at 80% 70%, rgba(129,140,248,.35), transparent 45%)',
            }}
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Your next team is already registered
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-brand-100">
              Create a profile in under a minute and let TapTim do the matching before the
              opening ceremony starts.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" variant="secondary" onClick={onGetStarted}>
                Create your profile
              </Button>
              <Button
                size="lg"
                to="/events"
                className="border border-white/25 bg-white/10 text-white hover:bg-white/20"
              >
                Browse events
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
