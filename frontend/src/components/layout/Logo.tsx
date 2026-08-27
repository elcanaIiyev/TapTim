import { Link } from 'react-router-dom';

/**
 * A hard orange block with the mark knocked out of it. No gradient, no glow,
 * no rounding — the logo has to carry the same rules as everything else.
 */
export function Logo() {
  return (
    <Link to="/" className="group/logo flex items-center gap-2.5" aria-label="TapTim home">
      <span className="grid h-9 w-9 place-items-center border-2 border-ink-950 bg-flame-600 transition-colors duration-150 group-hover/logo:bg-ink-950 dark:border-ink-100 dark:group-hover/logo:bg-ink-100">
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dark:group-hover/logo:stroke-ink-950"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="m16 11 2 2 4-4" />
        </svg>
      </span>
      <span className="text-lg font-extrabold uppercase tracking-[-0.02em] text-ink-950 dark:text-white">
        Tap<span className="text-accent-text">Tim</span>
      </span>
    </Link>
  );
}
