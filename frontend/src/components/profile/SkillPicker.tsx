import { useMemo, useState } from 'react';
import { cn } from '../../lib/cn';
import { DEFAULT_SKILL_LEVEL, skillLabel } from '../../lib/types';
import type { SkillCatalogue } from '../../lib/types';
import { Chip } from '../ui/Chip';

/**
 * Skill selection, then proficiency.
 *
 * Two stages on purpose. Picking from a list of ~200 and rating each one at the
 * same time is a wall; here you tap what you know from a starter set or a
 * search, and only then does each choice grow a slider. Nothing is rated that
 * has not first been chosen, so the number of sliders is always the number of
 * skills you actually claim.
 */

export function SkillPicker({
  catalogue,
  selected,
  levels,
  onChange,
  suggestedMax,
}: {
  catalogue: SkillCatalogue;
  selected: string[];
  levels: Record<string, number>;
  onChange: (skills: string[], levels: Record<string, number>) => void;
  /** A nudge shown during onboarding, not a hard cap. */
  suggestedMax?: number;
}) {
  const [query, setQuery] = useState('');
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const atMax = selected.length >= catalogue.max;

  /**
   * Filtered locally. The whole catalogue is a few kB and already in memory, so
   * searching it is instant and works offline — a search endpoint would add a
   * round trip per keystroke to answer a question the client can answer itself.
   */
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return catalogue.all
      .filter((skill) => skill.toLowerCase().includes(needle))
      // Prefix matches first: typing "re" should surface React before
      // "Reverse engineering" or "Prompt engineering".
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(needle) ? 0 : 1;
        const bStarts = b.toLowerCase().startsWith(needle) ? 0 : 1;
        return aStarts - bStarts || a.localeCompare(b);
      })
      .slice(0, 24);
  }, [query, catalogue.all]);

  const toggle = (skill: string) => {
    if (selected.includes(skill)) {
      const nextLevels = { ...levels };
      delete nextLevels[skill];
      onChange(
        selected.filter((entry) => entry !== skill),
        nextLevels,
      );
      return;
    }
    if (atMax) return;
    // A new skill starts at "Comfortable" — the middle of the scale, so someone
    // who never touches the slider is not claiming to be an expert.
    onChange([...selected, skill], { ...levels, [skill]: DEFAULT_SKILL_LEVEL });
  };

  const setLevel = (skill: string, level: number) => {
    onChange(selected, { ...levels, [skill]: level });
  };

  // The band the API serves wins over the local mirror, so a band renamed
  // server-side shows through without a frontend release.
  const levelLabel = (value: number) =>
    catalogue.levels.find((band) => value >= band.min && value <= band.max)?.label ??
    skillLabel(value);

  const levelBlurb = (value: number) =>
    catalogue.levels.find((band) => value >= band.min && value <= band.max)?.blurb ?? '';

  return (
    <div className="space-y-6">
      {/* -- pick ------------------------------------------------------------ */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="type-label text-ink-700 dark:text-ink-300">Pick your skills</p>
          <p className="readout text-xs text-ink-500 dark:text-ink-400">
            {selected.length} / {catalogue.max}
            {suggestedMax && selected.length < suggestedMax ? ` · ${suggestedMax} is plenty for now` : ''}
          </p>
        </div>

        <label className="sr-only" htmlFor="skill-search">
          Search all skills
        </label>
        <input
          id="skill-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${catalogue.all.length} skills — Python, Docker, Blender…`}
          className={cn(
            'mt-3 w-full rounded-[var(--radius-soft-sm)] border bg-white px-3.5 py-2.5 text-sm',
            'text-ink-900 placeholder:text-ink-400 transition-colors',
            'border-ink-950 hover:border-iris-600',
            'dark:border-ink-700 dark:bg-ink-950 dark:text-white dark:hover:border-iris-500',
          )}
        />

        {query.trim() ? (
          <div className="mt-3">
            {results.length === 0 ? (
              <p className="text-sm text-ink-600 dark:text-ink-400">
                Nothing matches “{query}”. Try a shorter word.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {results.map((skill) => (
                  <Chip
                    key={skill}
                    label={skill}
                    selected={selected.includes(skill)}
                    disabled={atMax && !selected.includes(skill)}
                    onToggle={() => toggle(skill)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="mt-3 text-xs text-ink-600 dark:text-ink-400">
              The common ones are below — search above for anything else.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {catalogue.popular.map((skill) => (
                <Chip
                  key={skill}
                  label={skill}
                  selected={selected.includes(skill)}
                  disabled={atMax && !selected.includes(skill)}
                  onToggle={() => toggle(skill)}
                />
              ))}
            </div>

            {/* Browsing by category, for people who would rather scan than type. */}
            <div className="mt-5 flex flex-wrap gap-2">
              {catalogue.categories.map((category) => {
                const open = openCategory === category.name;
                return (
                  <button
                    key={category.name}
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenCategory(open ? null : category.name)}
                    className={cn(
                      'type-label cursor-pointer rounded-full border px-3 py-1.5 transition-colors',
                      open
                        ? 'border-iris-600 bg-iris-600 text-white'
                        : 'border-ink-300 text-ink-600 hover:border-iris-500 hover:text-accent-text dark:border-ink-700 dark:text-ink-400',
                    )}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>

            {openCategory && (
              <div className="mt-3 flex flex-wrap gap-2 rounded-[var(--radius-soft)] border border-ink-200 bg-ink-50 p-3 dark:border-ink-700 dark:bg-ink-950/50">
                {catalogue.categories
                  .find((category) => category.name === openCategory)
                  ?.skills.map((skill) => (
                    <Chip
                      key={skill}
                      label={skill}
                      selected={selected.includes(skill)}
                      disabled={atMax && !selected.includes(skill)}
                      onToggle={() => toggle(skill)}
                    />
                  ))}
              </div>
            )}
          </>
        )}

        {atMax && (
          <p className="mt-3 text-xs font-medium text-signal-warn">
            That's the maximum of {catalogue.max}. Unpick one to swap it out.
          </p>
        )}
      </div>

      {/* -- rate ------------------------------------------------------------ */}
      {selected.length > 0 && (
        <div>
          <p className="type-label text-ink-700 dark:text-ink-300">How good are you at each?</p>
          <p className="mt-1.5 text-xs text-ink-600 dark:text-ink-400">
            Be honest — a team needs to know who to ask, not who sounds best.
          </p>

          <div className="mt-4 space-y-4">
            {selected.map((skill) => {
              const level = levels[skill] ?? DEFAULT_SKILL_LEVEL;
              return (
                <div key={skill} className="rounded-[var(--radius-soft-sm)] border border-ink-200 px-4 py-3 dark:border-ink-700">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink-900 dark:text-white">{skill}</span>
                    <span className="flex items-baseline gap-2">
                      <span className="readout text-xs text-success-text">{levelLabel(level)}</span>
                      {/* The number is secondary to the word, and sized to say so. */}
                      <span className="readout text-[0.7rem] tabular-nums text-ink-500 dark:text-ink-400">
                        {level}
                      </span>
                    </span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    // Fives rather than ones: nobody can tell 63 from 64 about
                    // themselves, and a coarse step makes the slider land where
                    // it was aimed instead of one pixel off.
                    step={5}
                    value={level}
                    aria-label={`${skill} proficiency`}
                    aria-valuetext={`${level} out of 100 — ${levelLabel(level)}`}
                    onChange={(event) => setLevel(skill, Number(event.target.value))}
                    className="mt-2.5 w-full cursor-pointer accent-fern-600"
                  />

                  <div className="mt-1 flex justify-between text-[0.7rem] text-ink-500 dark:text-ink-400">
                    <span>{catalogue.levels[0]?.label}</span>
                    <span className="italic">{levelBlurb(level)}</span>
                    <span>{catalogue.levels[catalogue.levels.length - 1]?.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
