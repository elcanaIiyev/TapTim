import { Link } from 'react-router-dom';
import { API_URL } from '../../lib/api';
import { Container } from '../ui/Container';
import { Logo } from './Logo';

const FOOTER_COLUMNS = [
  {
    title: 'Platform',
    links: [
      { label: 'Home', to: '/' },
      { label: 'Events', to: '/events' },
      { label: 'Compatibility', to: '/compatibility' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Log in', to: '/login' },
      { label: 'Sign up', to: '/signup' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-950">
      <Container className="py-12 lg:py-16">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-500 dark:text-ink-400">
              TapTim turns a room full of strangers into balanced teams — matched on skills,
              roles, and how people actually like to work.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold text-ink-900 dark:text-white">{column.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-ink-500 transition-colors hover:text-brand-600 dark:text-ink-400 dark:hover:text-brand-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-ink-200 pt-6 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between dark:border-ink-800 dark:text-ink-400">
          <p>© {new Date().getFullYear()} TapTim. Sprint 1 MVP.</p>
          <a
            href={`${API_URL}/api/docs`}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-brand-600 dark:hover:text-brand-400"
          >
            API documentation ↗
          </a>
        </div>
      </Container>
    </footer>
  );
}
