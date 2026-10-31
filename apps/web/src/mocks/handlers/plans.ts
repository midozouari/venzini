// API-11 to API-16 and API-P2 (SDD 5.6.4, 5.6.5). The mock never calculates a plan (SDD 7.1):
// it returns the fixture plan, the scripted outcomes of SDD 7.2, or a simple generic answer
// (stops renumbered, values unchanged).
import {
  EditRequest,
  formatNumber,
  GeneratePlanRequest,
  LimitsQuery,
  PlanDayQuery,
  PlanDecisionRequest,
  StopDecisionRequest,
  type DecisionEntry,
  type Limits,
  type PlanDecisionResponse,
  type PlanView,
  type Route,
  type Severity,
  type Stop,
  type StopDecisionResponse,
  type Trip,
} from '@venzini/contracts';
import { http } from 'msw';
import { nowIso } from '../clock';
import { fixtures } from '../fixtures';
import { api, fail, json, readBody, readQuery, route as endpoint } from '../http';
import {
  clone,
  store,
  type DayPlan,
  type EditRecord,
  type PlanRecord,
  type UserRecord,
} from '../store';
import { displayDay } from './util';

const DEMO_DAY = fixtures.demo.default_delivery_day;
const FIXTURE_PLAN_ID = fixtures.optimal.view.plan.plan_id;
const NOT_DISPATCHED = 'Not dispatched: the manager rejected this delivery';
const fuelName = (id: string) =>
  fixtures.reference.fuel_types.find((f) => f.fuel_type_id === id)?.name ?? id;

// ---------- helpers ----------

function findCurrent(planId: string): { day: string; dp: DayPlan } | null {
  for (const [day, dp] of store.state.plans)
    if (dp.current.view.plan.plan_id === planId) return { day, dp };
  return null;
}

function findStop(view: PlanView, stopId: string): { route: Route; stop: Stop } | null {
  for (const route of view.routes) {
    const stop = route.stops.find((s) => s.stop_id === stopId);
    if (stop) return { route, stop };
  }
  return null;
}

const allStops = (view: PlanView) => view.routes.flatMap((r) => r.stops);

function renumber(route: Route): void {
  route.stops.forEach((s, i) => (s.stop_order = i + 1));
}

/** The view as sent: flags a draft built on older resources (FR-11 alternative flow). */
function present(view: PlanView, day: string): PlanView {
  const latest = store.state.resources[day]?.resource_version_id;
  return {
    ...view,
    plan: {
      ...view.plan,
      resources_changed:
        view.plan.status !== 'decided' && !!latest && latest !== view.plan.resource_version_id,
    },
  };
}

/** Keeps each station's decision through a change of plan. */
function carryDecisions(from: PlanView, to: PlanView): void {
  const status = new Map(allStops(from).map((s) => [s.station_id, s.decision_status]));
  for (const s of allStops(to)) s.decision_status = status.get(s.station_id) ?? 'pending';
}

function planStatus(view: PlanView, dp: DayPlan): PlanView['plan']['status'] {
  const stops = allStops(view);
  const pending = stops.filter((s) => s.decision_status === 'pending').length;
  const anyDecided = stops.some((s) => s.decision_status !== 'pending') || dp.rejected.size > 0;
  if (pending === 0 && (stops.length > 0 || dp.rejected.size > 0)) return 'decided';
  if (anyDecided) return 'partly_decided';
  return view.plan.kind === 'edited' ? 'edited' : 'draft';
}

function overloads(view: PlanView, routeId?: string) {
  return view.risks.filter(
    (r) => r.type === 'RISK-01' && (!routeId || r.affected.routes.includes(routeId)),
  );
}

/** ERR-PLAN-04 naming the tanker, its load and its capacity (FR-77). */
function overloadError(view: PlanView, routeId: string) {
  const r = view.routes.find((x) => x.route_id === routeId)!;
  return fail('ERR-PLAN-04', {
    tanker: r.tanker_id,
    load: formatNumber(r.load.assigned_l),
    capacity: formatNumber(r.load.capacity_l),
    excess: formatNumber(Math.max(0, r.load.assigned_l - r.load.capacity_l)),
  });
}

/** Common checks of every plan write: known plan, current, not decided, same version (NFR-26). */
function checkWrite(
  planId: string,
  expectedVersion: number,
): { day: string; dp: DayPlan } | Response {
  const found = findCurrent(planId);
  if (!found) return store.state.planArchive.has(planId) ? fail('ERR-API-03') : fail('ERR-API-01');
  if (found.dp.current.view.plan.status === 'decided')
    return fail('ERR-VAL-04', { day: displayDay(found.day) });
  if (found.dp.current.view.plan.version !== expectedVersion) return fail('ERR-API-03');
  return found;
}

function commit(dp: DayPlan, record: PlanRecord): PlanView {
  record.view.plan.status = planStatus(record.view, dp);
  record.view.approval_blocked = overloads(record.view).length > 0;
  dp.current = record;
  store.archive(record.view);
  return record.view;
}

function edited(dp: DayPlan, view: PlanView): void {
  const cur = dp.current.view;
  view.plan.version = cur.plan.version + 1;
  if (cur.plan.kind === 'optimal') {
    view.plan.plan_id = store.nextPlanId(); // the first edit copies the optimal plan (SEQ-03)
    view.plan.kind = 'edited';
    view.plan.parent_plan_id = dp.baseline.view.plan.plan_id;
  } else {
    view.plan.plan_id = cur.plan.plan_id;
    view.plan.parent_plan_id = cur.plan.parent_plan_id;
  }
  view.plan.resource_version_id = cur.plan.resource_version_id;
  view.plan.delivery_day = cur.plan.delivery_day;
}

function recordEdit(dp: DayPlan, kind: EditRecord['kind'], summary: string): void {
  dp.edits.push({ edit_id: store.nextEditId(), kind, at: nowIso(), summary });
}

function sumLitres(view: PlanView): void {
  for (const r of view.routes) {
    r.totals.litres = r.stops.reduce(
      (a, s) => a + s.quantities.reduce((b, q) => b + q.final_l, 0),
      0,
    );
    r.load.assigned_l = r.totals.litres;
  }
  view.plan.totals.litres = view.routes.reduce((a, r) => a + r.totals.litres, 0);
}

/** A copy of the demo-day plan for another day: same plan, dates moved (generic answer). */
function planForDay(day: string): PlanRecord {
  const text = JSON.stringify(fixtures.optimal).replaceAll(DEMO_DAY, day);
  return JSON.parse(text) as PlanRecord;
}

const SEVERITY_ORDER: Severity[] = ['high', 'medium', 'low'];

function snapshot(view: PlanView, routeStop: { route: Route; stop: Stop } | null) {
  if (!routeStop) return { plan_id: view.plan.plan_id, totals: view.plan.totals };
  const { route, stop } = routeStop;
  return {
    plan_id: view.plan.plan_id,
    station_id: stop.station_id,
    station_name: stop.station_name,
    tanker_id: route.tanker_id,
    stop_order: stop.stop_order,
    est_arrival: stop.est_arrival,
    quantities: stop.quantities.map((q) => ({ fuel_type_id: q.fuel_type_id, litres: q.final_l })),
  };
}

/** One append-only decision log entry (FR-72, TBL-24). */
function logDecision(
  day: string,
  dp: DayPlan,
  view: PlanView,
  user: UserRecord,
  scope: 'action' | 'plan',
  decision: 'approved' | 'rejected',
  stop: { route: Route; stop: Stop } | null,
  note?: string,
): string {
  const cmp = view.comparison;
  const wasEdited = view.plan.kind === 'edited';
  const original = stop
    ? (() => {
        for (const r of dp.baseline.view.routes) {
          const s = r.stops.find((x) => x.station_id === stop.stop.station_id);
          if (s) return snapshot(dp.baseline.view, { route: r, stop: s });
        }
        return snapshot(view, stop);
      })()
    : snapshot(dp.baseline.view, null);
  const entry: DecisionEntry = {
    entry_id: crypto.randomUUID(),
    decided_at: nowIso(),
    manager: { id: user.id, full_name: user.full_name },
    scope,
    decision,
    station_id: stop?.stop.station_id ?? null,
    plan_label:
      decision === 'rejected' ? 'not dispatched' : wasEdited ? 'modified' : 'as recommended',
    cost_diff_usd: decision === 'rejected' ? null : (cmp?.cost_diff ?? 0),
    cost_diff_pct: decision === 'rejected' ? null : (cmp?.cost_diff_pct ?? 0),
    risk_count: view.risks.length,
    max_severity: SEVERITY_ORDER.find((s) => view.risks.some((r) => r.severity === s)) ?? null,
    plan_id: view.plan.plan_id,
    stop_id: stop?.stop.stop_id ?? null,
    delivery_day: day,
    original_recommendation: original,
    final_version: snapshot(view, stop),
    was_edited: wasEdited,
    edits: clone(dp.edits),
    risks_shown: view.risks.map((r) => ({ type: r.type, severity: r.severity, reason: r.reason })),
    cost_optimal: cmp?.cost_optimal ?? view.plan.totals.cost_usd,
    cost_final: view.plan.totals.cost_usd,
    note: note ?? null,
    input_versions: {
      resource_version: view.plan.resource_version_id,
      forecast: fixtures.demo.model_versions['forecast'] ?? '',
      templates: fixtures.demo.model_versions['templates'] ?? '',
    },
    correlation_id: crypto.randomUUID(),
  };
  store.state.decisions.unshift(entry);
  return entry.entry_id;
}

/** BR-30: when the plan is decided, the day's resources lock and its trips can be recorded. */
function onDecided(day: string, view: PlanView): void {
  if (view.plan.status !== 'decided') return;
  const res = store.state.resources[day];
  if (res) res.locked = true;
  for (const r of view.routes) {
    if (!r.stops.some((s) => s.decision_status === 'approved')) continue;
    const taken = store.state.trips.some((t) => t.route_id === r.route_id);
    const trip: Trip = {
      route_id: taken ? `${r.route_id}-${day.slice(5).replace('-', '')}` : r.route_id,
      plan_id: view.plan.plan_id,
      delivery_day: day,
      trip_no: r.trip_no,
      tanker_id: r.tanker_id,
      driver: r.driver,
      home_warehouse_id: r.home_warehouse_id,
      est_departure: r.est_departure,
      est_return: r.est_return,
      actual_departure: null,
      actual_return: null,
      trip_status: 'planned',
      time_gap_min: null,
      time_gap_pct: null,
      cancel_reason: null,
    };
    store.state.trips.push(trip);
  }
}

const unknownLimits = (station: string): Limits => ({
  max_l: null,
  binding_limit: 'unknown',
  limits: { tanker: null, tank: null, warehouse: null },
  hint: `Max for this stop: not available. The limit for ${station} can't be computed.`,
});

// ---------- handlers ----------

export const planHandlers = [
  http.post(
    api('/plans'),
    endpoint('API-11', async ({ request }) => {
      const body = await readBody(request, GeneratePlanRequest);
      if ('error' in body) return body.error;
      const day = body.data.delivery_day;
      const res = store.state.resources[day];
      const existing = store.state.plans.get(day);
      if (res?.locked || existing?.current.view.plan.status === 'decided')
        return fail('ERR-VAL-04', { day: displayDay(day) });
      if (!res) return fail('ERR-PLAN-02', { day: displayDay(day) });
      if (!res.tankers.some((t) => t.available))
        return fail('ERR-PLAN-01', { missing: 'no tankers', day: displayDay(day) });
      if (!res.drivers.some((d) => d.available))
        return fail('ERR-PLAN-01', { missing: 'no drivers', day: displayDay(day) });
      if (res.stock.every((s) => s.stock_l === 0))
        return fail('ERR-PLAN-01', { missing: 'no fuel stock', day: displayDay(day) });

      const record = day === DEMO_DAY ? clone(fixtures.optimal) : planForDay(day);
      const first = day === DEMO_DAY && !store.state.planArchive.has(FIXTURE_PLAN_ID);
      record.view.plan.plan_id = first ? FIXTURE_PLAN_ID : store.nextPlanId();
      record.view.plan.resource_version_id = res.resource_version_id;
      const dp: DayPlan = {
        current: record,
        baseline: record,
        scriptBase: first,
        usedReplans: existing?.usedReplans ?? new Set(),
        rejected: new Set(),
        edits: [],
      };
      store.state.plans.set(day, dp);
      store.archive(record.view);
      return json(present(record.view, day), 201);
    }),
  ),

  http.get(
    api('/plans'),
    endpoint('API-P2', ({ request }) => {
      const q = readQuery(request, PlanDayQuery);
      if ('error' in q) return q.error;
      const dp = store.state.plans.get(q.data.day);
      return dp ? json(present(dp.current.view, q.data.day)) : fail('ERR-API-01'); // UI offers "Generate plan"
    }),
  ),

  http.get<{ id: string }>(
    api('/plans/:id'),
    endpoint('API-12', ({ params }) => {
      const found = findCurrent(params.id);
      if (found) return json(present(found.dp.current.view, found.day));
      const archived = store.state.planArchive.get(params.id);
      return archived ? json(archived) : fail('ERR-API-01');
    }),
  ),

  http.get<{ id: string }>(
    api('/plans/:id/limits'),
    endpoint('API-14', ({ request, params }) => {
      const q = readQuery(request, LimitsQuery);
      if ('error' in q) return q.error;
      const found = findCurrent(params.id);
      const view = found?.dp.current.view ?? store.state.planArchive.get(params.id);
      if (!view) return fail('ERR-API-01');
      const loc = findStop(view, q.data.stop);
      if (!loc) return fail('ERR-API-01');
      const key = `${loc.stop.station_id}|${q.data.fuel}`;
      const limits = found?.dp.current.limits[key] ?? found?.dp.baseline.limits[key];
      return json(limits ?? unknownLimits(loc.stop.station_id));
    }),
  ),

  http.post<{ id: string }>(
    api('/plans/:id/edits'),
    endpoint('API-13', async ({ request, params }) => {
      const body = await readBody(request, EditRequest);
      if ('error' in body) return body.error;
      const edit = body.data;
      const checked = checkWrite(params.id, edit.expected_version);
      if (checked instanceof Response) return checked;
      const { day, dp } = checked;
      const cur = dp.current.view;

      if (edit.kind === 'reset') {
        // FR-60: restore the optimal plan exactly.
        const view = clone(dp.baseline.view);
        carryDecisions(cur, view);
        view.plan.version = cur.plan.version + 1;
        dp.edits = [];
        dp.scriptBase =
          day === DEMO_DAY && view.plan.plan_id === FIXTURE_PLAN_ID && dp.rejected.size === 0;
        return json(present(commit(dp, { view, limits: dp.baseline.limits }), day));
      }

      const loc = findStop(cur, edit.stop_id);
      if (!loc) return fail('ERR-API-01');
      const station = loc.stop.station_id;

      if (edit.kind === 'reorder') {
        const n = loc.route.stops.length;
        if (edit.position > n)
          return fail(
            'ERR-VAL-02',
            { field: 'Position', rule: `must be between 1 and ${n}` },
            { field: 'position' },
          );
        if (edit.position === loc.stop.stop_order) return json(present(cur, day)); // dropped where it was (FR-55)
        const scripted = dp.scriptBase
          ? fixtures.scriptedEdits.reorders.find(
              (r) =>
                r.station_id === station &&
                r.route_id === loc.route.route_id &&
                r.position === edit.position,
            )
          : undefined;
        const view = scripted ? clone(scripted.outcome.view) : clone(cur);
        if (scripted) carryDecisions(cur, view);
        else {
          const r = view.routes.find((x) => x.route_id === loc.route.route_id)!;
          const [moved] = r.stops.splice(loc.stop.stop_order - 1, 1);
          r.stops.splice(edit.position - 1, 0, moved!);
          renumber(r);
        }
        const limits = scripted?.outcome.limits ?? dp.current.limits;
        if (!view.comparison) view.comparison = zeroComparison(dp);
        edited(dp, view);
        recordEdit(
          dp,
          'reorder',
          `Moved ${station} to stop ${edit.position} on tanker ${loc.route.tanker_id}.`,
        );
        dp.scriptBase = false;
        return json(present(commit(dp, { view, limits }), day));
      }

      if (edit.kind === 'move') {
        const target = cur.routes.find((r) => r.route_id === edit.to_route_id);
        if (!target) return fail('ERR-API-01');
        if (target.route_id === loc.route.route_id)
          return fail(
            'ERR-VAL-02',
            { field: 'To route ID', rule: 'must be another route' },
            { field: 'to_route_id' },
          );
        if (target.home_warehouse_id !== loc.route.home_warehouse_id)
          return fail('WARN-EDIT-01', { warehouse: loc.route.home_warehouse_id }); // nothing changed
        if (edit.position > target.stops.length + 1)
          return fail(
            'ERR-VAL-02',
            { field: 'Position', rule: `must be between 1 and ${target.stops.length + 1}` },
            { field: 'position' },
          );
        const scripted = dp.scriptBase
          ? fixtures.scriptedEdits.moves.find(
              (m) =>
                m.station_id === station &&
                m.to_route_id === target.route_id &&
                m.position === edit.position,
            )
          : undefined;
        const view = scripted ? clone(scripted.outcome.view) : clone(cur);
        if (scripted) carryDecisions(cur, view);
        else {
          const from = view.routes.find((x) => x.route_id === loc.route.route_id)!;
          const to = view.routes.find((x) => x.route_id === target.route_id)!;
          const [moved] = from.stops.splice(loc.stop.stop_order - 1, 1);
          to.stops.splice(edit.position - 1, 0, moved!);
          renumber(from);
          renumber(to);
        }
        const limits = scripted?.outcome.limits ?? dp.current.limits;
        if (!view.comparison) view.comparison = zeroComparison(dp);
        edited(dp, view);
        recordEdit(
          dp,
          'move',
          `Moved ${station} to tanker ${target.tanker_id}, stop ${edit.position}.`,
        );
        dp.scriptBase = false;
        return json(present(commit(dp, { view, limits }), day));
      }

      // Quantity edit (FR-58): checked against the BR-28 maximum, then a new optimal plan (FR-59).
      const qty = loc.stop.quantities.find((q) => q.fuel_type_id === edit.fuel_type_id);
      if (!qty)
        return fail(
          'ERR-VAL-02',
          { field: 'Fuel type ID', rule: 'is not delivered at this stop' },
          { field: 'fuel_type_id' },
        );
      const routeEdited = dp.edits.some((e) => e.kind === 'reorder' || e.kind === 'move');
      if (routeEdited && edit.confirm_replace_route_edits !== true)
        return fail(
          'ERR-VAL-01',
          { field: 'Confirm replace route edits' },
          { field: 'confirm_replace_route_edits' },
        );
      const key = `${station}|${edit.fuel_type_id}`;
      const lim = dp.current.limits[key] ?? dp.baseline.limits[key];
      if (!lim || lim.max_l === null)
        return fail(
          'ERR-VAL-02',
          { field: 'Litres', rule: 'the maximum for this stop is not known' },
          { field: 'litres' },
        );
      if (edit.litres > lim.max_l) {
        const max = formatNumber(lim.max_l);
        if (lim.binding_limit === 'tanker')
          return fail('ERR-VAL-05a', { tanker: loc.route.tanker_id, max }, { field: 'litres' });
        if (lim.binding_limit === 'tank') return fail('ERR-VAL-05b', { max }, { field: 'litres' });
        return fail(
          'ERR-VAL-05c',
          { fuel: fuelName(edit.fuel_type_id), warehouse: loc.route.home_warehouse_id, max },
          { field: 'litres' },
        );
      }
      const view = clone(dp.baseline.view); // route edits are replaced (FR-59)
      carryDecisions(cur, view);
      for (const r of view.routes) {
        const s = r.stops.find((x) => x.station_id === station);
        if (!s) continue;
        const q = s.quantities.find((x) => x.fuel_type_id === edit.fuel_type_id);
        if (q) q.final_l = edit.litres;
        if (s.quantities.every((x) => x.final_l === 0)) {
          r.stops = r.stops.filter((x) => x !== s);
          renumber(r);
        }
      }
      sumLitres(view);
      Object.assign(view.plan, {
        plan_id: store.nextPlanId(),
        kind: 'optimal',
        parent_plan_id: cur.plan.plan_id,
        version: cur.plan.version + 1,
      });
      view.comparison = null;
      view.risks = [];
      const record = { view, limits: dp.baseline.limits };
      dp.baseline = record;
      dp.edits = [];
      recordEdit(
        dp,
        'quantity',
        `Set ${station} ${fuelName(edit.fuel_type_id)} to ${formatNumber(edit.litres)} L.`,
      );
      dp.scriptBase = false;
      return json(present(commit(dp, record), day));
    }),
  ),

  http.post<{ id: string; stopId: string }>(
    api('/plans/:id/stops/:stopId/decision'),
    endpoint('API-15', async ({ request, params, user }) => {
      const body = await readBody(request, StopDecisionRequest);
      if ('error' in body) return body.error;
      const checked = checkWrite(params.id, body.data.expected_version);
      if (checked instanceof Response) return checked;
      const { day, dp } = checked;
      const cur = dp.current.view;
      const loc = findStop(cur, params.stopId);
      if (!loc) return fail('ERR-API-01');
      if (loc.stop.decision_status !== 'pending')
        return fail('ERR-VAL-04', { day: displayDay(day) });

      if (body.data.decision === 'approve') {
        if (overloads(cur, loc.route.route_id).length > 0)
          return overloadError(cur, loc.route.route_id); // FR-77
        const view = clone(cur);
        findStop(view, loc.stop.stop_id)!.stop.decision_status = 'approved';
        view.plan.version = cur.plan.version + 1;
        const id = logDecision(
          day,
          dp,
          view,
          user!,
          'action',
          'approved',
          findStop(view, loc.stop.stop_id),
        );
        const committed = commit(dp, { view, limits: dp.current.limits });
        onDecided(day, committed);
        const response: StopDecisionResponse = {
          stop: { stop_id: loc.stop.stop_id, decision_status: 'approved' },
          plan: {
            plan_id: committed.plan.plan_id,
            status: committed.plan.status,
            version: committed.plan.version,
          },
          replan: null,
          log_entry_ids: [id],
        };
        return json(response);
      }

      // Rejection (FR-82): a new optimal plan without the station; unchanged approvals are kept.
      const station = loc.stop.station_id;
      const logId = logDecision(day, dp, cur, user!, 'action', 'rejected', loc, body.data.note);
      dp.rejected.add(station);
      const scripted =
        day === DEMO_DAY && !dp.usedReplans.has(station)
          ? fixtures.scriptedEdits.replans.find((r) => r.rejected_station_id === station)
          : undefined;
      let next: PlanView;
      let limits = dp.current.limits;
      if (scripted) {
        dp.usedReplans.add(station);
        next = clone(scripted.outcome.view);
        limits = scripted.outcome.limits;
        for (const r of next.routes) {
          r.stops = r.stops.filter((s) => !dp.rejected.has(s.station_id));
          renumber(r);
        }
        const earlier = cur.unserved.filter(
          (u) =>
            u.reason === NOT_DISPATCHED &&
            !next.unserved.some((x) => x.station_id === u.station_id),
        );
        next.unserved.push(...earlier);
      } else {
        next = clone(cur);
        for (const r of next.routes) {
          r.stops = r.stops.filter((s) => s.station_id !== station);
          renumber(r);
        }
        next.unserved.push(
          ...loc.stop.quantities.map((q) => ({
            station_id: station,
            fuel_type_id: q.fuel_type_id,
            risk_level: loc.stop.risk_level,
            hours_to_stockout: loc.stop.hours_to_stockout,
            reason: NOT_DISPATCHED,
          })),
        );
        sumLitres(next);
      }

      // D-23: an approved action stays approved only if its tanker, litres and arrival are unchanged.
      const before = new Map(
        cur.routes.flatMap((r) => r.stops.map((s) => [s.station_id, { r, s }] as const)),
      );
      const kept: string[] = [];
      const returned: string[] = [];
      for (const r of next.routes)
        for (const s of r.stops) {
          const old = before.get(s.station_id);
          s.decision_status = 'pending';
          if (old?.s.decision_status !== 'approved') continue;
          const same =
            old.r.tanker_id === r.tanker_id &&
            old.s.est_arrival === s.est_arrival &&
            JSON.stringify(old.s.quantities.map((q) => q.final_l)) ===
              JSON.stringify(s.quantities.map((q) => q.final_l));
          if (same) {
            s.decision_status = 'approved';
            kept.push(s.stop_id);
          } else returned.push(s.stop_id);
        }
      const previousIds = new Set(allStops(cur).map((s) => s.station_id));
      Object.assign(next.plan, {
        plan_id: store.nextPlanId(),
        kind: 'optimal',
        parent_plan_id: cur.plan.plan_id,
        version: 1,
        resource_version_id: cur.plan.resource_version_id,
      });
      next.comparison = null;
      next.risks = [];
      const record = { view: next, limits };
      dp.baseline = record;
      dp.edits = [];
      dp.scriptBase = false;
      const committed = commit(dp, record);
      onDecided(day, committed);
      const response: StopDecisionResponse = {
        stop: { stop_id: loc.stop.stop_id, decision_status: 'rejected' },
        plan: {
          plan_id: committed.plan.plan_id,
          status: committed.plan.status,
          version: committed.plan.version,
        },
        replan: {
          previous_plan_id: cur.plan.plan_id,
          not_dispatched: { station_id: station, risk_level: loc.stop.risk_level },
          kept_approved: kept,
          returned_to_pending: returned,
          newly_served: allStops(committed)
            .map((s) => s.station_id)
            .filter((s) => !previousIds.has(s)),
        },
        log_entry_ids: [logId],
      };
      return json(response);
    }),
  ),

  http.post<{ id: string }>(
    api('/plans/:id/decision'),
    endpoint('API-16', async ({ request, params, user }) => {
      const body = await readBody(request, PlanDecisionRequest);
      if ('error' in body) return body.error;
      const checked = checkWrite(params.id, body.data.expected_version);
      if (checked instanceof Response) return checked;
      const { day, dp } = checked;
      const cur = dp.current.view;
      const approve = body.data.decision === 'approve_all';
      const pendingCount = allStops(cur).filter((s) => s.decision_status === 'pending').length;
      if (pendingCount === 0) return fail('ERR-VAL-04', { day: displayDay(day) });
      const overloaded = overloads(cur)[0];
      if (approve && overloaded) return overloadError(cur, overloaded.affected.routes[0]!); // FR-77

      const view = clone(cur);
      const ids: string[] = [];
      for (const r of view.routes)
        for (const s of r.stops)
          if (s.decision_status === 'pending') {
            s.decision_status = approve ? 'approved' : 'rejected';
            ids.push(
              logDecision(day, dp, view, user!, 'action', approve ? 'approved' : 'rejected', {
                route: r,
                stop: s,
              }),
            );
          }
      ids.push(logDecision(day, dp, view, user!, 'plan', approve ? 'approved' : 'rejected', null)); // FR-80: +1 plan entry
      view.plan.version = cur.plan.version + 1;
      const committed = commit(dp, { view, limits: dp.current.limits });
      onDecided(day, committed);
      const response: PlanDecisionResponse = {
        plan: {
          plan_id: committed.plan.plan_id,
          status: committed.plan.status,
          version: committed.plan.version,
        },
        decided_actions: pendingCount,
        resources_locked: store.state.resources[day]?.locked ?? false,
        log_entry_ids: ids,
      };
      return json(response);
    }),
  ),
];

function zeroComparison(dp: DayPlan): NonNullable<PlanView['comparison']> {
  const cost = dp.baseline.view.plan.totals.cost_usd ?? 0;
  return {
    cost_optimal: cost,
    cost_new: cost,
    cost_diff: 0,
    cost_diff_pct: 0,
    km_diff_pct: 0,
    minutes_diff_pct: 0,
  };
}
