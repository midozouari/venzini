// Fixture-only versions of ALG-03 (risk, priority, quantity), the time and cost parts of ALG-04 and
// ALG-05, ALG-06 (edit risks) and ALG-07 (quantity limits). They build consistent scripted plans for
// the MVP; the mock API itself never calculates (SDD 7.1).
import {
  fillTemplate,
  formatLitres,
  formatNumber,
  formatSignedPct,
  formatUsd,
  highestRisk,
  increaseSeverity,
  latenessSeverity,
  riskLevelFromHours,
  round1,
  roundHalfEven,
  type Limits,
  type PlanRisk,
  type PlanView,
  type RiskLevel,
  type Route,
  type Stop,
} from '@venzini/contracts';
import { addDays, hhmmToMinutes, localMinutesToIso, minutesToHhmm } from './dates';
import type { ForecastResult } from './forecast';
import {
  DELIVERY_DAY,
  DEPOT_CLOSE_MIN,
  DEPOT_OPEN_MIN,
  FUEL_IDS,
  FUEL_PRICE_USD_PER_L,
  fuelName,
  REFERENCE_DATE,
  RELOAD_MIN,
  SIZE_PROFILE,
  STATIONS,
  TANKERS,
  UNLOADING_BASE_MIN,
  UNLOADING_MIN_PER_1000L,
  type FuelId,
  type StationSpec,
  type TankerSpec,
} from './master';
import { distance, type DistanceMatrix } from './roads';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const tankKey = (station: string, fuel: string) => `${station}|${fuel}`;

// ---------- ALG-03: time to stockout, risk, quantity ----------

/** Equations (13)–(14): hours until the tank is empty; null when it lasts the 7 days. */
export function hoursToStockout(level: number, demand: number[]): number | null {
  let left = level;
  for (let d = 0; d < demand.length; d++) {
    const f = demand[d]!;
    if (left - f <= 0) return 24 * d + (24 * left) / f;
    left -= f;
  }
  return null;
}

/** The level that empties the tank after `hours` hours of forecast demand (scenario helper). */
export function levelForHours(hours: number, demand: number[]): number {
  const full = Math.floor(hours / 24);
  return Math.round(sum(demand.slice(0, full)) + (hours / 24 - full) * (demand[full] ?? 0));
}

export interface TankState {
  station: string;
  fuel: FuelId;
  capacity: number;
  safety: number;
  level: number | null;
  hours: number | null;
  risk: RiskLevel | null;
  needs: boolean;
  quantity: number;
  runOutDay: string | null;
  forecast: ForecastResult;
}

export function computeTanks(forecasts: Map<string, ForecastResult>): Map<string, TankState> {
  const tanks = new Map<string, TankState>();
  for (const st of STATIONS)
    for (const fuel of FUEL_IDS) {
      const fc = forecasts.get(tankKey(st.id, fuel))!;
      const demand = fc.days.map((d) => d.litres);
      const week = sum(demand);
      const capacity = SIZE_PROFILE[st.size][fuel].capacity;
      const safety = st.safety?.[fuel] ?? SIZE_PROFILE[st.size][fuel].safety;
      if (st.targets === 'no_level') {
        tanks.set(tankKey(st.id, fuel), {
          station: st.id,
          fuel,
          capacity,
          safety,
          level: null,
          hours: null,
          risk: null,
          needs: false,
          quantity: 0,
          runOutDay: null,
          forecast: fc,
        });
        continue;
      }
      const target = st.targets[fuel];
      const level =
        target === 'ok'
          ? Math.min(capacity, Math.ceil(safety + week + 0.05 * capacity))
          : levelForHours(target, demand);
      if (target === 'ok' && level - week < safety)
        throw new Error(`${st.id} ${fuel}: tank too small for 'ok'`);
      const hours = hoursToStockout(level, demand);
      const needs = level - week < safety;
      // Equation (17): refill to cover the week plus safety stock, capped by free storage (BR-04).
      const quantity = needs
        ? Math.max(0, Math.floor(Math.min(safety + week - level, capacity - level) / 100) * 100)
        : 0;
      tanks.set(tankKey(st.id, fuel), {
        station: st.id,
        fuel,
        capacity,
        safety,
        level,
        hours: hours === null ? null : round1(hours),
        risk: riskLevelFromHours(hours),
        needs,
        quantity,
        runOutDay: hours === null ? null : addDays(REFERENCE_DATE, 1 + Math.floor(hours / 24)),
        forecast: fc,
      });
    }
  return tanks;
}

// ---------- Planning context ----------

export interface PlanContext {
  matrix: DistanceMatrix;
  serving: Map<string, string>;
  tanks: Map<string, TankState>;
  /** Warehouse stock per warehouse and fuel on the delivery day. */
  stock: Map<string, number>;
  drivers: Map<string, { driver_id: string; full_name: string }>;
  rank: Map<string, number>;
}

export const station = (id: string): StationSpec => {
  const s = STATIONS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown station ${id}`);
  return s;
};
export const tanker = (id: string): TankerSpec => {
  const t = TANKERS.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown tanker ${id}`);
  return t;
};

/** Fuels a station needs this week, with their recommended litres. */
export function neededFuels(
  ctx: PlanContext,
  stationId: string,
): { fuel: FuelId; litres: number }[] {
  return FUEL_IDS.map((fuel) => ({ fuel, t: ctx.tanks.get(tankKey(stationId, fuel))! }))
    .filter(({ t }) => t.needs && t.quantity > 0)
    .map(({ fuel, t }) => ({ fuel, litres: t.quantity }));
}

/** Station risk = highest fuel risk (FR-47), with the fuel that explains it. */
export function stationRisk(
  ctx: PlanContext,
  stationId: string,
): { level: RiskLevel; hours: number | null; fuel: FuelId } {
  const states = FUEL_IDS.map((f) => ctx.tanks.get(tankKey(stationId, f))!);
  const level = highestRisk(states.map((s) => s.risk ?? 'low'));
  const byHours = [...states].sort((a, b) => (a.hours ?? Infinity) - (b.hours ?? Infinity));
  const worst = byHours.find((s) => s.risk === level) ?? byHours[0]!;
  return { level, hours: worst.hours, fuel: worst.fuel };
}

/** Equation (16): rank stations that need fuel by (risk, carried over, hours, −quantity, distance, id). */
export function priorityRanks(ctx: PlanContext): Map<string, number> {
  const order = { high: 0, medium: 1, low: 2 } as const;
  const candidates = STATIONS.filter((s) => neededFuels(ctx, s.id).length > 0).map((s) => {
    const r = stationRisk(ctx, s.id);
    return {
      id: s.id,
      key: [
        order[r.level],
        1,
        r.hours ?? Infinity,
        -sum(neededFuels(ctx, s.id).map((n) => n.litres)),
        distance(ctx.matrix, ctx.serving.get(s.id)!, s.id).km,
      ],
    };
  });
  candidates.sort((a, b) => {
    for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return a.key[i]! - b.key[i]!;
    return a.id.localeCompare(b.id);
  });
  return new Map(candidates.map((c, i) => [c.id, i + 1]));
}

/** FR-27: the template reason for a station's risk level. */
export function riskReason(ctx: PlanContext, stationId: string): string {
  const r = stationRisk(ctx, stationId);
  const id = { high: 'TPL-RISK-H', medium: 'TPL-RISK-M', low: 'TPL-RISK-L' } as const;
  return fillTemplate(id[r.level], {
    station: stationId,
    fuel: fuelName(r.fuel),
    hours: Math.round(r.hours ?? 0),
  });
}

// ---------- Compartments (BR-31) ----------

/** Smallest valid assignment of compartments to fuels; null when the loads cannot fit. */
export function assignCompartments(
  sizes: number[],
  loads: Map<string, number>,
): (string | null)[] | null {
  const fuels = [...loads.keys()].filter((f) => (loads.get(f) ?? 0) > 0);
  const options = [null, ...fuels];
  let best: (string | null)[] | null = null;
  let bestUsed = Infinity;
  const total = options.length ** sizes.length;
  for (let code = 0; code < total; code++) {
    const assign: (string | null)[] = [];
    let c = code;
    for (let i = 0; i < sizes.length; i++) {
      assign.push(options[c % options.length]!);
      c = Math.floor(c / options.length);
    }
    const ok = fuels.every(
      (f) => sum(sizes.filter((_, i) => assign[i] === f)) >= (loads.get(f) ?? 0),
    );
    const used = assign.filter((a) => a !== null).length;
    if (ok && used < bestUsed) {
      best = assign;
      bestUsed = used;
    }
  }
  return best;
}

// ---------- Route builder: times (Eq. 20–22), km and cost (Eq. 26) ----------

export interface RouteSpec {
  tanker: string;
  trip: 1 | 2;
  stations: string[];
}

export interface StopCalc {
  station: string;
  arrival: number;
  quantities: { fuel: FuelId; litres: number }[];
}

export interface RouteCalc {
  route_id: string;
  spec: RouteSpec;
  depart: number;
  ret: number;
  km: number;
  minutes: number;
  litres: number;
  cost: number;
  segments: { from: string; to: string; km: number; minutes: number }[];
  stops: StopCalc[];
  loads: Map<string, number>;
  compartments: (string | null)[] | null;
}

export interface PlanCalc {
  routes: RouteCalc[];
  totals: { km: number; minutes: number; litres: number; cost: number };
}

export function buildRoutes(ctx: PlanContext, specs: RouteSpec[], routeIds: string[]): PlanCalc {
  const returns = new Map<string, number>();
  const routes = specs.map((spec, i) => {
    const t = tanker(spec.tanker);
    const home = t.warehouse;
    const depart =
      spec.trip === 1 ? DEPOT_OPEN_MIN : (returns.get(spec.tanker) ?? DEPOT_OPEN_MIN) + RELOAD_MIN;
    let clock = depart;
    let prev = home;
    const segments: RouteCalc['segments'] = [];
    const stops: StopCalc[] = [];
    for (const sid of spec.stations) {
      const leg = distance(ctx.matrix, prev, sid);
      segments.push({ from: prev, to: sid, km: round1(leg.km), minutes: leg.minutes });
      const s = station(sid);
      const arrival = Math.max(hhmmToMinutes(s.open), clock + leg.minutes); // Eq. (20)
      const quantities = neededFuels(ctx, sid);
      const unload = Math.round(
        UNLOADING_BASE_MIN +
          (UNLOADING_MIN_PER_1000L * sum(quantities.map((q) => q.litres))) / 1000,
      ); // Eq. (21)
      stops.push({ station: sid, arrival, quantities });
      clock = arrival + unload;
      prev = sid;
    }
    const back = distance(ctx.matrix, prev, home);
    segments.push({ from: prev, to: home, km: round1(back.km), minutes: back.minutes });
    const ret = clock + back.minutes;
    returns.set(spec.tanker, ret);
    const km = round1(sum(segments.map((g) => g.km)));
    const loads = new Map<string, number>();
    for (const st of stops)
      for (const q of st.quantities) loads.set(q.fuel, (loads.get(q.fuel) ?? 0) + q.litres);
    const litres = sum([...loads.values()]);
    return {
      route_id: routeIds[i]!,
      spec,
      depart,
      ret,
      km,
      minutes: ret - depart,
      litres,
      cost: roundHalfEven(km * t.consumption * FUEL_PRICE_USD_PER_L, 2), // Eq. (26), BR-16
      segments,
      stops,
      loads,
      compartments: assignCompartments(t.compartments, loads),
    };
  });
  return {
    routes,
    totals: {
      km: round1(sum(routes.map((r) => r.km))),
      minutes: sum(routes.map((r) => r.minutes)),
      litres: sum(routes.map((r) => r.litres)),
      cost: roundHalfEven(sum(routes.map((r) => r.cost)), 2), // Eq. (27): equals the sum shown (AC-16)
    },
  };
}

/** Hard-rule check of a recommended plan (PlanValidator, FR-29 to FR-33): throws on a violation. */
export function validatePlan(ctx: PlanContext, plan: PlanCalc): void {
  for (const r of plan.routes) {
    const t = tanker(r.spec.tanker);
    if (r.litres > sum(t.compartments) || !r.compartments)
      throw new Error(`${r.route_id}: capacity (BR-06, BR-31)`);
    if (r.ret > DEPOT_CLOSE_MIN) throw new Error(`${r.route_id}: returns after the depot closes`);
    for (const s of r.stops) {
      const spec = station(s.station);
      if (s.arrival > hhmmToMinutes(spec.close))
        throw new Error(`${s.station}: outside its window (BR-07)`);
      if (ctx.serving.get(s.station) !== t.warehouse)
        throw new Error(`${s.station}: not its closest warehouse (BR-17)`);
      for (const q of s.quantities) {
        const tank = ctx.tanks.get(tankKey(s.station, q.fuel))!;
        if (q.litres > tank.capacity - (tank.level ?? 0))
          throw new Error(`${s.station}: above free storage (BR-04)`);
      }
    }
  }
  for (const [key, stock] of ctx.stock) {
    const [wh, fuel] = key.split('|');
    const planned = sum(
      plan.routes
        .filter((r) => tanker(r.spec.tanker).warehouse === wh)
        .map((r) => r.loads.get(fuel!) ?? 0),
    );
    if (planned > stock) throw new Error(`${wh} ${fuel}: above warehouse stock (BR-08)`);
  }
}

/** Could a station still be added to any trip of its warehouse (capacity, compartments, window)? */
export function fitsAnywhere(ctx: PlanContext, plan: PlanCalc, stationId: string): boolean {
  const wh = ctx.serving.get(stationId);
  const specs = plan.routes.map((r) => r.spec);
  return specs.some((spec, i) => {
    if (tanker(spec.tanker).warehouse !== wh) return false;
    for (let pos = 0; pos <= spec.stations.length; pos++) {
      const stations = [...spec.stations];
      stations.splice(pos, 0, stationId);
      const trial = specs.map((s, j) => (j === i ? { ...s, stations } : s));
      try {
        validatePlan(
          ctx,
          buildRoutes(
            ctx,
            trial,
            plan.routes.map((r) => r.route_id),
          ),
        );
        return true;
      } catch {
        // not feasible at this position
      }
    }
    return false;
  });
}

// ---------- PlanView ----------

export interface ViewMeta {
  plan_id: string;
  kind: 'optimal' | 'edited';
  parent_plan_id: string | null;
  status: 'draft' | 'edited' | 'partly_decided' | 'decided';
  resource_version_id: string;
  stopIds: Map<string, string>;
  unserved: PlanView['unserved'];
  comparison: PlanView['comparison'];
  risks: PlanRisk[];
}

export function toPlanView(ctx: PlanContext, plan: PlanCalc, meta: ViewMeta): PlanView {
  const routes: Route[] = plan.routes.map((r) => {
    const t = tanker(r.spec.tanker);
    const colorIndex = TANKERS.findIndex((x) => x.id === t.id) + 1;
    const stops: Stop[] = r.stops.map((s, i) => {
      const risk = stationRisk(ctx, s.station);
      return {
        stop_id: meta.stopIds.get(s.station)!,
        station_id: s.station,
        station_name: station(s.station).name,
        stop_order: i + 1,
        est_arrival: localMinutesToIso(DELIVERY_DAY, s.arrival),
        priority_rank: ctx.rank.get(s.station)!,
        risk_level: risk.level,
        hours_to_stockout: risk.hours,
        uncertain: s.quantities.some(
          (q) => ctx.tanks.get(tankKey(s.station, q.fuel))!.forecast.uncertain,
        ),
        reason: riskReason(ctx, s.station),
        quantities: s.quantities.map((q) => ({
          fuel_type_id: q.fuel,
          recommended_l: q.litres,
          final_l: q.litres,
        })),
        decision_status: 'pending',
      };
    });
    return {
      route_id: r.route_id,
      tanker_id: t.id,
      trip_no: r.spec.trip,
      driver: ctx.drivers.get(t.id)!,
      home_warehouse_id: t.warehouse,
      color: `route-${colorIndex}` as Route['color'],
      est_departure: localMinutesToIso(DELIVERY_DAY, r.depart),
      est_return: localMinutesToIso(DELIVERY_DAY, r.ret),
      totals: { km: r.km, minutes: r.minutes, litres: r.litres, cost_usd: r.cost },
      load: {
        capacity_l: sum(t.compartments),
        assigned_l: r.litres,
        compartments: fillCompartments(t.compartments, r.loads, r.compartments),
      },
      segments: r.segments,
      stops,
    };
  });

  const fallback = plan.routes.flatMap((r) =>
    r.stops.flatMap((s) =>
      s.quantities
        .map((q) => ctx.tanks.get(tankKey(s.station, q.fuel))!)
        .filter((t) => t.forecast.similar)
        .map((t) => ({
          station_id: s.station,
          fuel_type_id: t.fuel,
          confidence: t.forecast.overall,
        })),
    ),
  );

  return {
    plan: {
      plan_id: meta.plan_id,
      delivery_day: DELIVERY_DAY,
      kind: meta.kind,
      parent_plan_id: meta.parent_plan_id,
      status: meta.status,
      version: 1,
      resource_version_id: meta.resource_version_id,
      resources_changed: false,
      time_limited: false,
      totals: {
        km: plan.totals.km,
        minutes: plan.totals.minutes,
        litres: plan.totals.litres,
        cost_usd: plan.totals.cost,
      },
    },
    routes,
    unserved: meta.unserved,
    fallback_forecast: fallback,
    comparison: meta.comparison,
    risks: meta.risks,
    approval_blocked: meta.risks.some((r) => r.blocks_approval),
  };
}

/** Litres per compartment in position order; an impossible load is shown as far as it goes. */
function fillCompartments(
  sizes: number[],
  loads: Map<string, number>,
  assign: (string | null)[] | null,
) {
  const left = new Map(loads);
  const owner: (string | null)[] =
    assign ??
    (() => {
      const greedy: (string | null)[] = sizes.map(() => null);
      let i = 0;
      for (const [fuel, litres] of loads) {
        let need = litres;
        while (need > 0 && i < sizes.length) {
          greedy[i] = fuel;
          need -= sizes[i]!;
          i++;
        }
      }
      return greedy;
    })();
  return sizes.map((size, i) => {
    const fuel = owner[i] ?? null;
    const litres = fuel ? Math.min(size, left.get(fuel) ?? 0) : 0;
    if (fuel) left.set(fuel, (left.get(fuel) ?? 0) - litres);
    return { position: i + 1, size_l: size, fuel_type_id: fuel, litres };
  });
}

// ---------- ALG-06: edited plan vs optimal plan ----------

export function comparePlans(opt: PlanCalc, ed: PlanCalc): NonNullable<PlanView['comparison']> {
  const pct = (a: number, b: number) => round1(((a - b) / b) * 100);
  return {
    cost_optimal: opt.totals.cost,
    cost_new: ed.totals.cost,
    cost_diff: roundHalfEven(ed.totals.cost - opt.totals.cost, 2), // Eq. (28)
    cost_diff_pct: pct(ed.totals.cost, opt.totals.cost), // Eq. (29)
    km_diff_pct: pct(ed.totals.km, opt.totals.km),
    minutes_diff_pct: pct(ed.totals.minutes, opt.totals.minutes),
  };
}

export function analyseEdit(
  ctx: PlanContext,
  opt: PlanCalc,
  ed: PlanCalc,
  stopIds: Map<string, string>,
): PlanRisk[] {
  const risks: Omit<PlanRisk, 'risk_id'>[] = [];
  const optStops = new Map(opt.routes.flatMap((r) => r.stops.map((s) => [s.station, s] as const)));

  for (const r of ed.routes) {
    const t = tanker(r.spec.tanker);
    const capacity = sum(t.compartments);
    if (r.litres > capacity || !r.compartments) {
      // Equation (30), BR-21
      risks.push({
        type: 'RISK-01',
        severity: 'high',
        blocks_approval: true,
        affected: {
          routes: [r.route_id],
          stops: r.stops.map((s) => stopIds.get(s.station)!),
          segments: [],
        },
        reason: fillTemplate('TPL-EDIT-01', {
          tanker: t.id,
          load: formatLitres(r.litres),
          capacity: formatLitres(capacity),
          excess: formatLitres(Math.max(0, r.litres - capacity)),
        }),
      });
    }
  }

  for (const r of ed.routes)
    r.stops.forEach((s, i) => {
      const o = optStops.get(s.station);
      const spec = station(s.station);
      const affected = {
        routes: [r.route_id],
        stops: [stopIds.get(s.station)!],
        segments: [`${r.route_id}#${i}`],
      };
      const stockout = Math.min(
        ...s.quantities.map((q) => {
          const h = ctx.tanks.get(tankKey(s.station, q.fuel))!.hours;
          return h === null ? Infinity : h * 60; // start of day 1 = minute 0 of the delivery day
        }),
      );
      if (s.arrival > stockout && !(o && o.arrival > stockout)) {
        const fuel = s.quantities.find(
          (q) => (ctx.tanks.get(tankKey(s.station, q.fuel))!.hours ?? Infinity) * 60 === stockout,
        )!.fuel;
        risks.push({
          type: 'RISK-02',
          severity: 'high',
          blocks_approval: false,
          affected,
          reason: fillTemplate('TPL-EDIT-02', {
            station: s.station,
            fuel: fuelName(fuel),
            minutes: Math.round(s.arrival - stockout),
          }),
        }); // Eq. (31)
      }
      const inWindow = (a: number) =>
        a >= hhmmToMinutes(spec.open) && a <= hhmmToMinutes(spec.close);
      if (!inWindow(s.arrival) && !(o && !inWindow(o.arrival)))
        risks.push({
          type: 'RISK-03',
          severity: 'high',
          blocks_approval: false,
          affected,
          reason: fillTemplate('TPL-EDIT-03', {
            station: s.station,
            time: minutesToHhmm(s.arrival),
            open: spec.open,
            close: spec.close,
          }),
        }); // Eq. (32)
      const late = o ? s.arrival - o.arrival : 0;
      if (late > 0)
        risks.push({
          type: 'RISK-04',
          severity: latenessSeverity(late),
          blocks_approval: false,
          affected,
          reason: fillTemplate('TPL-EDIT-04', { station: s.station, minutes: late }),
        }); // Eq. (33)
    });

  const changed = ed.routes.filter((r) => {
    const o = opt.routes.find((x) => x.route_id === r.route_id);
    return (
      !o ||
      o.km !== r.km ||
      o.minutes !== r.minutes ||
      o.stops.map((s) => s.station).join() !== r.stops.map((s) => s.station).join()
    );
  });
  const planAffected = { routes: changed.map((r) => r.route_id), stops: [], segments: [] };
  const measures = [
    [
      'RISK-05',
      'TPL-EDIT-05',
      ed.totals.km,
      opt.totals.km,
      (d: number) => `${round1(d).toFixed(1)} km`,
    ],
    [
      'RISK-06',
      'TPL-EDIT-06',
      ed.totals.minutes,
      opt.totals.minutes,
      (d: number) => `${formatNumber(d)} min`,
    ],
    [
      'RISK-07',
      'TPL-EDIT-07',
      ed.totals.cost,
      opt.totals.cost,
      (d: number) => formatUsd(roundHalfEven(d, 2)),
    ],
  ] as const;
  for (const [type, tpl, x, xo, fmt] of measures) {
    const pct = ((x - xo) / xo) * 100; // Eq. (34)
    if (pct > 0)
      risks.push({
        type,
        severity: increaseSeverity(round1(pct)),
        blocks_approval: false,
        affected: planAffected,
        reason: fillTemplate(tpl, { amount: fmt(x - xo), pct: formatSignedPct(round1(pct)) }),
      });
  }

  return risks.map((r, i) => ({ risk_id: `RK-${String(i + 1).padStart(2, '0')}`, ...r }));
}

// ---------- ALG-07: maximum quantity for a stop and fuel ----------

export function quantityLimits(
  ctx: PlanContext,
  plan: PlanCalc,
  stationId: string,
  fuel: FuelId,
): Limits {
  const route = plan.routes.find((r) => r.stops.some((s) => s.station === stationId))!;
  const t = tanker(route.spec.tanker);
  const stop = route.stops.find((s) => s.station === stationId)!;
  const own = stop.quantities.find((q) => q.fuel === fuel)?.litres ?? 0;
  const otherSameFuel = (route.loads.get(fuel) ?? 0) - own;
  const others = [...route.loads].filter(([f, l]) => f !== fuel && l > 0);

  // Equation (35): best split of compartments that still holds the other fuels.
  let room = 0;
  const n = t.compartments.length;
  for (let mask = 0; mask < 2 ** n; mask++) {
    const forOthers = t.compartments.filter((_, i) => mask & (1 << i));
    const othersFit =
      others.length === 0 ? mask === 0 : assignCompartments(forOthers, new Map(others)) !== null;
    if (!othersFit) continue;
    room = Math.max(room, sum(t.compartments.filter((_, i) => !(mask & (1 << i)))));
  }
  const tankerFree = room - otherSameFuel;
  const tank = ctx.tanks.get(tankKey(stationId, fuel))!;
  const tankFree = tank.level === null ? null : tank.capacity - tank.level; // Eq. (36)
  const wh = t.warehouse;
  const whOthers = sum(
    plan.routes
      .filter((r) => tanker(r.spec.tanker).warehouse === wh)
      .flatMap((r) => r.stops.filter((s) => s.station !== stationId))
      .flatMap((s) => s.quantities.filter((q) => q.fuel === fuel).map((q) => q.litres)),
  );
  const whFree = (ctx.stock.get(`${wh}|${fuel}`) ?? 0) - whOthers; // Eq. (37)

  const assignedOther = route.litres - own;
  const limits: Limits['limits'] = {
    tanker: {
      tanker_id: t.id,
      capacity_l: sum(t.compartments),
      assigned_other_l: assignedOther,
      free_l: tankerFree,
    },
    tank: tankFree === null ? null : { free_storage_l: tankFree },
    warehouse: { warehouse_id: wh, remaining_l: whFree },
  };
  if (tankFree === null)
    return {
      max_l: null,
      binding_limit: 'unknown',
      limits,
      hint: `Max for this stop: not available. The tank level of ${stationId} is unknown.`,
    };

  const max = Math.max(0, Math.min(tankerFree, tankFree, whFree)); // Eq. (38)
  const binding =
    tankerFree <= Math.min(tankFree, whFree) ? 'tanker' : tankFree <= whFree ? 'tank' : 'warehouse';
  const detail = {
    tanker: `Tanker ${t.id} has ${formatLitres(Math.max(0, tankerFree))} left for ${fuelName(fuel)} (${formatLitres(sum(t.compartments))} capacity, ${formatLitres(assignedOther)} already assigned)`,
    tank: `The station's tank has ${formatLitres(tankFree)} of free space`,
    warehouse: `${wh} has ${formatLitres(Math.max(0, whFree))} of ${fuelName(fuel)} left`,
  }[binding];
  return {
    max_l: max,
    binding_limit: binding,
    limits,
    hint: fillTemplate('TPL-LIM-01', { max: formatLitres(max), limit_detail: detail }),
  };
}

export const tankKeyOf = tankKey;
