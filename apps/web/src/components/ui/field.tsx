import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Text field with its label and its error right under it (SDD 5.12.5, SRS 14.3). */
export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    error?: string;
    trailing?: ReactNode;
  }
>(function TextField({ label, error, trailing, id, className, ...props }, ref) {
  const inputId = id ?? props.name;
  const errorId = `${inputId}-error`;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-caption font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-12 w-full rounded-control border bg-panel px-4 text-body text-ink placeholder:text-muted/70',
            'transition-[border-color,box-shadow] duration-150 ease-vz',
            'focus:border-navy-900 focus:shadow-[0_0_0_4px_var(--vz-navy-tint-strong)] focus:outline-none',
            error ? 'border-risk-high' : 'border-line-strong',
            trailing ? 'pr-12' : '',
          )}
          {...props}
        />
        {trailing ? (
          <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-caption font-medium text-risk-high">
          {error}
        </p>
      ) : null}
    </div>
  );
});
