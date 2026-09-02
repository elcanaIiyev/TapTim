import { cn } from '../../lib/cn';
import { MAX_TEAM_ROLES, ROLE_GROUPS } from '../../lib/types';
import { Chip } from '../ui/Chip';

/**
 * The positions someone can take on a team.
 *
 * Grouped rather than listed flat. Twenty roles in one wall reads as a form to
 * get through; three short groups reads as a question with an answer, and the
 * grouping carries the point the list is trying to make — that "Presenter" is
 * as real a position as "Backend Developer", not an afterthought at the end of
 * an engineering list.
 *
 * The cap is enforced here as well as by the API. Hitting it disables the
 * unpicked chips instead of rejecting the click silently, so the limit is
 * visible before it is hit rather than explained afterwards in an error.
 */
export function RolePicker({
  selected,
  onChange,
  error,
}: {
  selected: readonly string[];
  onChange: (next: string[]) => void;
  error?: string;
}) {
  const atLimit = selected.length >= MAX_TEAM_ROLES;

  const toggle = (role: string) => {
    if (selected.includes(role)) {
      onChange(selected.filter((entry) => entry !== role));
      return;
    }
    if (atLimit) return;
    onChange([...selected, role]);
  };

  return (
    <fieldset className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <legend className="type-label text-ink-700 dark:text-ink-300">
          What can you cover on a team?
        </legend>
        <span
          className={cn(
            'readout text-xs tabular-nums',
            atLimit ? 'text-fern-700 dark:text-fern-400' : 'text-ink-500 dark:text-ink-400',
          )}
        >
          {selected.length}/{MAX_TEAM_ROLES}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-ink-600 dark:text-ink-400">
        Pick everything you would genuinely take on — most people cover two or three. These are
        positions for the weekend, not job titles, so “Presenter” counts as much as “Backend
        Developer”.
      </p>

      {ROLE_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="type-label mb-2 text-[0.7rem] text-ink-500 dark:text-ink-400">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.roles.map((role) => {
              const isSelected = selected.includes(role);
              return (
                <Chip
                  key={role}
                  label={role}
                  selected={isSelected}
                  // Only unpicked chips lock at the limit — you can always
                  // deselect your way back out.
                  disabled={!isSelected && atLimit}
                  onToggle={() => toggle(role)}
                />
              );
            })}
          </div>
        </div>
      ))}

      {error && (
        <p role="alert" className="text-xs font-medium text-signal-bad">
          {error}
        </p>
      )}
    </fieldset>
  );
}
