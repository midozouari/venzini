// Planner edit helpers (UI-05). They only move stops around in the view the server sent: times,
// costs and risks are never computed here (SDD 5.5); the screen greys them until the answer.
import type { EditRequest, PlanRisk, PlanView, Route, Stop } from '@venzini/contracts';

/** Drop target id of a whole route card (used when the card is collapsed or empty). */
export const routeTarget = (routeId: string) => `route:${routeId}`;

export function findStop(view: PlanView, stopId: string): { route: Route; stop: Stop } | null {
  for (const route of view.routes) {
    const stop = route.stops.find((s) => s.stop_id === stopId);
    if (stop) return { route, stop };
  }
  return null;
}

export function findStation(
  view: PlanView,
  stationId: string,
): { route: Route; stop: Stop } | null {
  for (const route of view.routes) {
    const stop = route.stops.find((s) => s.station_id === stationId);
    if (stop) return { route, stop };
  }
  return null;
}

/** The view while an edit waits for the server: only the order of the stops changes. */
export function previewEdit(view: PlanView, edit: EditRequest): PlanView {
  if (edit.kind !== 'reorder' && edit.kind !== 'move') return view;
  const loc = findStop(view, edit.stop_id);
  if (!loc) return view;
  const toId = edit.kind === 'move' ? edit.to_route_id : loc.route.route_id;
  const routes = view.routes.map((r) => ({ ...r, stops: [...r.stops] }));
  const from = routes.find((r) => r.route_id === loc.route.route_id)!;
  const to = routes.find((r) => r.route_id === toId);
  if (!to) return view;
  const [moved] = from.stops.splice(loc.stop.stop_order - 1, 1);
  to.stops.splice(Math.min(edit.position - 1, to.stops.length), 0, moved!);
  for (const r of [from, to]) r.stops = r.stops.map((s, i) => ({ ...s, stop_order: i + 1 }));
  return { ...view, routes };
}

/** Routes a stop may move to: other routes loading at the same warehouse (WARN-EDIT-01). */
export function moveTargets(view: PlanView, routeId: string): Route[] {
  const from = view.routes.find((r) => r.route_id === routeId);
  if (!from) return [];
  return view.routes.filter(
    (r) => r.route_id !== routeId && r.home_warehouse_id === from.home_warehouse_id,
  );
}

export type DropResult =
  { kind: 'edit'; edit: EditRequest } | { kind: 'refused'; warehouse: string } | { kind: 'none' };

/**
 * Turns a drag-and-drop into an edit. `overId` is a stop id (drop before or onto that stop) or a
 * route card id (drop at the end of that route).
 */
export function dropToEdit(view: PlanView, stopId: string, overId: string | null): DropResult {
  const loc = findStop(view, stopId);
  if (!loc || !overId || overId === stopId) return { kind: 'none' };
  const version = view.plan.version;
  let target: Route | undefined;
  let position: number;
  if (overId.startsWith('route:')) {
    target = view.routes.find((r) => r.route_id === overId.slice('route:'.length));
    if (!target) return { kind: 'none' };
    position =
      target.route_id === loc.route.route_id ? target.stops.length : target.stops.length + 1;
  } else {
    const over = findStop(view, overId);
    if (!over) return { kind: 'none' };
    target = over.route;
    position = over.stop.stop_order;
  }
  if (target.route_id === loc.route.route_id) {
    if (position === loc.stop.stop_order) return { kind: 'none' };
    return {
      kind: 'edit',
      edit: { kind: 'reorder', expected_version: version, stop_id: stopId, position },
    };
  }
  if (target.home_warehouse_id !== loc.route.home_warehouse_id)
    return { kind: 'refused', warehouse: loc.route.home_warehouse_id };
  return {
    kind: 'edit',
    edit: {
      kind: 'move',
      expected_version: version,
      stop_id: stopId,
      to_route_id: target.route_id,
      position,
    },
  };
}

/** Elements a risk points at, for the map and the route list (FR-65). */
export interface Highlight {
  routes: Set<string>;
  stops: Set<string>;
  segments: Set<string>;
}

export function highlightOf(risk: PlanRisk | null): Highlight | null {
  if (!risk) return null;
  return {
    routes: new Set(risk.affected.routes),
    stops: new Set(risk.affected.stops),
    segments: new Set(risk.affected.segments),
  };
}

/** RISK-01 overloads: they block approval (FR-77). */
export function overloads(view: PlanView, routeId?: string): PlanRisk[] {
  return view.risks.filter(
    (r) => r.blocks_approval && (!routeId || r.affected.routes.includes(routeId)),
  );
}

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 } as const;

/** Risks most serious first; blocking risks before the rest of the same severity. */
export function sortedRisks(risks: PlanRisk[]): PlanRisk[] {
  return [...risks].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      Number(b.blocks_approval) - Number(a.blocks_approval),
  );
}
