import { ChevronDown } from 'lucide-react';
import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * A styled native select: fully keyboard accessible, and typing a few letters jumps to the
 * matching option (search by name or ID).
 */
export function Select({
  label,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className={cn('relative inline-flex items-center', className)}>
      <span className="sr-only">{label}</span>
      <select
        className="h-10 w-full appearance-none rounded-full border border-line-strong bg-panel pl-4 pr-10 text-body font-medium text-ink transition-[border-color,box-shadow] duration-150 ease-vz hover:border-navy-900 focus:border-navy-900 focus:shadow-[0_0_0_4px_var(--vz-navy-tint-strong)] focus:outline-none"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3.5 size-4 text-muted"
      />
    </label>
  );
}
