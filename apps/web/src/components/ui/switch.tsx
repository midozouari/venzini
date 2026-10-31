import { cn } from '@/lib/utils';

/** An on/off switch (availability). Keyboard: Tab, then Space or Enter (UI-04 accessibility). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 ease-vz',
        'disabled:cursor-not-allowed disabled:opacity-45',
        checked ? 'border-navy-900 bg-navy-900' : 'border-line-strong bg-cream',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block size-4 rounded-full shadow-panel transition-transform duration-200 ease-vz',
          checked ? 'translate-x-6 bg-panel' : 'translate-x-1 bg-muted',
        )}
      />
    </button>
  );
}
