// UI-05 Delivery planner (UC-05, UC-06; FR-36 to FR-66, FR-75 to FR-77). Left: route cards and
// stop lists, where every edit happens. Right: the route map card, the centerpiece, with the impact
// of the changes under it. The browser never computes a business value: during an edit it only
// shows the new order and greys the numbers until the server answers (SDD 5.5).
import { formatMessage, type EditRequest, type PlanRisk, type Stop } from '@venzini/contracts';
import type { Map as LeafletMap } from 'leaflet';
import {
  CalendarCheck,
  Check,
  CircleAlert,
  ClipboardList,
  Loader2,
  MapPinOff,
  Minus,
  Plus,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useEditPlan, useGeneratePlan, useNetwork, usePlanOfDay } from '@/api/hooks';
import { ContentArea } from '@/app/Shell';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Panel } from '@/components/ui/panel';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { highlightOf, overloads, previewEdit } from '@/features/planner/edit';
import { MoveDialog, QuantityDialog } from '@/features/planner/EditDialogs';
import { ImpactBar, ResetButton } from '@/features/planner/ImpactBar';
import { RouteSwatch, UnservedList } from '@/features/planner/parts';
import { PlanMap } from '@/features/planner/PlanMap';
import { RouteList } from '@/features/planner/RouteList';
import { formatDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useDayStore } from '@/stores/day';

export function PlannerPage() {
  const day = useDayStore((s) => s.day);
  const plan = usePlanOfDay(day);
  const network = useNetwork(day);
  const generate = useGeneratePlan(day);

  if (plan.isPending || network.isPending)
    return (
      <div className="absolute inset-0 grid grid-cols-[400px_minmax(0,1fr)] gap-[var(--vz-gap)] pb-[var(--vz-gap)] pl-[var(--vz-safe-left)] pr-[var(--vz-gap)] pt-[var(--vz-safe-top)]">
        <Skeleton className="rounded-panel" />
        <Skeleton className="rounded-panel" />
      </div>
    );

  if (plan.isError || network.isError)
    return (
      <ContentArea>
        <Panel className="mx-auto mt-10 w-[520px]">
          <EmptyState
            icon={ClipboardList}
            title="The plan could not be loaded"
            action={
              <Button
                onClick={() => {
                  void plan.refetch();
                  void network.refetch();
                }}
              >
                Try again
              </Button>
            }
          >
            {(plan.error ?? network.error)?.message}
          </EmptyState>
        </Panel>
      </ContentArea>
    );

  if (!plan.data)
    return (
      <ContentArea>
        <Panel className="mx-auto mt-10 w-[560px] animate-in fade-in-0 duration-200">
          <EmptyState
            icon={ClipboardList}
            title={`No plan for ${formatDay(day)} yet`}
            action={
              <Button size="lg" onClick={() => generate.mutate()} disabled={generate.isPending}>
                {generate.isPending ? (
                  <>
                    <Loader2 aria-hidden className="animate-spin" /> Calculating the plan…
                  </>
                ) : (
                  'Generate plan'
                )}
              </Button>
            }
          >
            Venzini plans the deliveries of the day from the forecasts, the resources and the
            warehouse stock, using every available tanker.
          </EmptyState>
          {generate.error ? (
            <p role="alert" className="-mt-4 px-8 pb-8 text-center text-body font-medium text-ink">
              {generate.error.message}
            </p>
          ) : null}
        </Panel>
      </ContentArea>
    );

  return <Planner key={day} day={day} view={plan.data} network={network.data} />;
}

type Notice = { tone: 'alert' | 'status'; text: string } | null;

function Planner({
  day,
  view: base,
  network,
}: {
  day: string;
  view: NonNullable<ReturnType<typeof usePlanOfDay>['data']>;
  network: NonNullable<ReturnType<typeof useNetwork>['data']>;
}) {
  const [params, setParams] = useSearchParams();
  const edit = useEditPlan(day);
  const generate = useGeneratePlan(day);
  const [selected, setSelected] = useState<string | null>(params.get('station'));
  const [tanker, setTanker] = useState<string | null>(null);
  const [riskId, setRiskId] = useState<string | null>(null);
  const [moving, setMoving] = useState<Stop | null>(null);
  const [quantity, setQuantity] = useState<{ stop: Stop; fuel: string } | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const onTilesFailed = useCallback(() => setTilesFailed(true), []);

  // "Adjust" on Approvals and "Open in planner" on the network focus a station (FR-81).
  const stationParam = params.get('station');
  const [seenParam, setSeenParam] = useState(stationParam);
  if (stationParam !== seenParam) {
    setSeenParam(stationParam);
    if (stationParam) setSelected(stationParam);
  }
  const select = (id: string | null) => {
    setSelected(id);
    if (stationParam)
      setParams(
        (p) => {
          p.delete('station');
          return p;
        },
        { replace: true },
      );
  };

  const pending = edit.isPending;
  const view = pending && edit.variables ? previewEdit(base, edit.variables.edit) : base;
  const readOnly = base.plan.status === 'decided';
  const risk = view.risks.find((r) => r.risk_id === riskId) ?? null;
  const highlight = highlightOf(risk);
  const blocking = overloads(view)[0];

  const run = (e: EditRequest, after?: () => void) => {
    if (pending) return;
    setNotice(null);
    setRiskId(null);
    edit.mutate(
      { planId: base.plan.plan_id, edit: { ...e, expected_version: base.plan.version } },
      {
        onSuccess: () => after?.(),
        onError: (err) => {
          if (e.kind === 'quantity') setQuantityError(err.message);
          else setNotice({ tone: 'alert', text: err.message });
        },
      },
    );
  };

  const tankers = [...new Map(view.routes.map((r) => [r.tanker_id, r])).values()];

  return (
    <div className="absolute inset-0 grid grid-cols-[400px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] gap-[var(--vz-gap)] pb-[var(--vz-gap)] pl-[var(--vz-safe-left)] pr-[var(--vz-gap)] pt-[var(--vz-safe-top)]">
      {/* Left: where every edit happens. */}
      <Panel
        role="region"
        aria-label="Routes"
        className="flex min-h-0 flex-col overflow-hidden animate-in fade-in-0 slide-in-from-left-2 duration-300"
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
          <div>
            <h2 className="text-section text-ink">Routes</h2>
            <p className="text-caption text-muted">
              {view.routes.length} routes · {view.routes.reduce((n, r) => n + r.stops.length, 0)}{' '}
              stops · version {base.plan.version}
            </p>
          </div>
          {readOnly ? null : (
            <ResetButton
              disabled={(base.plan.kind === 'optimal' && !base.comparison) || pending}
              onReset={() => run({ kind: 'reset', expected_version: base.plan.version })}
            />
          )}
        </div>
        <div className="flex flex-col gap-2 px-4 empty:hidden">
          {readOnly ? (
            <Callout icon={CalendarCheck} tone="strong">
              {formatMessage('ERR-VAL-04', { day: formatDay(day) })}
            </Callout>
          ) : null}
          {base.plan.resources_changed && !readOnly ? (
            <Callout icon={RefreshCw} title="The resources changed after this plan was made.">
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                disabled={generate.isPending}
                onClick={() => generate.mutate()}
              >
                Make a new plan
              </Button>
            </Callout>
          ) : null}
          {notice ? (
            <div
              role={notice.tone}
              className="flex items-start gap-3 rounded-panel border border-navy-900/30 bg-note-strong px-4 py-3 text-body text-ink animate-in fade-in-0 duration-200"
            >
              {notice.tone === 'alert' ? (
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              ) : (
                <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
              )}
              <p className="min-w-0 flex-1">{notice.text}</p>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setNotice(null)}
                className="rounded-control p-0.5 text-muted hover:text-ink"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 pt-3">
          <RouteList
            view={view}
            readOnly={readOnly}
            pending={pending}
            selected={selected}
            highlight={highlight}
            actions={{
              onSelect: select,
              onEdit: (e) => run(e),
              onRefused: (warehouse) =>
                setNotice({ tone: 'alert', text: formatMessage('WARN-EDIT-01', { warehouse }) }),
              onMoveTo: setMoving,
              onQuantity: (stop, fuel) => {
                setQuantityError(null);
                setQuantity({ stop, fuel });
              },
            }}
          />
        </div>
        <UnservedList
          view={view}
          selected={selected}
          className="max-h-[42%] shrink-0 overflow-auto border-t border-line bg-panel px-4 pb-3 pt-2.5"
        />
      </Panel>

      {/* Right: the map card, the centerpiece. */}
      <div className="flex min-h-0 flex-col gap-[var(--vz-gap)]">
        {blocking ? (
          <div
            role="alert"
            className="flex shrink-0 items-center gap-3 rounded-panel border border-navy-900/30 bg-note-strong px-5 py-2.5 text-body text-ink shadow-float animate-in fade-in-0 slide-in-from-top-1 duration-200"
          >
            <ShieldAlert aria-hidden className="size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p>
                <span className="font-semibold">Approval is blocked.</span> {blocking.reason}
              </p>
              <p className="text-caption text-muted">
                Fix it: move a station back or to another tanker, lower a quantity, or reset.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setRiskId(blocking.risk_id)}>
              Show on map
            </Button>
          </div>
        ) : null}

        <Panel
          role="region"
          aria-label="Route map"
          className="relative isolate min-h-0 flex-1 overflow-hidden animate-in fade-in-0 duration-300"
        >
          <PlanMap
            view={view}
            network={network}
            tanker={tanker}
            highlight={highlight}
            selected={selected}
            onSelect={select}
            onTilesFailed={onTilesFailed}
            onReady={setMap}
          />
          <div
            role="radiogroup"
            aria-label="Show routes"
            className="absolute left-4 top-4 z-[1000] flex items-center gap-1 rounded-control border border-line bg-panel p-1 shadow-panel"
          >
            {[null, ...tankers.map((r) => r.tanker_id)].map((t) => {
              const route = tankers.find((r) => r.tanker_id === t);
              return (
                <button
                  key={t ?? 'all'}
                  type="button"
                  role="radio"
                  aria-checked={tanker === t}
                  onClick={() => setTanker(t)}
                  className={cn(
                    'flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-caption font-semibold transition-colors duration-150',
                    tanker === t ? 'bg-navy-900 text-panel' : 'text-ink hover:bg-navy-tint',
                  )}
                >
                  {route ? <RouteSwatch route={route} className="w-3.5" /> : null}
                  {t ?? 'All routes'}
                </button>
              );
            })}
          </div>
          <div className="absolute bottom-4 left-4 z-[1000] flex items-end gap-3">
            <div
              aria-label="Map legend"
              className="flex items-center gap-4 rounded-control border border-line bg-panel px-4 py-2 text-caption text-ink shadow-panel"
            >
              <span className="flex items-center gap-2">
                <span className="vz-legend-dot vz-marker--high">
                  <TriangleAlert aria-hidden className="size-3" />
                </span>
                High
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
              <span className="flex items-center gap-2">
                <span className="vz-unserved size-[18px] border-[1.5px]">
                  <X aria-hidden className="size-2.5" />
                </span>
                Not served
              </span>
              <span className="ml-1 flex gap-1 border-l border-line pl-3">
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
                className="flex items-center gap-2 rounded-control border border-line bg-panel px-4 py-2.5 text-caption text-ink shadow-panel"
              >
                <MapPinOff aria-hidden className="size-4" />
                {formatMessage('ERR-SYS-03')}
              </div>
            ) : null}
          </div>
        </Panel>
      </div>

      {/* Bottom bar across both columns: the impact of the changes (SDD UI-05). */}
      <div className="col-span-2">
        <ImpactBar
          view={view}
          pending={pending}
          highlighted={riskId}
          onHighlight={(r: PlanRisk | null) => setRiskId(r?.risk_id ?? null)}
        />
      </div>

      {moving ? (
        <MoveDialog
          view={base}
          stop={moving}
          onClose={() => setMoving(null)}
          onMove={(e) => {
            setMoving(null);
            run(e);
          }}
        />
      ) : null}
      {quantity ? (
        <QuantityDialog
          view={base}
          stop={quantity.stop}
          fuel={quantity.fuel}
          saving={pending}
          error={quantityError}
          onClose={() => setQuantity(null)}
          onSave={(e) => {
            setQuantityError(null);
            run(e, () => {
              setQuantity(null);
              setNotice({
                tone: 'status',
                text: `New optimal plan made with the changed quantity for ${quantity.stop.station_id}.`,
              });
            });
          }}
        />
      ) : null}
    </div>
  );
}
