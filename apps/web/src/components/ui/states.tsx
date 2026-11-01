import type { LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Loading placeholder, shown only after 300 ms so fast answers never flicker (SDD 5.12.5). */
export function Skeleton({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      aria-hidden
      className={cn(
        'rounded-control bg-navy-tint transition-opacity duration-300 ease-vz',
        visible ? 'animate-pulse opacity-100' : 'opacity-0',
        className,
      )}
    />
  );
}

/** Empty state: a plain sentence plus the next action (SDD 5.12.5). */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-8 py-10 text-center', className)}>
      <span className="mb-5 flex size-12 items-center justify-center rounded-full bg-navy-tint text-ink">
        <Icon aria-hidden className="size-5" />
      </span>
      <h2 className="text-section text-ink">{title}</h2>
      {children ? <div className="mt-2 max-w-sm text-body text-muted">{children}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/** While a page's code loads (route-level code splitting): a quiet panel-shaped placeholder. */
export function PageLoading() {
  return (
    <div className="absolute inset-0 pb-[var(--vz-gap)] pl-[var(--vz-safe-left)] pr-[var(--vz-gap)] pt-[var(--vz-safe-top)]">
      <Skeleton className="h-full rounded-panel" />
    </div>
  );
}
