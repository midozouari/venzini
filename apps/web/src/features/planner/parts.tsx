// Small pieces shared by the planner (UI-05) and approvals (UI-06).
import { fillTemplate, type PlanView, type Route, type Stop } from '@venzini/contracts';
import { CircleSlash } from 'lucide-react';
import { useReference } from '@/api/hooks';
import { RiskBadge } from '@/components/ui/risk-badge';
import { formatLitres } from '@/lib/format';
import { cn } from '@/lib/utils';
import { routeClass } from './PlanMap';

/** The route's line color, as a short bar; dashed for a second trip (FR-53). */
export function RouteSwatch({ route, className }: { route: Route; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-1.5 w-6 shrink-0 rounded-full',
        routeClass(route),
        route.trip_no === 2
          ? 'bg-[repeating-linear-gradient(90deg,var(--vz-route)_0_6px,transparent_6px_9px)]'
          : 'vz-swatch',
        className,
      )}
    />
  );
}

export function useFuelName() {
  const fuels = useReference().data?.fuel_types ?? [];
  return (id: string) => fuels.find((f) => f.fuel_type_id === id)?.name ?? id;
}

/** "Petrol 95 6,000 L · Diesel 5,000 L" */
export function LitresLine({ stop, className }: { stop: Stop; className?: string }) {
  const fuelName = useFuelName();
  return (
    <span className={cn('tabular-nums', className)}>
      {stop.quantities
        .filter((q) => q.final_l > 0)
        .map((q) => `${fuelName(q.fuel_type_id)} ${formatLitres(q.final_l)}`)
        .join(' · ')}
    </span>
  );
}

const DECISION = {
  pending: { label: 'Pending', className: 'border border-dashed border-line-strong/70 text-ink' },
  approved: { label: 'Approved', className: 'bg-navy-900 text-panel' },
  rejected: { label: 'Rejected', className: 'bg-navy-tint-strong text-muted' },
} as const;

/** Decision status of a recommended action; navy and neutral only (never risk colors). */
export function DecisionChip({ status }: { status: Stop['decision_status'] }) {
  const d = DECISION[status];
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-caption font-semibold',
        d.className,
      )}
    >
      {d.label}
    </span>
  );
}

const RANK = { high: 0, medium: 1, low: 2 } as const;

/** One line per unserved station, with its reason in full (FR-38, TPL-UNS-01). */
export function unservedLines(view: PlanView) {
  const seen = new Map<
    string,
    { station_id: string; risk: PlanView['unserved'][number]['risk_level']; reason: string }
  >();
  // One line per station and reason (the list is per fuel): it shows the station's highest risk.
  for (const u of view.unserved) {
    const key = `${u.station_id}|${u.reason}`;
    const line = seen.get(key);
    if (!line) seen.set(key, { station_id: u.station_id, risk: u.risk_level, reason: u.reason });
    else if (RANK[u.risk_level] < RANK[line.risk]) line.risk = u.risk_level;
  }
  return [...seen.values()].map((u) => ({
    ...u,
    sentence: fillTemplate('TPL-UNS-01', { station: u.station_id, reason: u.reason }),
  }));
}

export function UnservedList({
  view,
  selected,
  className,
}: {
  view: PlanView;
  selected?: string | null;
  className?: string;
}) {
  const lines = unservedLines(view);
  if (lines.length === 0) return null;
  return (
    <section aria-label="Not served today" className={className}>
      <h2 className="flex items-center gap-2 text-body font-semibold text-ink">
        <CircleSlash aria-hidden className="size-4" />
        Not served today ({new Set(lines.map((l) => l.station_id)).size})
      </h2>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {lines.map((l) => (
          <li
            key={`${l.station_id}-${l.reason}`}
            className={cn(
              'rounded-control bg-cream px-3 py-2 text-caption text-ink transition-shadow duration-200',
              selected === l.station_id && 'ring-2 ring-navy-900',
            )}
          >
            <p>
              <RiskBadge level={l.risk} className="mr-1.5 py-0 align-[1px]" />
              {l.sentence}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
