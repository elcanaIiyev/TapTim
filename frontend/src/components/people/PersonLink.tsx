import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

/** The little a name or an avatar needs — every person shape on the site has it. */
export interface PersonRef {
  id: string;
  fullName: string;
  firstName?: string | null;
  avatarUrl?: string | null;
}

export function profilePath(id: string): string {
  return `/participants/${id}`;
}

/**
 * A person's picture, or their initial on the brand colour.
 *
 * With `link`, it opens their profile too. The avatar is the largest target in
 * most rows, and on a phone it is the one a thumb actually lands on.
 */
export function PersonAvatar({
  person,
  size = 40,
  link = false,
  className,
}: {
  person: PersonRef;
  size?: number;
  link?: boolean;
  className?: string;
}) {
  // A picture URL that fails to load shows the initial, not a broken-image icon.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPicture = Boolean(person.avatarUrl) && person.avatarUrl !== failedUrl;

  const face = showPicture ? (
    <img
      src={person.avatarUrl ?? undefined}
      alt=""
      onError={() => setFailedUrl(person.avatarUrl ?? null)}
      style={{ width: size, height: size }}
      className={cn('shrink-0 rounded-full object-cover', className)}
    />
  ) : (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) }}
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-iris-600 font-bold text-white',
        className,
      )}
    >
      {(person.firstName || person.fullName)?.[0]?.toUpperCase() ?? '?'}
    </span>
  );

  if (!link) return face;
  return (
    <Link
      to={profilePath(person.id)}
      aria-label={`${person.fullName}’s profile`}
      className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris-500"
    >
      {face}
    </Link>
  );
}

/**
 * A person's name, as the way to their profile.
 *
 * Names were plain text in seventeen places and a link in one, so the only way
 * to learn anything about somebody who invited you, messaged you, or sat on a
 * team you were looking at was to already know where their page was.
 */
export function PersonLink({
  person,
  className,
  children,
}: {
  person: PersonRef;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Link
      to={profilePath(person.id)}
      className={cn(
        'font-semibold text-ink-900 decoration-2 underline-offset-4 transition-colors hover:text-accent-text hover:underline dark:text-white',
        className,
      )}
    >
      {children ?? person.fullName}
    </Link>
  );
}
