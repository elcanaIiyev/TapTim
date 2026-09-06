import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ApiError, profileApi } from '../../lib/api';
import { Spinner } from '../ui/Spinner';

/**
 * "Is that still right?"
 *
 * Availability is the heaviest single thing the matching engine weighs — 28 of
 * 100 for a hackathon — and it is the one field people fill in during
 * onboarding and never look at again. That combination is the quietest way this
 * product goes wrong: availability three months stale is *worse* than
 * availability left blank, because an empty answer scores low and says so,
 * while a wrong one scores high and lies. Nobody sees the failure; the team
 * just never overlaps.
 *
 * Opening an event page is the right moment to ask. It is the one place on the
 * site where the person is thinking about a specific weekend, and answering
 * costs one click.
 *
 * Deliberately not a modal, and deliberately dismissible for the session. A
 * prompt that blocks the page it interrupts gets clicked away without being
 * read, which is worse than not asking.
 */

/** How old an answer has to be before it is worth asking about. */
const STALE_DAYS = 45;

/** Empty availability is a different problem — the profile builder's, not this. */
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  return Math.floor((Date.now() - at) / (24 * 60 * 60 * 1000));
}

export function AvailabilityCheck() {
  const { user, applyUser } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || dismissed) return null;

  const slots = user.availability?.length ?? 0;
  // Nothing to confirm. Someone who has never set availability needs the
  // profile builder, and the fit panel already tells them so.
  if (slots === 0) return null;

  const age = daysSince(user.availabilityConfirmedAt);
  // Never confirmed reads as stale: the column was backfilled on the day it
  // shipped, so a null now means the row genuinely has no answer.
  const stale = age === null || age >= STALE_DAYS;
  if (!stale && !confirmed) return null;

  if (confirmed) {
    return (
      <div className="mt-6 rounded-[var(--radius-soft)] border border-fern-600/40 bg-fern-600/5 px-5 py-4 text-sm text-ink-700 dark:text-ink-200">
        Thanks — your availability is marked current. Everything scored against it just got
        more trustworthy.
      </div>
    );
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      applyUser(await profileApi.confirmAvailability());
      setConfirmed(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-[var(--radius-soft)] border border-signal-warn/40 bg-signal-warn/5 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="type-label text-signal-warn">Still accurate?</p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-700 dark:text-ink-200">
            {age === null
              ? 'You set your availability when you signed up and have not confirmed it since.'
              : `You last confirmed your availability ${age} days ago.`}{' '}
            It is the single heaviest thing matching weighs here, and an out-of-date answer
            scores you into teams you cannot actually show up for.
          </p>

          {error && (
            <p role="alert" className="mt-2 text-sm font-medium text-signal-bad">
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            className="press inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-soft-sm)] border border-iris-700 bg-iris-600 px-4 py-2 text-sm font-semibold text-white hover:bg-iris-700 disabled:opacity-50 dark:border-iris-500"
          >
            {busy && <Spinner />}
            Still right
          </button>
          <Link
            to="/profile"
            className="inline-flex cursor-pointer items-center rounded-[var(--radius-soft-sm)] border border-ink-300 bg-white px-4 py-2 text-sm font-semibold text-ink-800 hover:border-iris-400 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
          >
            Update it
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="cursor-pointer px-2 py-2 font-mono text-xs font-semibold text-ink-600 underline-offset-4 hover:underline dark:text-ink-400"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
