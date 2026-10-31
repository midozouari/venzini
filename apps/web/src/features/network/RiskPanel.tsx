// "Stations at highest risk" (UI-02, FR-15): the accessible alternative to the map (SDD 5.12.6).
// Essentials first; medium, low and no-data stations open on demand.
import * as Collapsible from '@radix-ui/react-collapsible';
import type { Network, RiskLevel } from '@venzini/contracts';
import { ChevronDown, CircleCheck, MapPinOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { RiskBadge } from '@/components/ui/risk-badge';
import { EmptyState } from '@/components/ui/states';
import { formatHours } from '@/lib/format';
import { cn } from '@/lib/utils';

type Station = Network['stations'][number];

const FUEL: Record<string, string> = { P95: 'Petrol 95', DIESEL: 'Diesel' };

function StationRow({
  station,
  onSelect,
  children,
}: {
  station: Station;
  onSelect: (id: string) => void;
  children?: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(station.station_id)}
        className="group w-full rounded-control px-3 py-3 text-left transition-[background-color,transform] duration-150 ease-vz hover:bg-navy-tint active:scale-[0.99]"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-body font-semibold text-ink">
            {station.name} <span className="font-normal text-muted">· {station.station_id}</span>
          </span>
          {station.risk_level ? <RiskBadge level={station.risk_level} /> : null}
        </div>
        {children}
      </button>
    </li>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <Collapsible.Root className="border-t border-line pt-2">
      <Collapsible.Trigger className="group flex w-full items-center justify-between rounded-control px-3 py-2.5 text-body text-ink transition-colors duration-150 hover:bg-navy-tint">
        <span>
          {title} <span className="text-muted">· {count}</span>
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 text-muted transition-transform duration-200 ease-vz group-data-[state=open]:rotate-180"
        />
      </Collapsible.Trigger>
      <Collapsible.Content className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 data-[state=open]:duration-200">
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export function RiskList({
  network,
  onSelect,
}: {
  network: Network;
  onSelect: (id: string) => void;
}) {
  const byLevel = (level: RiskLevel) =>
    network.stations.filter((s) => s.data_available && s.risk_level === level);
  const noData = network.stations.filter((s) => !s.data_available);

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pb-4 pt-6">
        <h2 className="text-section text-ink">Stations at highest risk</h2>
        <p className="mt-1 text-caption text-muted">
          High-risk fuel stocks, shortest time to stockout first.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {network.alerts.length === 0 ? (
          <EmptyState icon={CircleCheck} title="No stations at high risk" className="py-8">
            Every station has more than 24 hours of fuel.
          </EmptyState>
        ) : (
          <ol aria-label="Stockout alerts" className="mb-3 flex flex-col gap-1">
            {network.alerts.map((a) => {
              const station = network.stations.find((s) => s.station_id === a.station_id)!;
              return (
                <StationRow
                  key={`${a.station_id}-${a.fuel_type_id}`}
                  station={station}
                  onSelect={onSelect}
                >
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-section font-semibold text-ink">
                      {formatHours(a.hours_to_stockout)}
                    </span>
                    <span className="text-caption text-muted">
                      of {FUEL[a.fuel_type_id] ?? a.fuel_type_id} left
                    </span>
                  </div>
                  <p className="mt-1 text-caption text-muted">{a.reason}</p>
                </StationRow>
              );
            })}
          </ol>
        )}
        <Group title="Medium risk" count={byLevel('medium').length}>
          <ul className="flex flex-col gap-1 pb-2">
            {byLevel('medium').map((s) => (
              <StationRow key={s.station_id} station={s} onSelect={onSelect} />
            ))}
          </ul>
        </Group>
        <Group title="Low risk" count={byLevel('low').length}>
          <ul className="flex flex-col gap-1 pb-2">
            {byLevel('low').map((s) => (
              <StationRow key={s.station_id} station={s} onSelect={onSelect} />
            ))}
          </ul>
        </Group>
        {noData.length > 0 ? (
          <Group title="Data unavailable" count={noData.length}>
            <ul className="flex flex-col gap-1 pb-2">
              {noData.map((s) => {
                const reason = network.data_unavailable.find(
                  (d) => d.station_id === s.station_id,
                )?.reason;
                return (
                  <StationRow key={s.station_id} station={s} onSelect={onSelect}>
                    <p className={cn('mt-1 flex items-center gap-1.5 text-caption text-muted')}>
                      <MapPinOff aria-hidden className="size-3.5" />
                      Data unavailable for {s.station_id}
                      {reason ? `: ${reason.toLowerCase()}` : ''}.
                    </p>
                  </StationRow>
                );
              })}
            </ul>
          </Group>
        ) : null}
      </div>
    </div>
  );
}
