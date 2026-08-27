import { cn } from '../../lib/cn';
import type { CategoryCount } from '../../lib/types';

interface CategoryFilterProps {
  categories: CategoryCount[];
  active: string;
  onChange: (category: string) => void;
  total?: number;
}

/**
 * A hard-edged control strip. Filters are left-aligned rather than centred so
 * they read as a toolbar attached to the grid below, not a floating pill row.
 */
export function CategoryFilter({ categories, active, onChange, total }: CategoryFilterProps) {
  const options = [{ name: 'All', count: total ?? 0 }, ...categories];

  return (
    <div role="tablist" aria-label="Event categories" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = option.name === active;
        return (
          <button
            key={option.name}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.name)}
            className={cn(
              'type-label cursor-pointer border-2 px-3 py-2 transition-colors duration-150',
              isActive
                ? 'border-ink-950 bg-flame-600 text-ink-950 dark:border-ink-100'
                : 'border-ink-950 bg-white text-ink-700 hover:bg-ink-950 hover:text-ink-50 ' +
                    'dark:border-ink-400 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-100 dark:hover:text-ink-950',
            )}
          >
            {option.name}
            {option.count > 0 && (
              <span className={cn('ml-2 font-bold', isActive ? 'opacity-60' : 'opacity-50')}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
