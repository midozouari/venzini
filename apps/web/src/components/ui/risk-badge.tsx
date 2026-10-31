import type { RiskLevel } from '@venzini/contracts';
import { Check, CircleAlert, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

// Risk is never color alone: icon + word + color (BR-09, FR-48, NFR-10; Figure 42).
export const RISK_META = {
  high: { word: 'High', Icon: TriangleAlert, chip: 'bg-risk-high-tint text-risk-high' },
  medium: { word: 'Medium', Icon: CircleAlert, chip: 'bg-risk-medium-tint text-risk-medium-ink' },
  low: { word: 'Low', Icon: Check, chip: 'bg-risk-low-tint text-risk-low' },
} as const;

export function RiskBadge({
  level,
  className,
  suffix,
}: {
  level: RiskLevel;
  className?: string;
  suffix?: string;
}) {
  const { word, Icon, chip } = RISK_META[level];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold',
        chip,
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" strokeWidth={2.5} />
      {word}
      {suffix ? <span className="font-medium"> · {suffix}</span> : null}
    </span>
  );
}
