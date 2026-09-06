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
      { label: 'Teams recruiting', to: '/recruiting' },
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
    <footer className="surface-dark mt-auto border-t border-ink-200 bg-ink-950 text-ink-100 dark:border-ink-700">
      {/* Full-bleed statement line: the footer opens with type, not links. */}
      <Container className="border-b border-ink-800 py-10 lg:py-14">
        <p className="type-display max-w-4xl text-ink-50">
          Build the team,
          <br />
          <span className="text-accent-text">then build the thing.</span>
        </p>
      </Container>

      <Container className="py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            {/*
              The footer sits on ink-950, so only the wordmark's base colour is
              overridden. Scoped to the *first* child span — the one carrying
              the text — so the nested "Tim" keeps its accent and the rule
              underneath keeps its own colour.
            */}
            <div className="[&>a>span:first-child]:text-ink-50">
              <Logo />
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-400">
              TapTim turns a room full of strangers into balanced teams — matched on skills,
              roles, and how people actually like to work.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="type-label border-b border-ink-700 pb-2 text-accent-text">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="inline-block py-1 text-sm font-medium text-ink-300 transition-colors duration-150 hover:text-iris-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="type-label mt-14 flex flex-col gap-3 border-t border-ink-800 pt-6 text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} TapTim / Sprint 1 MVP</p>
          {/* A mode nobody is told about is a mode nobody uses. The footer is
              where the rest of the site's small print already lives. */}
          <p className="text-ink-500">
            Press <span className="readout text-ink-300">`</span> for keyboard navigation
          </p>
          <a
            href={`${API_URL}/api/docs`}
            target="_blank"
            rel="noreferrer"
            className="transition-colors duration-150 hover:text-iris-400"
          >
            API documentation ↗
          </a>
        </div>
      </Container>
    </footer>
  );
}
