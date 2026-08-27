import { Button } from '../components/ui/Button';
import { Container } from '../components/ui/Container';

export function NotFoundPage() {
  return (
    <Container className="flex min-h-[70vh] items-center py-14">
      <div className="relative w-full overflow-hidden rounded-[var(--radius-soft-lg)] border border-ink-200 dark:border-ink-700">
        <div className="wash pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative px-6 py-20 sm:px-14">
          <p className="font-mono text-[clamp(4rem,18vw,10rem)] font-bold leading-none tracking-tighter text-accent-text">
            404
          </p>
          <h1 className="type-section mt-6 max-w-lg text-ink-900 dark:text-white">
            This page did not make the team
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-600 dark:text-ink-300">
            The link you followed does not exist. Head back home and pick up from there.
          </p>
          <Button to="/" className="mt-9">
            Back to home
          </Button>
        </div>
      </div>
    </Container>
  );
}
