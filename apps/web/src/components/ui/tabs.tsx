import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

export interface TabItem {
  label: string;
  to: string;
  /** A small count beside the label (e.g. trips to record). */
  badge?: number;
}

/** Tabs that are addresses (SDD 5.12.3): a calm floating segmented bar. */
export function RouteTabs({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav
      aria-label={label}
      className="inline-flex gap-1 rounded-full border border-line bg-panel p-1 shadow-panel"
    >
      {items.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            cn(
              'inline-flex h-9 items-center gap-2 rounded-full px-4 text-body transition-[background-color,color,transform] duration-150 ease-vz active:scale-[0.98]',
              isActive
                ? 'bg-navy-900 font-semibold text-panel'
                : 'text-muted hover:bg-navy-tint hover:text-ink',
            )
          }
        >
          {t.label}
          {t.badge ? (
            <span
              aria-label={`${t.badge} to record`}
              className="inline-flex min-w-6 items-center justify-center rounded-full bg-cream px-1.5 text-caption font-semibold text-ink"
            >
              {t.badge}
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
}

/** A choice between a few options (fuel, level): radio buttons styled as a segmented bar. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex gap-1 rounded-full bg-cream p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-8 rounded-full px-4 text-body transition-[background-color,color,box-shadow,transform] duration-150 ease-vz active:scale-[0.98]',
              active ? 'bg-panel font-semibold text-ink shadow-panel' : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
