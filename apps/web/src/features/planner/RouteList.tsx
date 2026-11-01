// Route cards and stop lists of the planner (UI-05; FR-46, FR-50, FR-52, FR-55, FR-56). Stops are
// dragged by their handle to reorder them, or onto another tanker of the same warehouse to move
// them. Every drag has a button path: Move up, Move down and "Move to tanker…" (SDD 5.12.6).
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { EditRequest, PlanView, Route, Stop } from '@venzini/contracts';
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  ChevronDown,
  CircleHelp,
  GripVertical,
  Pencil,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { RiskBadge } from '@/components/ui/risk-badge';
import { formatHours, formatLitres, formatTime, formatUsd } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  dropToEdit,
  findStation,
  findStop,
  moveTargets,
  overloads,
  routeTarget,
  type Highlight,
} from './edit';
import { DecisionChip, RouteSwatch, useFuelName } from './parts';

export interface RouteListActions {
  onSelect: (stationId: string | null) => void;
  onEdit: (edit: EditRequest) => void;
  onRefused: (warehouse: string) => void;
  onMoveTo: (stop: Stop) => void;
  onQuantity: (stop: Stop, fuel: string) => void;
}

/** Prefer the stop under the pointer, then the card under it; keyboard drags use the closest. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const stops = hits.filter((h) => !String(h.id).startsWith('route:'));
  if (stops.length > 0) return stops;
  if (hits.length > 0) return hits;
  return closestCenter(args);
};

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

export function RouteList({
  view,
  readOnly,
  pending,
  selected,
  highlight,
  actions,
}: {
  view: PlanView;
  readOnly: boolean;
  pending: boolean;
  selected: string | null;
  highlight: Highlight | null;
  actions: RouteListActions;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Selecting a station (map, link, Adjust) opens its route card.
  const selectedRoute = selected ? findStation(view, selected)?.route.route_id : undefined;
  const [open, setOpen] = useState<Set<string>>(
    () => new Set([selectedRoute ?? view.routes[0]?.route_id ?? '']),
  );
  const [openedFor, setOpenedFor] = useState(selectedRoute);
  if (selectedRoute !== openedFor) {
    setOpenedFor(selectedRoute);
    if (selectedRoute && !open.has(selectedRoute)) setOpen(new Set(open).add(selectedRoute));
  }

  const toggle = (id: string) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const from = dragging ? findStop(view, dragging) : null;
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    const result = dropToEdit(view, String(active.id), over ? String(over.id) : null);
    if (result.kind === 'edit') actions.onEdit(result.edit);
    if (result.kind === 'refused') actions.onRefused(result.warehouse);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={({ active }) => setDragging(String(active.id))}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
      // Scroll the list only when the pointer is right at its edge, and gently.
      autoScroll={{ threshold: { x: 0, y: 0.15 }, acceleration: 6 }}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'To pick up a stop, press space or enter. Use the arrow keys to move it, then press space or enter to drop it, or escape to cancel. The Move up, Move down and Move to tanker buttons do the same.',
        },
      }}
    >
      <ul className="flex flex-col gap-3">
        {view.routes.map((route) => (
          <RouteCard
            key={route.route_id}
            route={route}
            view={view}
            isOpen={open.has(route.route_id)}
            onToggle={() => toggle(route.route_id)}
            readOnly={readOnly}
            pending={pending}
            selected={selected}
            highlight={highlight}
            dragFrom={from?.route ?? null}
            actions={actions}
          />
        ))}
      </ul>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {from ? (
          <div className="flex items-center gap-3 rounded-control border border-line bg-panel px-3 py-2.5 shadow-dialog">
            <GripVertical aria-hidden className="size-4 text-muted" />
            <StopNumber route={from.route} n={from.stop.stop_order} />
            <span className="text-body font-semibold text-ink">
              {from.stop.station_name} · {from.stop.station_id}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function StopNumber({ route, n }: { route: Route; n: number }) {
  return (
    <span
      className={cn(
        'vz-swatch flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-bold tabular-nums text-panel',
        `vz-r${route.color.slice(6)}`,
      )}
    >
      {n}
    </span>
  );
}

function RouteCard({
  route,
  view,
  isOpen,
  onToggle,
  readOnly,
  pending,
  selected,
  highlight,
  dragFrom,
  actions,
}: {
  route: Route;
  view: PlanView;
  isOpen: boolean;
  onToggle: () => void;
  readOnly: boolean;
  pending: boolean;
  selected: string | null;
  highlight: Highlight | null;
  dragFrom: Route | null;
  actions: RouteListActions;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: routeTarget(route.route_id),
    disabled: readOnly,
  });
  const overloaded = overloads(view, route.route_id).length > 0;
  const accepts =
    !!dragFrom &&
    dragFrom.route_id !== route.route_id &&
    dragFrom.home_warehouse_id === route.home_warehouse_id;
  const refuses = !!dragFrom && dragFrom.home_warehouse_id !== route.home_warehouse_id;
  const lit = !!highlight?.routes.has(route.route_id);
  const usedPct = Math.min(100, (route.load.assigned_l / route.load.capacity_l) * 100);
  const bodyId = `route-${route.route_id}-stops`;

  return (
    <li
      ref={setNodeRef}
      aria-label={`${route.tanker_id}, route ${route.route_id}`}
      className={cn(
        'rounded-panel border bg-panel transition-[box-shadow,border-color,opacity] duration-200 ease-vz',
        lit ? 'border-navy-900 shadow-float' : 'border-line',
        accepts && 'border-dashed border-navy-900',
        accepts && isOver && 'bg-navy-tint shadow-float',
        refuses && 'opacity-50',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        className="flex w-full items-start gap-3 rounded-panel px-4 py-3 text-left transition-colors duration-150 hover:bg-navy-tint"
      >
        <RouteSwatch route={route} className="mt-2.5" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="text-body font-semibold text-ink">{route.tanker_id}</span>
            <span className="min-w-0 truncate text-caption text-muted">
              {route.route_id}
              {route.trip_no === 2 ? ' · second trip' : ''} · {route.driver.full_name}
            </span>
            <span
              className={cn(
                'ml-auto shrink-0 text-caption tabular-nums text-muted',
                pending && 'opacity-40',
              )}
            >
              {formatTime(route.est_departure)}–{formatTime(route.est_return)}
            </span>
          </span>
          <span
            className={cn(
              'mt-0.5 block text-caption tabular-nums text-muted transition-opacity duration-200',
              pending && 'opacity-40',
            )}
          >
            {route.stops.length} stops · {route.totals.km.toFixed(1)} km ·{' '}
            {formatDuration(route.totals.minutes)}
            {route.totals.cost_usd !== null ? ` · ${formatUsd(route.totals.cost_usd)}` : ''}
          </span>
          <span className="mt-2 flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-tint-strong"
            >
              <span
                className={cn(
                  'block h-full rounded-full',
                  overloaded ? 'bg-risk-high' : 'bg-navy-900/70',
                )}
                style={{ width: `${usedPct}%` }}
              />
            </span>
            <span className={cn('text-caption tabular-nums text-ink', pending && 'opacity-40')}>
              {formatLitres(route.load.assigned_l)} of {formatLitres(route.load.capacity_l)}
            </span>
          </span>
          {overloaded ? <RiskBadge level="high" suffix="Overloaded" className="mt-2" /> : null}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'mt-1 size-4 shrink-0 text-muted transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen ? (
        <div id={bodyId} className="px-2 pb-2 animate-in fade-in-0 duration-200">
          {route.stops.length === 0 ? (
            <p className="px-3 py-3 text-caption text-muted">
              No stops. Drag a station here to give this tanker a stop.
            </p>
          ) : (
            <SortableContext
              items={route.stops.map((s) => s.stop_id)}
              strategy={verticalListSortingStrategy}
            >
              <ol aria-label={`Stops of ${route.tanker_id}`} className="flex flex-col">
                {route.stops.map((s) => (
                  <StopRow
                    key={s.stop_id}
                    stop={s}
                    route={route}
                    canMove={!readOnly && moveTargets(view, route.route_id).length > 0}
                    readOnly={readOnly}
                    pending={pending}
                    selected={selected === s.station_id}
                    lit={!!highlight?.stops.has(s.stop_id)}
                    actions={actions}
                  />
                ))}
              </ol>
            </SortableContext>
          )}
        </div>
      ) : null}
    </li>
  );
}

function StopRow({
  stop: s,
  route,
  canMove,
  readOnly,
  pending,
  selected,
  lit,
  actions,
}: {
  stop: Stop;
  route: Route;
  canMove: boolean;
  readOnly: boolean;
  pending: boolean;
  selected: boolean;
  lit: boolean;
  actions: RouteListActions;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: s.stop_id, disabled: readOnly });
  const rowRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (selected) rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);
  const n = route.stops.length;
  const name = `${s.station_name} (${s.station_id})`;

  return (
    <li
      ref={(el) => {
        setNodeRef(el);
        rowRef.current = el;
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-control transition-[background-color,box-shadow,opacity] duration-150',
        isDragging && 'opacity-30',
        selected ? 'bg-navy-tint-strong' : 'hover:bg-navy-tint',
        lit && 'ring-2 ring-navy-900/60',
      )}
    >
      <div className="flex items-center gap-2 px-1.5 py-1.5">
        {readOnly ? (
          <span className="w-1" />
        ) : (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag ${name} to reorder or move it`}
            className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-control text-muted hover:bg-navy-tint hover:text-ink active:cursor-grabbing"
          >
            <GripVertical aria-hidden className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => actions.onSelect(selected ? null : s.station_id)}
          aria-expanded={selected}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control py-0.5 text-left"
        >
          <StopNumber route={route} n={s.stop_order} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-medium text-ink">
              {s.station_name} · {s.station_id}
            </span>
            <span className="mt-0.5 flex items-center gap-2 whitespace-nowrap text-caption tabular-nums text-muted">
              <RiskBadge level={s.risk_level} className="py-0" />
              <span className={cn('transition-opacity duration-200', pending && 'opacity-40')}>
                Arrives {formatTime(s.est_arrival)}
              </span>
            </span>
          </span>
        </button>
        {readOnly ? null : (
          <span className="flex shrink-0">
            <IconAction
              label={`Move ${name} up`}
              disabled={s.stop_order === 1}
              onClick={() =>
                actions.onEdit({
                  kind: 'reorder',
                  expected_version: 0,
                  stop_id: s.stop_id,
                  position: s.stop_order - 1,
                })
              }
            >
              <ArrowUp />
            </IconAction>
            <IconAction
              label={`Move ${name} down`}
              disabled={s.stop_order === n}
              onClick={() =>
                actions.onEdit({
                  kind: 'reorder',
                  expected_version: 0,
                  stop_id: s.stop_id,
                  position: s.stop_order + 1,
                })
              }
            >
              <ArrowDown />
            </IconAction>
            <IconAction
              label={`Move ${name} to another tanker`}
              disabled={!canMove}
              onClick={() => actions.onMoveTo(s)}
            >
              <ArrowRightLeft />
            </IconAction>
          </span>
        )}
      </div>
      {selected ? <StopDetails stop={s} readOnly={readOnly} actions={actions} /> : null}
    </li>
  );
}

function IconAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6 hover:translate-y-0 [&_svg]:size-3.5"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/** Station details box of a stop (FR-50), opened under its row; quantities can be edited (FR-58). */
function StopDetails({
  stop: s,
  readOnly,
  actions,
}: {
  stop: Stop;
  readOnly: boolean;
  actions: RouteListActions;
}) {
  const fuelName = useFuelName();
  return (
    <div className="mx-2 mb-2 rounded-control bg-panel px-3 py-3 text-caption text-ink animate-in fade-in-0 slide-in-from-top-1 duration-200">
      <p>{s.reason}</p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
        <span>Priority {s.priority_rank}</span>
        <span>Stockout in {formatHours(s.hours_to_stockout)}</span>
        {s.uncertain ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong/70 px-2 py-0.5 font-semibold text-ink">
            <CircleHelp aria-hidden className="size-3" /> Uncertain forecast
          </span>
        ) : null}
        <DecisionChip status={s.decision_status} />
      </p>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {s.quantities.map((q) => (
          <li key={q.fuel_type_id} className="flex items-center justify-between gap-3">
            <span>
              <span className="font-semibold">{fuelName(q.fuel_type_id)}</span>{' '}
              <span className="tabular-nums">{formatLitres(q.final_l)}</span>
              {q.final_l !== q.recommended_l ? (
                <span className="text-muted"> (recommended {formatLitres(q.recommended_l)})</span>
              ) : null}
            </span>
            {readOnly ? null : (
              <Button
                variant="quiet"
                size="sm"
                className="h-7"
                onClick={() => actions.onQuantity(s, q.fuel_type_id)}
              >
                <Pencil aria-hidden /> Edit quantity
                <span className="sr-only">
                  {' '}
                  of {fuelName(q.fuel_type_id)} for {s.station_id}
                </span>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
