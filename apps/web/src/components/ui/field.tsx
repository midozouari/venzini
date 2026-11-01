import { ChevronDown } from 'lucide-react';
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

const fieldClass = (error?: string) =>
  cn(
    'h-12 w-full rounded-control border bg-panel px-4 text-body text-ink placeholder:text-muted/70',
    'transition-[border-color,box-shadow] duration-150 ease-vz',
    'focus:border-navy-900 focus:shadow-[0_0_0_4px_var(--vz-navy-tint-strong)] focus:outline-none',
    'disabled:cursor-not-allowed disabled:bg-cream disabled:text-muted',
    error ? 'border-risk-high' : 'border-line-strong',
  );

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} className="mt-1.5 text-caption font-medium text-risk-high">
      {error}
    </p>
  ) : null;
}

/** A form select with its visible label and its error under it (forms in dialogs). */
export function SelectField({
  label,
  error,
  id,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  const selectId = id ?? props.name;
  const errorId = `${selectId}-error`;
  return (
    <div className={className}>
      <label htmlFor={selectId} className="mb-1.5 block text-caption font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(fieldClass(error), 'appearance-none pr-10')}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
      </div>
      <FieldError id={errorId} error={error} />
    </div>
  );
}

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
          className={cn(fieldClass(error), trailing ? 'pr-12' : '')}
          {...props}
        />
        {trailing ? (
          <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>
        ) : null}
      </div>
      <FieldError id={errorId} error={error} />
    </div>
  );
});
