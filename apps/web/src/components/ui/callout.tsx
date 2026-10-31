import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A calm note inside a panel (warnings, locked day, forecast explanations). Never a risk color:
 * the icon and the words carry the meaning. "dashed" marks uncertainty (FR-23, Figure 42).
 */
export function Callout({
  icon: Icon,
  title,
  children,
  tone = 'quiet',
  className,
  role,
}: {
  icon: LucideIcon;
  title?: string;
  children?: ReactNode;
  tone?: 'quiet' | 'strong' | 'dashed';
  className?: string;
  role?: 'status' | 'alert';
}) {
  return (
    <div
      role={role}
      className={cn(
        'flex gap-3 rounded-panel px-4 py-3 text-body text-ink',
        tone === 'quiet' && 'bg-note',
        tone === 'strong' && 'border border-navy-900/30 bg-note-strong',
        tone === 'dashed' && 'border-2 border-dashed border-line-strong/70 bg-cream',
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5', 'text-ink')}>{children}</div> : null}
      </div>
    </div>
  );
}
