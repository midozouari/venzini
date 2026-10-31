import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { roundHalfEven } from '@venzini/contracts';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildState, generateFixtures } from './fixtures';
import { FUEL_PRICE_USD_PER_L, STATIONS, TANKERS } from './master';
import { fitsAnywhere, validatePlan } from './planning';
import { Fixtures } from './schemas';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(join(fixturesDir, file), 'utf8'));

let f: Fixtures;
beforeAll(() => {
  f = generateFixtures();
});

describe('determinism (NFR-13, SDD 7.2)', () => {
  it('gives byte-equal output on two runs', () => {
    expect(JSON.stringify(generateFixtures())).toBe(JSON.stringify(f));
  });

  it('matches the committed fixture files (run "pnpm --filter @venzini/sample-data generate" if not)', () => {
    expect(existsSync(fixturesDir)).toBe(true);
    const roundTrip = JSON.parse(JSON.stringify(f)) as Fixtures;
    expect(readJson('network.json')).toEqual(roundTrip.network);
    expect(readJson('plans/optimal.json')).toEqual(roundTrip.optimal);
    expect(readJson('plans/scripted-edits.json')).toEqual(roundTrip.scriptedEdits);
    expect(readJson('decisions.json')).toEqual(roundTrip.decisions);
    expect(readJson('resources.json')).toEqual(roundTrip.resources);
    expect(readJson('forecasts/ST014-DIESEL.json')).toEqual(
      roundTrip.forecasts.find((x) => x.forecast_id.includes('ST014-DIESEL')),
    );
  });

  it('passes every contract schema', () => {
    expect(() => Fixtures.parse(f)).not.toThrow();
  });
});

describe('network (UI-02, SDD 7.2)', () => {
  it('has 20 stations: 3 high, 5 medium, 11 low and 1 with data unavailable', () => {
    const count = (level: string | null) =>
      f.network.stations.filter((s) => s.risk_level === level).length;
    expect(f.network.stations).toHaveLength(20);
    expect([count('high'), count('medium'), count('low'), count(null)]).toEqual([3, 5, 11, 1]);
    expect(f.network.data_unavailable).toEqual([
      { station_id: 'ST017', code: 'ERR-DATA-01', reason: 'No tank level' },
    ]);
  });

  it('lists alerts for high-risk pairs only, shortest time first (FR-15)', () => {
    expect(f.network.alerts.map((a) => `${a.station_id}-${a.fuel_type_id}`)).toEqual([
      'ST014-DIESEL',
      'ST005-P95',
      'ST019-DIESEL',
    ]);
    expect(f.network.alerts[0]!.reason).toBe(
      'ST014 is high risk: current Diesel stock covers 14 hours of forecast demand.',
    );
  });

  it('serves every station from its closest warehouse by road (BR-17)', () => {
    for (const s of STATIONS)
      expect(f.network.stations.find((x) => x.station_id === s.id)!.serving_warehouse_id).toBe(
        s.warehouse,
      );
  });
});

describe('forecasts (UI-03)', () => {
  it('has 7 days from 03 Nov for every station and fuel (FR-18)', () => {
    expect(f.forecasts).toHaveLength(40);
    for (const fc of f.forecasts) {
      expect(fc.daily.map((d) => d.date)[0]).toBe('2026-11-03');
      expect(fc.model_version).toBe('fc-sim-1.1.0');
    }
  });

  it('flags only ST014 Diesel (66%) and the short-history ST020 Petrol 95 (60%) as uncertain', () => {
    const uncertain = f.forecasts.filter((x) => x.uncertain);
    expect(
      uncertain.map((x) => [x.station_id, x.fuel_type_id, x.overall_confidence, x.baseline]),
    ).toEqual([
      ['ST014', 'DIESEL', 66, 'own'],
      ['ST020', 'P95', 60, 'similar_stations'],
    ]);
    expect(uncertain[0]!.uncertain_reason).toBe(
      'Confidence is 66%: weather data is missing for 2 of 7 days.',
    );
  });

  it('totals equal the sum of the station forecasts, network and per warehouse (FR-85)', () => {
    for (const fuel of ['P95', 'DIESEL']) {
      const network = f.totals.network[fuel]!.groups[0]!.days;
      const groups = f.totals.warehouse[fuel]!.groups;
      network.forEach((day, d) => {
        const stations = f.forecasts
          .filter((x) => x.fuel_type_id === fuel)
          .reduce((a, x) => a + x.daily[d]!.litres, 0);
        expect(day.total_l).toBe(stations);
        expect(groups.reduce((a, g) => a + g.days[d]!.total_l, 0)).toBe(day.total_l);
      });
    }
  });
});

describe('optimal plan for 03 Nov 2026 (UI-05, SDD 7.2)', () => {
  it('has 6 routes, 17 stops, 2 unserved stations and 1 tanker on a second trip', () => {
    const view = f.optimal.view;
    expect(view.plan.plan_id).toBe('PL-2211');
    expect(view.routes).toHaveLength(6);
    expect(view.routes.flatMap((r) => r.stops)).toHaveLength(17);
    expect(new Set(view.unserved.map((u) => u.station_id))).toEqual(new Set(['ST019', 'ST006']));
    expect(view.routes.filter((r) => r.trip_no === 2).map((r) => r.tanker_id)).toEqual(['T-05']);
  });

  it('explains why each station is unserved (FR-38)', () => {
    const reasons = Object.fromEntries(
      f.optimal.view.unserved.map((u) => [u.station_id, u.reason]),
    );
    expect(reasons).toEqual({
      ST019: 'Diesel needs 11,700 L, but the tankers of WH-RIV have at most 11,500 L left',
      ST006: 'Petrol 95 does not fit the remaining tanker compartments at WH-RIV',
    });
  });

  it('respects every hard rule, and the unserved stations really fit on no tanker', () => {
    const state = buildState();
    expect(() => validatePlan(state.ctx, state.optimal)).not.toThrow();
    expect(fitsAnywhere(state.ctx, state.optimal, 'ST019')).toBe(false);
    expect(fitsAnywhere(state.ctx, state.optimal, 'ST006')).toBe(false);
  });

  it('costs each route at km × consumption × price, and totals add up to the cent (AC-16)', () => {
    const view = f.optimal.view;
    for (const r of view.routes) {
      const t = TANKERS.find((x) => x.id === r.tanker_id)!;
      expect(r.totals.cost_usd).toBe(
        roundHalfEven(r.totals.km * t.consumption * FUEL_PRICE_USD_PER_L, 2),
      );
    }
    const sum = view.routes.reduce((a, r) => a + r.totals.cost_usd! * 100, 0) / 100;
    expect(view.plan.totals.cost_usd).toBeCloseTo(sum, 9);
    expect(view.plan.totals.litres).toBe(view.routes.reduce((a, r) => a + r.totals.litres, 0));
  });

  it('flags the stops that use an uncertain forecast (FR-23)', () => {
    const uncertain = f.optimal.view.routes
      .flatMap((r) => r.stops)
      .filter((s) => s.uncertain)
      .map((s) => s.station_id);
    expect(uncertain.sort()).toEqual(['ST014', 'ST020']);
    expect(f.optimal.view.fallback_forecast).toEqual([
      { station_id: 'ST020', fuel_type_id: 'P95', confidence: 60 },
    ]);
  });

  it('has a quantity limit for every stop, with each kind of binding limit (BR-28)', () => {
    const bindings = new Set(Object.values(f.optimal.limits).map((l) => l.binding_limit));
    expect(bindings).toEqual(new Set(['tanker', 'tank', 'warehouse']));
    expect(f.optimal.limits['ST014|P95']!.binding_limit).toBe('tanker');
  });
});

describe('scripted edits (SDD 7.2)', () => {
  it('moving ST012 to T-02 overloads it and blocks approval (RISK-01)', () => {
    expect(f.scriptedEdits.moves.length).toBeGreaterThan(0);
    for (const m of f.scriptedEdits.moves) {
      expect(m.outcome.view.risks.some((r) => r.type === 'RISK-01' && r.blocks_approval)).toBe(
        true,
      );
      expect(m.outcome.view.approval_blocked).toBe(true);
    }
  });

  it('a reorder on T-03 gives RISK-04 medium; a reorder on T-01 gives no risk', () => {
    const t03 = f.scriptedEdits.reorders.find(
      (r) => r.route_id === 'R-03' && r.station_id === 'ST003' && r.position === 3,
    )!;
    expect(t03.outcome.view.risks.map((r) => `${r.type}:${r.severity}`)).toEqual([
      'RISK-04:medium',
    ]);
    const t01 = f.scriptedEdits.reorders.filter((r) => r.route_id === 'R-01');
    expect(t01.length).toBeGreaterThan(0);
    for (const r of t01) expect(r.outcome.view.risks).toEqual([]);
  });

  it('rejecting ST014 re-plans and serves ST019 (FR-82)', () => {
    const replan = f.scriptedEdits.replans.find((r) => r.rejected_station_id === 'ST014')!.outcome
      .view;
    const served = replan.routes.flatMap((r) => r.stops.map((s) => s.station_id));
    expect(served).toContain('ST019');
    expect(served).not.toContain('ST014');
    expect(replan.unserved.filter((u) => u.station_id === 'ST014').length).toBeGreaterThan(0);
  });
});

describe('trips and history', () => {
  it('records the SDD example gap of +45 min (+9.4%) on a returned trip (AC-19)', () => {
    const r07 = f.trips.find((t) => t.route_id === 'R-07')!;
    expect([r07.trip_status, r07.time_gap_min, r07.time_gap_pct]).toEqual(['returned', 45, 9.4]);
    expect(new Set(f.trips.map((t) => t.trip_status))).toEqual(
      new Set(['planned', 'departed', 'returned']),
    );
  });

  it('has 30 past decisions, newest first, of all three kinds (FR-73)', () => {
    expect(f.decisions).toHaveLength(30);
    const sorted = [...f.decisions].sort((a, b) => b.decided_at.localeCompare(a.decided_at));
    expect(f.decisions).toEqual(sorted);
    expect(new Set(f.decisions.map((d) => d.plan_label))).toEqual(
      new Set(['as recommended', 'modified', 'not dispatched']),
    );
  });
});
