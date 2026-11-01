// UI-02 Network overview (UC-03, FR-14 to FR-16). Three columns on the navy canvas: navigation
// (shell), then the map card above the KPI row, then the full-height risk panel. Nothing overlaps
// the map except its own legend and zoom controls. One main action: plan the day's deliveries.
import { formatMessage } from '@venzini/contracts';
import type { Map as LeafletMap } from 'leaflet';
import {
  Check,
  CircleAlert,
  CircleQuestionMark,
  MapPinOff,
  Minus,
  Plus,
  TriangleAlert,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useState } from 'react';
import { Link } from 'react-router';
import { useNetwork, usePlanOfDay, useReference } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Panel, PanelLabel } from '@/components/ui/panel';
import { PlanStatusChip } from '@/components/ui/status-chip';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { RiskList } from '@/features/network/RiskPanel';
import { StationDetails } from '@/features/network/StationDetails';
import { formatDay, formatLitres } from '@/lib/format';
import { useDayStore } from '@/stores/day';

// The map library loads beside the page, not in it (NFR-02): the card shows its cream base meanwhile.
const NetworkMap = lazy(() =>
  import('@/features/network/NetworkMap').then((m) => ({ default: m.NetworkMap })),
);

export function NetworkPage() {
  const day = useDayStore((s) => s.day);
  const network = useNetwork(day);
  const plan = usePlanOfDay(day);
  const fuels = [...(useReference().data?.fuel_types ?? [])].sort(
    (a, b) => a.display_order - b.display_order,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const close = useCallback(() => setSelected(null), [setSelected]);
  const onTilesFailed = useCallback(() => setTilesFailed(true), [setTilesFailed]);

  const data = network.data;
  const station = data?.stations.find((s) => s.station_id === selected) ?? null;

  return (
    <div className="absolute inset-0 grid grid-cols-[minmax(0,1fr)_380px] gap-[var(--vz-gap)] pb-[var(--vz-gap)] pl-[var(--vz-safe-left)] pr-[var(--vz-gap)] pt-[var(--vz-safe-top)]">
      {/* Middle column: the map card on top (the main element), the KPI row below it. */}
      <div className="flex min-h-0 flex-col gap-[var(--vz-gap)]">
        <Panel
          role="region"
          aria-label="Network map"
          className="relative isolate min-h-0 flex-1 overflow-hidden animate-in fade-in-0 duration-300"
        >
          {data ? (
            <Suspense fallback={<div className="h-full w-full bg-cream" />}>
              <NetworkMap
                network={data}
                selected={selected}
                onSelect={setSelected}
                onTilesFailed={onTilesFailed}
                onReady={setMap}
              />
            </Suspense>
          ) : (
            <div className="h-full w-full bg-cream" />
          )}
          {data ? (
            <div className="absolute bottom-4 left-4 z-[1000] flex items-end gap-3">
              <div
                aria-label="Map legend"
                className="flex items-center gap-5 rounded-control border border-line bg-panel px-4 py-2 text-caption text-ink shadow-panel"
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
                  <span className="vz-legend-dot vz-marker--nodata">
                    <CircleQuestionMark aria-hidden className="size-3" />
                  </span>
                  No data
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
              </div>
              {tilesFailed ? (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-control border border-line bg-panel px-4 py-2.5 text-caption text-ink shadow-panel animate-in fade-in-0 duration-200"
                >
                  <MapPinOff aria-hidden className="size-4" />
                  {formatMessage('ERR-SYS-03')}
                </div>
              ) : null}
            </div>
          ) : null}
        </Panel>

        <section aria-label="Key figures" className="grid shrink-0 grid-cols-4 gap-[var(--vz-gap)]">
          {data ? (
            <>
              <Panel className="p-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
                <PanelLabel>High-risk stations</PanelLabel>
                <p className="mt-1 text-kpi text-ink">{data.kpis.high_risk_stations}</p>
                <p className="text-caption text-muted">of {data.stations.length} stations</p>
              </Panel>
              <Panel className="p-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300 [animation-delay:40ms]">
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
              <Panel className="p-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300 [animation-delay:80ms]">
                <PanelLabel>Warehouse stock</PanelLabel>
                {data.kpis.warehouse_stock.length === 0 ? (
                  <p className="mt-2 text-body text-muted">No resources uploaded for this day.</p>
                ) : (
                  <>
                    <p className="mt-1 text-kpi text-ink">{data.warehouses.length}</p>
                    <p className="text-caption text-muted">warehouses</p>
                    <Dialog>
                      <DialogTrigger className="mt-1 rounded-control text-caption font-medium text-ink underline-offset-2 hover:underline">
                        Show stock
                      </DialogTrigger>
                      <DialogContent className="w-[520px]">
                        <DialogTitle>Warehouse stock</DialogTitle>
                        <DialogDescription>Stock uploaded for {formatDay(day)}.</DialogDescription>
                        <table className="mt-6 w-full text-body">
                          <thead>
                            <tr className="border-b border-line text-left text-caption text-muted">
                              <th scope="col" className="pb-2 font-medium">
                                Warehouse
                              </th>
                              {fuels.map((f) => (
                                <th
                                  key={f.fuel_type_id}
                                  scope="col"
                                  className="pb-2 text-right font-medium"
                                >
                                  {f.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {data.warehouses.map((w) => (
                              <tr
                                key={w.warehouse_id}
                                className="border-b border-line last:border-0"
                              >
                                <th scope="row" className="py-3 text-left font-semibold text-ink">
                                  {w.name}
                                </th>
                                {fuels.map(({ fuel_type_id: f }) => {
                                  const row = data.kpis.warehouse_stock.find(
                                    (x) =>
                                      x.warehouse_id === w.warehouse_id && x.fuel_type_id === f,
                                  );
                                  return (
                                    <td key={f} className="py-3 text-right text-ink">
                                      {row ? formatLitres(row.stock_l) : '–'}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <DialogActions>
                          <DialogClose asChild>
                            <Button variant="secondary">Close</Button>
                          </DialogClose>
                        </DialogActions>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </Panel>
              <Panel className="p-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300 [animation-delay:120ms]">
                <PanelLabel>Plan status</PanelLabel>
                <div className="mt-2">
                  <PlanStatusChip status={plan.data?.plan.status ?? data.kpis.plan_status} />
                </div>
                <Button asChild size="sm" className="mt-4 w-full">
                  <Link to={`/planner?day=${day}`}>Plan deliveries</Link>
                </Button>
              </Panel>
            </>
          ) : network.isError ? null : (
            [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-panel" />)
          )}
        </section>
      </div>

      {/* Right column: the risk panel, full height. */}
      <Panel className="min-h-0 overflow-hidden animate-in fade-in-0 slide-in-from-right-2 duration-300">
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
    </div>
  );
}
