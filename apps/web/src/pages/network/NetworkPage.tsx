// UI-02 Network overview (UC-03, FR-14 to FR-16): the map is the base canvas; KPI cards, the
// risk panel and the legend float above it. One main action: plan the day's deliveries.
import * as Collapsible from '@radix-ui/react-collapsible';
import { formatMessage } from '@venzini/contracts';
import type { Map as LeafletMap } from 'leaflet';
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  MapPinOff,
  Minus,
  Plus,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { useNetwork, usePlanOfDay } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Panel, PanelLabel } from '@/components/ui/panel';
import { PlanStatusChip } from '@/components/ui/status-chip';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { NetworkMap } from '@/features/network/NetworkMap';
import { RiskList } from '@/features/network/RiskPanel';
import { StationDetails } from '@/features/network/StationDetails';
import { formatDay, formatLitres } from '@/lib/format';
import { useDayStore } from '@/stores/day';

const FUEL: Record<string, string> = { P95: 'Petrol 95', DIESEL: 'Diesel' };

export function NetworkPage() {
  const day = useDayStore((s) => s.day);
  const network = useNetwork(day);
  const plan = usePlanOfDay(day);
  const [selected, setSelected] = useState<string | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const onTilesFailed = useCallback(() => setTilesFailed(true), []);

  const data = network.data;
  const station = data?.stations.find((s) => s.station_id === selected) ?? null;

  return (
    <div className="absolute inset-0">
      {/* Layer 1: the map, full bleed, in its own stacking context below the panels. */}
      <div className="absolute inset-0 isolate z-0">
        {data ? (
          <NetworkMap
            network={data}
            selected={selected}
            onSelect={setSelected}
            onTilesFailed={onTilesFailed}
            onReady={setMap}
          />
        ) : (
          <div className="h-full w-full bg-canvas" />
        )}
      </div>

      {/* Layer 2: floating panels. */}
      <section
        aria-label="Key figures"
        className="absolute left-[var(--vz-safe-left)] right-[412px] top-[var(--vz-safe-top)] z-20 grid grid-cols-4 gap-3"
      >
        {data ? (
          <>
            <Panel className="p-5 animate-in fade-in-0 slide-in-from-top-1 duration-300">
              <PanelLabel>Stations at high risk</PanelLabel>
              <p className="mt-1 text-kpi text-ink">{data.kpis.high_risk_stations}</p>
              <p className="text-caption text-muted">of {data.stations.length} stations</p>
            </Panel>
            <Panel className="p-5 animate-in fade-in-0 slide-in-from-top-1 duration-300 [animation-delay:40ms]">
              <PanelLabel>Tankers available</PanelLabel>
              <p className="mt-1 text-kpi text-ink">
                {data.kpis.tankers_available}
                <span className="text-section font-normal text-muted">
                  {' '}
                  of {data.kpis.tankers_total}
                </span>
              </p>
              <p className="text-caption text-muted">for {formatDay(day)}</p>
            </Panel>
            <Panel className="p-5 animate-in fade-in-0 slide-in-from-top-1 duration-300 [animation-delay:80ms]">
              <PanelLabel>Warehouse stock</PanelLabel>
              {data.kpis.warehouse_stock.length === 0 ? (
                <p className="mt-2 text-body text-muted">No resources uploaded for this day.</p>
              ) : (
                <Collapsible.Root>
                  <p className="mt-1 text-kpi text-ink">
                    {data.warehouses.length}
                    <span className="text-body font-normal text-muted"> warehouses</span>
                  </p>
                  <Collapsible.Trigger className="group mt-1 inline-flex items-center gap-1 rounded-control text-caption font-medium text-ink hover:underline">
                    Show stock
                    <ChevronDown
                      aria-hidden
                      className="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
                    />
                  </Collapsible.Trigger>
                  <Collapsible.Content className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200">
                    <dl className="mt-3 flex flex-col gap-2">
                      {data.warehouses.map((w) => (
                        <div key={w.warehouse_id}>
                          <dt className="text-caption font-semibold text-ink">{w.name}</dt>
                          {data.kpis.warehouse_stock
                            .filter((s) => s.warehouse_id === w.warehouse_id)
                            .map((s) => (
                              <dd
                                key={s.fuel_type_id}
                                className="flex justify-between text-caption text-muted"
                              >
                                <span>{FUEL[s.fuel_type_id] ?? s.fuel_type_id}</span>
                                <span className="text-ink">{formatLitres(s.stock_l)}</span>
                              </dd>
                            ))}
                        </div>
                      ))}
                    </dl>
                  </Collapsible.Content>
                </Collapsible.Root>
              )}
            </Panel>
            <Panel className="p-5 animate-in fade-in-0 slide-in-from-top-1 duration-300 [animation-delay:120ms]">
              <PanelLabel>Plan for {formatDay(day)}</PanelLabel>
              <div className="mt-2">
                <PlanStatusChip status={plan.data?.plan.status ?? data.kpis.plan_status} />
              </div>
              <Button asChild size="sm" className="mt-4 w-full">
                <Link to={`/planner?day=${day}`}>
                  Plan deliveries <ArrowRight aria-hidden />
                </Link>
              </Button>
            </Panel>
          </>
        ) : network.isError ? null : (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-panel" />)
        )}
      </section>

      <Panel className="absolute bottom-4 right-4 top-[var(--vz-safe-top)] z-20 w-[380px] overflow-hidden animate-in fade-in-0 slide-in-from-right-2 duration-300">
        {network.isError ? (
          <EmptyState
            icon={CircleAlert}
            title="The network could not be loaded"
            action={<Button onClick={() => network.refetch()}>Try again</Button>}
          >
            {network.error.message}
          </EmptyState>
        ) : !data ? (
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : station ? (
          <StationDetails station={station} network={data} day={day} onClose={close} />
        ) : (
          <RiskList network={data} onSelect={setSelected} />
        )}
      </Panel>

      {data ? (
        <div className="absolute bottom-4 left-[var(--vz-safe-left)] z-20 flex items-end gap-3">
          <Panel
            className="flex items-center gap-5 px-5 py-3 text-caption text-ink"
            aria-label="Map legend"
          >
            <span className="flex items-center gap-2">
              <span className="vz-legend-dot vz-marker--high">
                <TriangleAlert aria-hidden className="size-3" />
              </span>
              High risk
            </span>
            <span className="flex items-center gap-2">
              <span className="vz-legend-dot vz-marker--medium">
                <CircleAlert aria-hidden className="size-3" />
              </span>
              Medium
            </span>
            <span className="flex items-center gap-2">
              <span className="vz-legend-dot vz-marker--low">
                <Check aria-hidden className="size-3" />
              </span>
              Low
            </span>
            <span className="flex items-center gap-2">
              <span className="vz-legend-square" />
              Warehouse
            </span>
            <span className="ml-1 flex gap-1 border-l border-line pl-4">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Zoom in"
                onClick={() => map?.zoomIn()}
              >
                <Plus />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Zoom out"
                onClick={() => map?.zoomOut()}
              >
                <Minus />
              </Button>
            </span>
          </Panel>
          {tilesFailed ? (
            <Panel
              role="status"
              className="flex items-center gap-2 px-4 py-3 text-caption text-ink animate-in fade-in-0 duration-200"
            >
              <MapPinOff aria-hidden className="size-4" />
              {formatMessage('ERR-SYS-03')}
            </Panel>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
