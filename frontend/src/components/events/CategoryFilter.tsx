import { cn } from '../../lib/cn';
import type { CategoryCount } from '../../lib/types';

interface CategoryFilterProps {
  categories: CategoryCount[];
  active: string;
  onChange: (category: string) => void;
  total?: number;
}

export function CategoryFilter({ categories, active, onChange, total }: CategoryFilterProps) {
  const options = [{ name: 'All', count: total ?? 0 }, ...categories];

  return (
    <div
      role="tablist"
      aria-label="Event categories"
      className="flex flex-wrap justify-center gap-2"
    >
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
              'cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200',
              isActive
                ? 'border-brand-500 bg-brand-600 text-white shadow-md shadow-brand-600/25'
                : 'border-ink-200 bg-white text-ink-600 hover:border-brand-400 hover:text-brand-600 ' +
                    'dark:border-ink-800 dark:bg-ink-900/60 dark:text-ink-300 dark:hover:border-brand-500 dark:hover:text-brand-300',
            )}
          >
            {option.name}
            {option.count > 0 && (
              <span className={cn('ml-2 text-xs', isActive ? 'text-brand-100' : 'text-ink-400')}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
