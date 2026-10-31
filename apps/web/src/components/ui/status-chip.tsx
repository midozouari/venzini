import type { PlanStatus } from '@venzini/contracts';
import { cn } from '@/lib/utils';

const LABEL: Record<PlanStatus | 'none', string> = {
  none: 'No plan yet',
  draft: 'Draft plan',
  edited: 'Edited plan',
  partly_decided: 'Partly decided',
  decided: 'Plan decided',
};

/** Plan status chip of the top bar (SDD 5.12.1); navy and neutral only, never risk colors. */
export function PlanStatusChip({ status }: { status: PlanStatus | null }) {
  const key = status ?? 'none';
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-full px-3 text-caption font-semibold',
        key === 'decided' && 'bg-navy-900 text-panel',
        key === 'partly_decided' && 'border border-navy-900 text-ink',
        (key === 'draft' || key === 'edited') && 'bg-navy-tint-strong text-ink',
        key === 'none' && 'border border-dashed border-line-strong/60 text-muted',
      )}
    >
      {LABEL[key]}
    </span>
  );
}
