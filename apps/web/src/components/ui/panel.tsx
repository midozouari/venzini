import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** A floating panel: solid warm off-white, thin border, soft shadow, rounded (layer 2). */
export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-panel border border-line bg-panel shadow-float', className)}
      {...props}
    />
  );
}

/** Small uppercase-free section label inside a panel. */
export function PanelLabel({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-caption font-medium text-muted', className)} {...props} />;
}
