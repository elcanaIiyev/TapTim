import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, profileApi } from '../../lib/api';
import { cn } from '../../lib/cn';
import type { Experience, ExperienceKind } from '../../lib/types';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { Spinner } from '../ui/Spinner';

const KIND_LABELS: Record<ExperienceKind, string> = {
  work: 'Job',
  internship: 'Internship',
  project: 'Project',
  hackathon: 'Hackathon',
  education: 'Study',
  volunteering: 'Volunteering',
};

const KIND_TONE: Record<ExperienceKind, string> = {
  work: 'border-iris-300 text-iris-700 dark:border-iris-500/40 dark:text-iris-300',
  internship: 'border-iris-300 text-iris-700 dark:border-iris-500/40 dark:text-iris-300',
  project: 'border-fern-300 text-fern-700 dark:border-fern-500/40 dark:text-fern-300',
  hackathon: 'border-fern-300 text-fern-700 dark:border-fern-500/40 dark:text-fern-300',
  education: 'border-ink-300 text-ink-700 dark:border-ink-600 dark:text-ink-300',
  volunteering: 'border-ink-300 text-ink-700 dark:border-ink-600 dark:text-ink-300',
};

/** "Feb 2024 — now", from `YYYY-MM-DD` day strings. */
function formatRange(entry: Experience): string {
  const month = (value: string | null) =>
    value
      ? new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : null;

  const start = month(entry.startDate);
  const end = entry.isCurrent ? 'now' : month(entry.endDate);

  if (!start && !end) return 'No dates';
  if (start && end) return `${start} — ${end}`;
  return start ?? (end as string);
}

const EMPTY = {
  kind: 'work' as ExperienceKind,
  title: '',
  organisation: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
  description: '',
};

export function ExperienceEditor({
  entries,
  kinds,
  onChange,
}: {
  entries: Experience[];
  kinds: string[];
  onChange: (next: Experience[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      const created = await profileApi.addExperience({
        kind: draft.kind,
        title: draft.title.trim(),
        organisation: draft.organisation.trim() || null,
        startDate: draft.startDate || null,
        // An ongoing entry must not carry an end date; the server rejects the
        // pair, so it is cleared here rather than surfacing that as an error.
        endDate: draft.isCurrent ? null : draft.endDate || null,
        isCurrent: draft.isCurrent,
        description: draft.description.trim() || null,
      });
      onChange([created, ...entries]);
      setDraft(EMPTY);
      setAdding(false);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(Object.fromEntries(caught.issues.map((i) => [i.field, i.message])));
        setError(caught.issues.length ? 'Check the highlighted fields.' : caught.message);
      } else {
        setError('Could not save that entry.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const previous = entries;
    // Removed optimistically; a failure puts it back rather than leaving the
    // list disagreeing with the server.
    onChange(entries.filter((entry) => entry.id !== id));
    try {
      await profileApi.removeExperience(id);
    } catch {
      onChange(previous);
      setError('Could not remove that entry.');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="type-label text-ink-700 dark:text-ink-300">Experience</p>
        <p className="readout text-xs text-ink-500 dark:text-ink-400">{entries.length} added</p>
      </div>
      <p className="mt-1.5 text-xs text-ink-600 dark:text-ink-400">
        Jobs, projects, past hackathons, study — whatever shows what you've built.
      </p>

      {entries.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-4 rounded-[var(--radius-soft-sm)] border border-ink-200 bg-white px-4 py-3 dark:border-ink-700 dark:bg-ink-900"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'type-label rounded-full border px-2 py-0.5',
                      KIND_TONE[entry.kind],
                    )}
                  >
                    {KIND_LABELS[entry.kind]}
                  </span>
                  <p className="font-semibold text-ink-900 dark:text-white">{entry.title}</p>
                </div>
                <p className="mt-1 text-xs text-ink-600 dark:text-ink-400">
                  {entry.organisation ? `${entry.organisation} · ` : ''}
                  {formatRange(entry)}
                </p>
                {entry.description && (
                  <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
                    {entry.description}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => void remove(entry.id)}
                aria-label={`Remove ${entry.title}`}
                className="shrink-0 cursor-pointer rounded-full border border-ink-200 px-2 py-1 text-xs text-ink-500 transition-colors hover:border-signal-bad hover:text-signal-bad dark:border-ink-700 dark:text-ink-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs font-medium text-signal-bad">
          {error}
        </p>
      )}

      {adding ? (
        <form
          onSubmit={submit}
          noValidate
          className="mt-4 space-y-4 rounded-[var(--radius-soft)] border border-iris-300 bg-iris-50/60 p-4 dark:border-iris-500/30 dark:bg-ink-800/50"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Type"
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as ExperienceKind })}
            >
              {kinds.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABELS[kind as ExperienceKind] ?? kind}
                </option>
              ))}
            </Select>
            <Input
              label="Title"
              placeholder="Frontend Engineer"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              error={fieldErrors.title}
              required
            />
          </div>

          <Input
            label="Organisation"
            placeholder="Acme, or the hackathon's name"
            value={draft.organisation}
            onChange={(e) => setDraft({ ...draft, organisation: e.target.value })}
            hint="Optional"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Started"
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              error={fieldErrors.startDate}
            />
            <Input
              label="Ended"
              type="date"
              value={draft.endDate}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              error={fieldErrors.endDate}
              disabled={draft.isCurrent}
              hint={draft.isCurrent ? 'Ongoing' : 'Leave blank if ongoing'}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-700 dark:text-ink-300">
            <input
              type="checkbox"
              checked={draft.isCurrent}
              onChange={(e) => setDraft({ ...draft, isCurrent: e.target.checked, endDate: '' })}
              className="h-4 w-4 cursor-pointer accent-fern-600"
            />
            I'm still doing this
          </label>

          <Input
            label="What did you do?"
            placeholder="Shipped the booking flow end to end."
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            hint="Optional. One line is plenty."
          />

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy || draft.title.trim().length < 2}>
              {busy && <Spinner />}
              Add entry
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setDraft(EMPTY);
                setFieldErrors({});
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="outline" className="mt-4" onClick={() => setAdding(true)}>
          + Add experience
        </Button>
      )}
    </div>
  );
}
