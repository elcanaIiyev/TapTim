import { Button } from '../components/ui/Button';
import { Container } from '../components/ui/Container';

export function NotFoundPage() {
  return (
    <Container className="flex min-h-[70vh] flex-col items-center justify-center py-14 text-center">
      <p className="text-6xl font-extrabold tracking-tight text-gradient">404</p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink-900 dark:text-white">
        This page did not make the team
      </h1>
      <p className="mt-3 max-w-sm text-sm text-ink-600 dark:text-ink-400">
        The link you followed does not exist. Head back home and pick up from there.
      </p>
      <Button to="/" className="mt-8">
        Back to home
      </Button>
    </Container>
  );
}
