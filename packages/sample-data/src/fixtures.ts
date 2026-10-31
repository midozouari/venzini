// Builds every MVP fixture of SDD 7.2 from seed 42. Same seed, same output (NFR-13, ADR-17).
import {
  fillTemplate,
  round1,
  TEMPLATE_CATALOG_VERSION,
  type DecisionEntry,
  type Forecast,
  type ForecastTotals,
  type Limits,
  type Network,
  type PlanView,
  type Resources,
  type Station,
  type Trip,
} from '@venzini/contracts';
import { addDays, localMinutesToIso } from './dates';
import { forecastPair, toForecast, type ForecastResult } from './forecast';
import { generateExternal, generateSales } from './history';
import {
  DELIVERY_DAY,
  DEMO_NOW,
  DRIVERS,
  FORECAST_MODEL_VERSION,
  FUEL_IDS,
  FUEL_TYPES,
  PAST_DAY,
  REFERENCE_DATE,
  REGIONS,
  STATIONS,
  TANKERS,
  USERS,
  WAREHOUSES,
  type FuelId,
} from './master';
import {
  analyseEdit,
  buildRoutes,
  comparePlans,
  computeTanks,
  neededFuels,
  priorityRanks,
  quantityLimits,
  stationRisk,
  tanker,
  tankKeyOf,
  toPlanView,
  validatePlan,
  type PlanCalc,
  type PlanContext,
  type RouteSpec,
} from './planning';
import { rngFor, SAMPLE_DATA_SEED } from './prng';
import { buildRoads, distance, floydWarshall, type DistanceMatrix } from './roads';
import type { Fixtures, PlanOutcome } from './schemas';

export const OPTIMAL_PLAN_ID = 'PL-2211';
export const PAST_PLAN_ID = 'PL-2204';
const RESOURCE_VERSION_DEMO = 'RV-0192';
const RESOURCE_VERSION_PAST = 'RV-0188';
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** The demo-day plan before optimisation of the stop order: which stations each trip serves. */
const OPTIMAL_ASSIGNMENT: RouteSpec[] = [
  { tanker: 'T-01', trip: 1, stations: ['ST012', 'ST014'] },
  { tanker: 'T-02', trip: 1, stations: ['ST008', 'ST011', 'ST013'] },
  { tanker: 'T-03', trip: 1, stations: ['ST001', 'ST003', 'ST005'] },
  { tanker: 'T-04', trip: 1, stations: ['ST002', 'ST004', 'ST007'] },
  { tanker: 'T-05', trip: 1, stations: ['ST009', 'ST010', 'ST016'] },
  { tanker: 'T-05', trip: 2, stations: ['ST015', 'ST018', 'ST020'] },
];
const UNAVAILABLE_TANKER_DEMO = 'T-06';

export interface GeneratorState {
  matrix: DistanceMatrix;
  ctx: PlanContext;
  forecasts: Map<string, ForecastResult>;
  optimal: PlanCalc;
  optimalSpecs: RouteSpec[];
}

/** Closest warehouse by road distance; ties → lower warehouse ID (BR-17, FR-34). */
function servingWarehouses(matrix: DistanceMatrix): Map<string, string> {
  return new Map(
    STATIONS.map((s) => {
      const best = WAREHOUSES.map((w) => ({
        id: w.warehouse_id,
        km: distance(matrix, w.warehouse_id, s.id).km,
      })).sort((a, b) => a.km - b.km || a.id.localeCompare(b.id))[0]!;
      return [s.id, best.id];
    }),
  );
}

/** Cheapest insertion in priority order (Equation 24); ties → lower position. */
function orderByInsertion(ctx: PlanContext, spec: RouteSpec): RouteSpec {
  const home = tanker(spec.tanker).warehouse;
  const byPriority = [...spec.stations].sort((a, b) => ctx.rank.get(a)! - ctx.rank.get(b)!);
  const order: string[] = [];
  const km = (x: string, y: string) => distance(ctx.matrix, x, y).km;
  for (const s of byPriority) {
    let best = 0;
    let bestCost = Infinity;
    for (let pos = 0; pos <= order.length; pos++) {
      const prev = pos === 0 ? home : order[pos - 1]!;
      const next = pos === order.length ? home : order[pos]!;
      const cost = km(prev, s) + km(s, next) - km(prev, next);
      if (cost < bestCost - 1e-9) {
        bestCost = cost;
        best = pos;
      }
    }
    order.splice(best, 0, s);
  }
  return { ...spec, stations: order };
}

export function buildState(): GeneratorState {
  const ext = generateExternal();
  const sales = generateSales(ext);
  const forecasts = new Map<string, ForecastResult>();
  for (const st of STATIONS)
    for (const fuel of FUEL_IDS)
      forecasts.set(tankKeyOf(st.id, fuel), forecastPair(st, fuel, sales, ext));
  const tanks = computeTanks(forecasts);

  const points = [
    ...WAREHOUSES.map((w) => ({ id: w.warehouse_id, lat: w.latitude, lon: w.longitude })),
    ...STATIONS.map((s) => ({ id: s.id, lat: s.lat, lon: s.lon })),
  ];
  const roads = buildRoads(points, rngFor('roads'));
  const matrix = floydWarshall(points.map((p) => p.id).sort(), roads);

  // Driver pairing: same home warehouse, ID order (FR-35).
  const drivers = new Map<string, { driver_id: string; full_name: string }>();
  for (const wh of WAREHOUSES) {
    const ts = TANKERS.filter(
      (t) => t.warehouse === wh.warehouse_id && t.id !== UNAVAILABLE_TANKER_DEMO,
    );
    const ds = DRIVERS.filter((d) => d.home_warehouse_id === wh.warehouse_id);
    ts.forEach((t, i) => {
      const d = ds[i];
      if (d) drivers.set(t.id, { driver_id: d.driver_id, full_name: d.full_name });
    });
  }

  const ctx: PlanContext = {
    matrix,
    serving: servingWarehouses(matrix),
    tanks,
    stock: new Map(),
    drivers,
    rank: new Map(),
  };
  ctx.rank = priorityRanks(ctx);

  const optimalSpecs = OPTIMAL_ASSIGNMENT.map((s) => orderByInsertion(ctx, s));
  const optimal = buildRoutes(ctx, optimalSpecs, routeIds(optimalSpecs.length));

  // Demo-day stock: plenty everywhere except Petrol 95 at WH-SUD, which is nearly used up, so the
  // warehouse can be the binding quantity limit (BR-28, AC-11).
  const planned = (wh: string, fuel: string) =>
    sum(
      optimal.routes
        .filter((r) => tanker(r.spec.tanker).warehouse === wh)
        .map((r) => r.loads.get(fuel) ?? 0),
    );
  ctx.stock = new Map([
    ['WH-NOR|P95', 260000],
    ['WH-NOR|DIESEL', 380000],
    ['WH-RIV|P95', 320000],
    ['WH-RIV|DIESEL', 480000],
    ['WH-SUD|P95', planned('WH-SUD', 'P95') + 1200],
    ['WH-SUD|DIESEL', 350000],
  ]);
  validatePlan(ctx, optimal);
  return { matrix, ctx, forecasts, optimal, optimalSpecs };
}

const routeIds = (n: number) =>
  Array.from({ length: n }, (_, i) => `R-${String(i + 1).padStart(2, '0')}`);
const stopIdMap = (plan: PlanCalc, start: number) =>
  new Map(
    plan.routes
      .flatMap((r) => r.stops.map((s) => s.station))
      .map((s, i) => [s, `S-${String(start + i).padStart(2, '0')}`]),
  );

function limitsOf(ctx: PlanContext, plan: PlanCalc): Record<string, Limits> {
  const out: Record<string, Limits> = {};
  for (const r of plan.routes)
    for (const s of r.stops)
      for (const q of s.quantities)
        out[`${s.station}|${q.fuel}`] = quantityLimits(ctx, plan, s.station, q.fuel);
  return out;
}

function unservedOf(
  ctx: PlanContext,
  plan: PlanCalc,
  notDispatched: string[] = [],
): PlanView['unserved'] {
  const served = new Set(plan.routes.flatMap((r) => r.stops.map((s) => s.station)));
  return STATIONS.filter((s) => neededFuels(ctx, s.id).length > 0 && !served.has(s.id))
    .sort((a, b) => ctx.rank.get(a.id)! - ctx.rank.get(b.id)!)
    .flatMap((s) =>
      neededFuels(ctx, s.id).map(({ fuel }) => {
        const t = ctx.tanks.get(tankKeyOf(s.id, fuel))!;
        return {
          station_id: s.id,
          fuel_type_id: fuel,
          risk_level: t.risk ?? 'low',
          hours_to_stockout: t.hours,
          reason: notDispatched.includes(s.id)
            ? 'Not dispatched: the manager rejected this delivery'
            : `No tanker capacity left at ${ctx.serving.get(s.id)}.`,
        };
      }),
    );
}

function editedOutcome(
  state: GeneratorState,
  specs: RouteSpec[],
  stopIds: Map<string, string>,
): PlanOutcome {
  const { ctx, optimal } = state;
  const plan = buildRoutes(ctx, specs, routeIds(specs.length));
  const view = toPlanView(ctx, plan, {
    plan_id: 'PL-EDITED',
    kind: 'edited',
    parent_plan_id: OPTIMAL_PLAN_ID,
    status: 'edited',
    resource_version_id: RESOURCE_VERSION_DEMO,
    stopIds,
    unserved: unservedOf(ctx, plan),
    comparison: comparePlans(optimal, plan),
    risks: analyseEdit(ctx, optimal, plan, stopIds),
  });
  return { view, limits: limitsOf(ctx, plan) };
}

function scriptedEdits(state: GeneratorState): Fixtures['scriptedEdits'] {
  const { ctx, optimal, optimalSpecs } = state;
  const stopIds = stopIdMap(optimal, 1);

  // SDD 7.2: move ST012 to T-02 → RISK-01 overload (ST012 stands in for the SDD's "ST032").
  const moves = [];
  const to = optimalSpecs.findIndex((s) => s.tanker === 'T-02');
  for (let pos = 1; pos <= optimalSpecs[to]!.stations.length + 1; pos++) {
    const specs = optimalSpecs.map((s) => ({
      ...s,
      stations: s.stations.filter((x) => x !== 'ST012'),
    }));
    specs[to]!.stations.splice(pos - 1, 0, 'ST012');
    moves.push({
      station_id: 'ST012',
      to_route_id: routeIds(6)[to]!,
      position: pos,
      outcome: editedOutcome(state, specs, stopIds),
    });
  }

  // SDD 7.2: reorders on T-01 (no risk) and T-03 (RISK-04 medium): every single reorder of both.
  const reorders = [];
  for (const t of ['T-01', 'T-03']) {
    const ri = optimalSpecs.findIndex((s) => s.tanker === t);
    const stations = optimalSpecs[ri]!.stations;
    for (const st of stations)
      for (let pos = 1; pos <= stations.length; pos++) {
        if (stations.indexOf(st) === pos - 1) continue;
        const reordered = stations.filter((x) => x !== st);
        reordered.splice(pos - 1, 0, st);
        const specs = optimalSpecs.map((s, i) => (i === ri ? { ...s, stations: reordered } : s));
        reorders.push({
          station_id: st,
          route_id: routeIds(6)[ri]!,
          position: pos,
          outcome: editedOutcome(state, specs, stopIds),
        });
      }
  }

  // SDD 7.2: reject ST014 → re-plan; the freed capacity serves ST019 (FR-82, D-23).
  const without = optimalSpecs.map((s) => ({
    ...s,
    stations: s.stations.filter((x) => x !== 'ST014'),
  }));
  const ri = without.findIndex((s) => s.tanker === 'T-01');
  const replanSpecs = without.map((s, i) =>
    i === ri ? orderByInsertion(ctx, { ...s, stations: [...s.stations, 'ST019'] }) : s,
  );
  const replan = buildRoutes(ctx, replanSpecs, routeIds(replanSpecs.length));
  validatePlan(ctx, replan);
  const replanStops = stopIdMap(replan, stopIds.size + 1);
  const replanView = toPlanView(ctx, replan, {
    plan_id: 'PL-REPLAN',
    kind: 'optimal',
    parent_plan_id: OPTIMAL_PLAN_ID,
    status: 'partly_decided',
    resource_version_id: RESOURCE_VERSION_DEMO,
    stopIds: replanStops,
    unserved: unservedOf(ctx, replan, ['ST014']),
    comparison: null,
    risks: [],
  });

  return {
    base_plan_id: OPTIMAL_PLAN_ID,
    moves,
    reorders,
    replans: [
      {
        rejected_station_id: 'ST014',
        outcome: { view: replanView, limits: limitsOf(ctx, replan) },
      },
    ],
  };
}

function networkFixture(state: GeneratorState): Network {
  const { ctx } = state;
  const stations = STATIONS.map((s) => {
    const tanks = FUEL_IDS.map((f) => {
      const t = ctx.tanks.get(tankKeyOf(s.id, f))!;
      return {
        fuel_type_id: f,
        current_level_l: t.level,
        capacity_l: t.capacity,
        level_pct: t.level === null ? null : Math.round((t.level / t.capacity) * 100), // FR-16
        safety_stock_l: t.safety,
        risk_level: t.risk,
        hours_to_stockout: t.hours,
      };
    });
    const available = tanks.every((t) => t.current_level_l !== null);
    return {
      station_id: s.id,
      name: s.name,
      latitude: s.lat,
      longitude: s.lon,
      serving_warehouse_id: ctx.serving.get(s.id)!,
      risk_level: available ? stationRisk(ctx, s.id).level : null,
      data_available: available,
      tanks,
    };
  });
  const alerts = STATIONS.flatMap((s) =>
    FUEL_IDS.map((f) => ctx.tanks.get(tankKeyOf(s.id, f))!)
      .filter((t) => t.risk === 'high' && t.hours !== null)
      .map((t) => ({
        station_id: s.id,
        fuel_type_id: t.fuel,
        hours_to_stockout: t.hours!,
        reason: fillTemplate('TPL-RISK-H', {
          station: s.id,
          fuel: FUEL_TYPES.find((x) => x.fuel_type_id === t.fuel)!.name,
          hours: Math.round(t.hours!),
        }),
      })),
  ).sort((a, b) => a.hours_to_stockout - b.hours_to_stockout); // FR-15

  return {
    as_of: DEMO_NOW,
    delivery_day: DELIVERY_DAY,
    kpis: {
      high_risk_stations: stations.filter((s) => s.risk_level === 'high').length,
      tankers_available: TANKERS.length - 1,
      tankers_total: TANKERS.length,
      warehouse_stock: [...ctx.stock].map(([k, stock_l]) => {
        const [warehouse_id, fuel_type_id] = k.split('|') as [string, string];
        return { warehouse_id, fuel_type_id, stock_l };
      }),
      plan_status: null,
    },
    stations,
    warehouses: WAREHOUSES.map((w) => ({ ...w })),
    alerts,
    data_unavailable: stations
      .filter((s) => !s.data_available)
      .map((s) => ({
        station_id: s.station_id,
        code: 'ERR-DATA-01' as const,
        reason: 'No tank level',
      })),
  };
}

function totalsFixture(state: GeneratorState, forecasts: Forecast[]): Fixtures['totals'] {
  const build = (level: 'network' | 'warehouse', fuel: FuelId): ForecastTotals => {
    const fcs = forecasts.filter((f) => f.fuel_type_id === fuel);
    const groupIds = level === 'network' ? [null] : WAREHOUSES.map((w) => w.warehouse_id);
    return {
      level,
      fuel_type_id: fuel,
      reference_date: REFERENCE_DATE,
      groups: groupIds.map((wh) => {
        const members = fcs.filter(
          (f) => wh === null || state.ctx.serving.get(f.station_id) === wh,
        );
        return {
          warehouse_id: wh,
          days: members[0]!.daily.map((_, d) => {
            const total = sum(members.map((m) => m.daily[d]!.litres));
            const uncertainL = sum(
              members.filter((m) => m.uncertain).map((m) => m.daily[d]!.litres),
            );
            return {
              date: members[0]!.daily[d]!.date,
              total_l: total,
              band_low: sum(members.map((m) => m.daily[d]!.band_low)),
              band_high: sum(members.map((m) => m.daily[d]!.band_high)),
              uncertain_share_pct: round1((uncertainL / total) * 100),
            };
          }),
        };
      }),
      excluded: [],
    };
  };
  return {
    network: Object.fromEntries(FUEL_IDS.map((f) => [f, build('network', f)])),
    warehouse: Object.fromEntries(FUEL_IDS.map((f) => [f, build('warehouse', f)])),
  };
}

function usersFixture(): Fixtures['users'] {
  const rng = rngFor('users');
  return USERS.map((u) => ({
    id: rng.uuid(),
    full_name: u.full_name,
    login: u.login,
    role: u.role,
    status: u.status,
    created_at: u.created,
    locked_for_min: u.locked_min,
  }));
}

function resourcesFixture(
  state: GeneratorState,
  users: Fixtures['users'],
): Record<string, Resources> {
  const karim = users.find((u) => u.login === 'karim.b')!;
  const leila = users.find((u) => u.login === 'leila.k')!;
  const tankers = (unavailable: string[]) =>
    TANKERS.map((t) => ({
      tanker_id: t.id,
      capacity_l: sum(t.compartments),
      compartments: [...t.compartments],
      home_warehouse_id: t.warehouse,
      available: !unavailable.includes(t.id),
      open_trip: null,
    }));
  const drivers = DRIVERS.map((d) => ({ ...d, available: true }));
  return {
    [PAST_DAY]: {
      delivery_day: PAST_DAY,
      resource_version_id: RESOURCE_VERSION_PAST,
      version_no: 2,
      locked: true,
      updated_by: { id: leila.id, full_name: leila.full_name },
      updated_at: '2026-10-31T15:20:00Z',
      tankers: tankers([]),
      drivers,
      stock: [
        { warehouse_id: 'WH-NOR', fuel_type_id: 'P95', stock_l: 285000 },
        { warehouse_id: 'WH-NOR', fuel_type_id: 'DIESEL', stock_l: 402000 },
        { warehouse_id: 'WH-RIV', fuel_type_id: 'P95', stock_l: 341000 },
        { warehouse_id: 'WH-RIV', fuel_type_id: 'DIESEL', stock_l: 505000 },
        { warehouse_id: 'WH-SUD', fuel_type_id: 'P95', stock_l: 52000 },
        { warehouse_id: 'WH-SUD', fuel_type_id: 'DIESEL', stock_l: 371000 },
      ],
    },
    [DELIVERY_DAY]: {
      delivery_day: DELIVERY_DAY,
      resource_version_id: RESOURCE_VERSION_DEMO,
      version_no: 3,
      locked: false,
      updated_by: { id: karim.id, full_name: karim.full_name },
      updated_at: '2026-11-01T16:40:00Z',
      tankers: tankers([UNAVAILABLE_TANKER_DEMO]),
      drivers,
      stock: [...state.ctx.stock].map(([k, stock_l]) => {
        const [warehouse_id, fuel_type_id] = k.split('|') as [string, string];
        return { warehouse_id, fuel_type_id, stock_l };
      }),
    },
  };
}

/** Trips of the decided past day 01 Nov: returned, departed (open) and planned (SDD 7.2). */
function tripsFixture(): Trip[] {
  const local = (hhmm: string) =>
    localMinutesToIso(PAST_DAY, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)));
  const trip = (
    route_id: string,
    tankerId: string,
    driverId: string,
    est: [string, string],
    actual: [string | null, string | null],
  ): Trip => {
    const d = DRIVERS.find((x) => x.driver_id === driverId)!;
    const estMin = (Date.parse(local(est[1])) - Date.parse(local(est[0]))) / 60000;
    const gap =
      actual[0] && actual[1]
        ? (Date.parse(local(actual[1])) - Date.parse(local(actual[0]))) / 60000 - estMin
        : null;
    return {
      route_id,
      plan_id: PAST_PLAN_ID,
      delivery_day: PAST_DAY,
      trip_no: 1,
      tanker_id: tankerId,
      driver: { driver_id: d.driver_id, full_name: d.full_name },
      home_warehouse_id: tanker(tankerId).warehouse,
      est_departure: local(est[0]),
      est_return: local(est[1]),
      actual_departure: actual[0] ? local(actual[0]) : null,
      actual_return: actual[1] ? local(actual[1]) : null,
      trip_status: actual[1] ? 'returned' : actual[0] ? 'departed' : 'planned',
      time_gap_min: gap,
      time_gap_pct: gap === null ? null : round1((gap / estMin) * 100), // FR-84
      cancel_reason: null,
    };
  };
  return [
    trip('R-07', 'T-01', 'D-04', ['06:00', '14:00'], ['06:10', '14:55']), // +45 min, +9.4% (AC-19)
    trip('R-08', 'T-02', 'D-05', ['05:00', '11:20'], ['05:05', '11:15']),
    trip('R-09', 'T-03', 'D-01', ['05:00', '12:40'], [null, null]),
    trip('R-10', 'T-04', 'D-02', ['05:00', '10:50'], ['05:00', '11:20']),
    trip('R-11', 'T-06', 'D-06', ['05:00', '13:30'], ['05:20', null]), // open trip → WARN-RES-01 on 03 Nov
    trip('R-12', 'T-05', 'D-03', ['05:30', '12:00'], [null, null]),
  ];
}

/** 30 past decision log entries (SDD 7.2): as recommended, modified, not dispatched. */
function decisionsFixture(users: Fixtures['users']): DecisionEntry[] {
  const rng = rngFor('decisions');
  const managers = users.filter(
    (u) => u.role === 'manager' && u.status === 'active' && u.locked_for_min === null,
  );
  const labels = [
    ...Array<'as recommended'>(18).fill('as recommended'),
    ...Array<'modified'>(7).fill('modified'),
    ...Array<'not dispatched'>(5).fill('not dispatched'),
  ];
  for (let i = labels.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [labels[i], labels[j]] = [labels[j]!, labels[i]!];
  }
  const entries: DecisionEntry[] = labels.map((label, i) => {
    const day = addDays(PAST_DAY, -Math.floor(i * 0.66)); // 30 entries over 20 delivery days
    const decidedAt = localMinutesToIso(addDays(day, -1), rng.int(15 * 60, 18 * 60));
    const manager = rng.chance(0.7)
      ? managers.find((m) => m.login === 'sara.m')!
      : managers.find((m) => m.login === 'youssef.t')!;
    const scope: 'action' | 'plan' = i % 10 === 3 && label !== 'not dispatched' ? 'plan' : 'action';
    const st = rng.pick(STATIONS.filter((s) => s.targets !== 'no_level'));
    const tk = rng.pick(TANKERS.filter((t) => t.warehouse === st.warehouse));
    const planId = `PL-${2140 + Math.floor(i * 2.1)}`;
    const fuel = rng.pick(FUEL_IDS);
    const litres = rng.int(30, 110) * 100;
    const arrival = localMinutesToIso(day, rng.int(6 * 60, 15 * 60));
    const original =
      scope === 'plan'
        ? {
            plan_id: planId,
            routes: rng.int(4, 6),
            stops: rng.int(14, 18),
            total_litres: rng.int(1150, 1550) * 100,
          }
        : {
            plan_id: planId,
            station_id: st.id,
            station_name: st.name,
            tanker_id: tk.id,
            est_arrival: arrival,
            quantities: [{ fuel_type_id: fuel, litres }],
          };
    const modified = label === 'modified';
    const otherTanker =
      TANKERS.find((t) => t.warehouse === st.warehouse && t.id !== tk.id)?.id ?? tk.id;
    const final =
      modified && scope === 'action' ? { ...original, tanker_id: otherTanker } : original;
    const costDiff = modified ? round1(rng.uniform(2, 25)) : 0;
    const costOptimal = round1(rng.uniform(320, 460));
    const riskCount = modified ? rng.int(1, 3) : 0;
    const maxSeverity = modified ? rng.pick(['low', 'medium'] as const) : null;
    return {
      entry_id: rng.uuid(),
      decided_at: decidedAt,
      manager: { id: manager.id, full_name: manager.full_name },
      scope,
      decision: label === 'not dispatched' ? 'rejected' : 'approved',
      station_id: scope === 'action' ? st.id : null,
      plan_label: label,
      cost_diff_usd: label === 'not dispatched' ? null : costDiff,
      cost_diff_pct: label === 'not dispatched' ? null : round1((costDiff / costOptimal) * 100),
      risk_count: riskCount,
      max_severity: maxSeverity,
      plan_id: planId,
      stop_id: scope === 'action' ? `S-${String(rng.int(1, 18)).padStart(2, '0')}` : null,
      delivery_day: day,
      original_recommendation: original,
      final_version: final,
      was_edited: modified,
      edits: modified
        ? [
            {
              edit_id: `E-${String(i + 1).padStart(3, '0')}`,
              kind: 'move' as const,
              at: decidedAt,
              summary: `Moved ${st.id} to tanker ${otherTanker}.`,
            },
          ]
        : [],
      risks_shown: Array.from({ length: riskCount }, (_, k) =>
        k === 0
          ? {
              type: 'RISK-04',
              severity: maxSeverity ?? 'low',
              reason: fillTemplate('TPL-EDIT-04', { station: st.id, minutes: rng.int(20, 150) }),
            }
          : {
              type: 'RISK-05',
              severity: 'low' as const,
              reason: fillTemplate('TPL-EDIT-05', {
                amount: `${round1(rng.uniform(2, 20)).toFixed(1)} km`,
                pct: `+${round1(rng.uniform(0.5, 6)).toFixed(1)}%`,
              }),
            },
      ),
      cost_optimal: label === 'not dispatched' ? null : costOptimal,
      cost_final: label === 'not dispatched' ? null : round1(costOptimal + costDiff),
      note:
        label === 'not dispatched'
          ? rng.pick([
              'Station closed for maintenance.',
              'Delivery already arranged by the station.',
              null,
            ])
          : null,
      input_versions: {
        resource_version: `RV-0${150 + i}`,
        forecast: FORECAST_MODEL_VERSION,
        templates: TEMPLATE_CATALOG_VERSION,
      },
      correlation_id: rng.uuid(),
    };
  });
  return entries.sort((a, b) => b.decided_at.localeCompare(a.decided_at)); // newest first (FR-73)
}

function stationsFixture(state: GeneratorState): Station[] {
  return STATIONS.map((s) => ({
    station_id: s.id,
    name: s.name,
    latitude: s.lat,
    longitude: s.lon,
    region: s.region,
    window_open: s.open,
    window_close: s.close,
    serving_warehouse_id: state.ctx.serving.get(s.id)!,
    status: 'active' as const,
    tanks: FUEL_IDS.map((f) => {
      const t = state.ctx.tanks.get(tankKeyOf(s.id, f))!;
      return {
        fuel_type_id: f,
        capacity_l: t.capacity,
        safety_stock_l: t.safety,
        current_level_l: t.level,
      };
    }),
  }));
}

export function generateFixtures(): Fixtures {
  const state = buildState();
  const { ctx, optimal } = state;
  const ext = generateExternal();
  const sales = generateSales(ext);
  const forecasts = STATIONS.flatMap((s) =>
    FUEL_IDS.map((f) => {
      const t = ctx.tanks.get(tankKeyOf(s.id, f))!;
      return toForecast(t.forecast, ext, sales, { level: t.level, runOutDay: t.runOutDay });
    }),
  );
  const stopIds = stopIdMap(optimal, 1);
  const optimalView = toPlanView(ctx, optimal, {
    plan_id: OPTIMAL_PLAN_ID,
    kind: 'optimal',
    parent_plan_id: null,
    status: 'draft',
    resource_version_id: RESOURCE_VERSION_DEMO,
    stopIds,
    unserved: unservedOf(ctx, optimal),
    comparison: null,
    risks: [],
  });
  const users = usersFixture();

  return {
    demo: {
      now: DEMO_NOW,
      reference_date: REFERENCE_DATE,
      default_delivery_day: DELIVERY_DAY,
      time_zone: 'Africa/Tunis',
      seed: SAMPLE_DATA_SEED,
      model_versions: { forecast: FORECAST_MODEL_VERSION, templates: TEMPLATE_CATALOG_VERSION },
    },
    reference: {
      fuel_types: FUEL_TYPES.map((f) => ({ ...f })),
      warehouses: WAREHOUSES.map((w) => ({ ...w })),
      regions: [...REGIONS],
    },
    users,
    stations: stationsFixture(state),
    network: networkFixture(state),
    forecasts,
    totals: totalsFixture(state, forecasts),
    resources: resourcesFixture(state, users),
    optimal: { view: optimalView, limits: limitsOf(ctx, optimal) },
    scriptedEdits: scriptedEdits(state),
    trips: tripsFixture(),
    decisions: decisionsFixture(users),
  };
}
