import { useState } from 'react';
import { ApiError, eventsApi } from '../../lib/api';
import { cn } from '../../lib/cn';
import type { ComponentWeights, EventItem, EventStatProfile } from '../../lib/types';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

/**
 * Lets the organiser say how their own event is judged.
 *
 * The override column has existed since the per-event stat profiles landed, but
 * only a developer could write it — so every hackathon was scored identically
 * and an organiser saying "this year we're judging on demo quality, not code"
 * had nowhere to say it. This is that form.
 *
 * It starts from the composed archetype rather than from blanks: an organiser
 * adjusting one thing should not have to restate the other four, and seeing the
 * defaults is how they learn what the numbers mean in the first place.
 */

const WEIGHT_LABEL: Record<keyof ComponentWeights, string> = {
  skills: 'Skills',
  roles: 'Role mix',
  availability: 'Availability',
  workingStyle: 'Working style',
  credibility: 'Credentials',
};

const WEIGHT_HINT: Record<keyof ComponentWeights, string> = {
  skills: 'Depth in what the event draws on.',
  roles: 'Whether the team covers every position it needs.',
  availability: 'Overlapping hours. Raise it for anything short and intense.',
  workingStyle: 'How well people actually work together.',
  credibility: 'Verified certificates. Worth more where proof matters.',
};

const KEYS = Object.keys(WEIGHT_LABEL) as Array<keyof ComponentWeights>;

export function ScoringEditor({
  event,
  profile,
  onSaved,
}: {
  event: EventItem;
  /** The profile in force now — archetype, or the existing override. */
  profile: EventStatProfile;
  onSaved: (updated: EventItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [weights, setWeights] = useState<ComponentWeights>(profile.weights);
  const [summary, setSummary] = useState(profile.summary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const total = KEYS.reduce((sum, key) => sum + (weights[key] ?? 0), 0);
  const balanced = total === 100;

  async function save(clear = false) {
    setBusy(true);
    setError(null);
    try {
      const updated = await eventsApi.update(event.id, {
        statProfile: clear ? null : { weights, summary: summary.trim() || undefined },
      });
      onSaved(updated);
      setSaved(true);
      if (clear) {
        setOpen(false);
        setSaved(false);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not save.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="type-label text-ink-700 dark:text-ink-300">You organise this event</p>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
            Change how teams are scored for it — what you actually judge on.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Edit scoring
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="type-label text-ink-700 dark:text-ink-300">How this event is judged</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
            These weights decide how every team and candidate is scored here. They start from
            what a {event.format.toLowerCase()} usually rewards — change them to match what you
            are actually judging.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="cursor-pointer font-mono text-xs font-semibold text-ink-600 underline-offset-4 hover:underline dark:text-ink-400"
        >
          Close
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {KEYS.map((key) => (
          <div key={key}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label htmlFor={`weight-${key}`} className="font-semibold text-ink-900 dark:text-white">
                {WEIGHT_LABEL[key]}
              </label>
              <span className="readout text-sm tabular-nums text-ink-700 dark:text-ink-300">
                {weights[key]}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink-600 dark:text-ink-400">{WEIGHT_HINT[key]}</p>
            <input
              id={`weight-${key}`}
              type="range"
              min={0}
              max={60}
              step={1}
              value={weights[key]}
              onChange={(e) =>
                setWeights((current) => ({ ...current, [key]: Number(e.target.value) }))
              }
              className="mt-2 w-full cursor-pointer accent-iris-600"
            />
          </div>
        ))}
      </div>

      {/* The running total is shown rather than the form silently rescaling.
          A weighting is a statement about relative importance, and numbers
          adding to 140 mean something the organiser did not say. */}
      <div
        className={cn(
          'mt-5 rounded-[var(--radius-soft-sm)] border px-4 py-3 text-sm',
          balanced
            ? 'border-fern-600/40 bg-fern-600/5 text-ink-700 dark:text-ink-200'
            : 'border-signal-warn/40 bg-signal-warn/10 text-ink-800 dark:text-ink-100',
        )}
      >
        <strong className="tabular-nums">{total}</strong> / 100
        {!balanced && (
          <span className="ml-2">
            — {total > 100 ? 'take' : 'add'} {Math.abs(100 - total)} somewhere before saving.
          </span>
        )}
      </div>

      <div className="mt-5">
        <label htmlFor="scoring-summary" className="type-label text-ink-700 dark:text-ink-300">
          What competitors should know
        </label>
        <textarea
          id="scoring-summary"
          rows={3}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={400}
          className="mt-2 w-full resize-y rounded-[var(--radius-soft-sm)] border border-ink-950 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 dark:border-ink-700 dark:bg-ink-950 dark:text-white"
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-signal-bad">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="mt-3 text-sm font-medium text-success-text">
          Saved. Every team on this event is now scored this way.
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button disabled={busy || !balanced} onClick={() => void save()}>
          {busy && <Spinner />}
          Save scoring
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => void save(true)}>
          Reset to the default
        </Button>
      </div>
    </div>
  );
}
