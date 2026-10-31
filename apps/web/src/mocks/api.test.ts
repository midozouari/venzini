// @vitest-environment node
import {
  canCall,
  DecisionList,
  ENDPOINT_ACCESS,
  ErrorBody,
  MeResponse,
  Network,
  PlanDecisionResponse,
  PlanView,
  Resources,
  StopDecisionResponse,
  Trip,
  type EndpointId,
  type Role,
} from '@venzini/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { server } from './node';
import { store } from './store';

const BASE = 'http://localhost/api/v1';
const DAY = '2026-11-03';

async function call(method: string, path: string, body?: unknown, csrf = true) {
  const write = method !== 'GET';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(write && csrf ? { 'X-Requested-With': 'venzini' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

const LOGINS: Record<Role, string> = { manager: 'sara.m', dispatcher: 'karim.b', admin: 'nadia.a' };
const login = (who: string, password = 'venzini-demo') =>
  call('POST', '/auth/login', { login: who, password });
const errorCode = (r: { body: unknown }) => ErrorBody.parse(r.body).error.code;

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());
beforeEach(() => store.reset());

describe('role matrix on every endpoint (SDD 6.1.1, TC-SEC-01, AC-01)', () => {
  const requests: [EndpointId, string, string, unknown?][] = [
    ['API-03', 'GET', '/me'],
    ['API-04', 'GET', '/users'],
    ['API-04', 'POST', '/users', {}],
    ['API-05', 'GET', '/stations'],
    ['API-05', 'POST', '/stations', {}],
    ['API-06', 'GET', `/resources/${DAY}`],
    ['API-07', 'PUT', `/resources/${DAY}`, {}],
    ['API-08', 'PATCH', '/trips/R-09', {}],
    ['API-09', 'GET', '/network'],
    ['API-10', 'GET', '/forecasts?station=ST014&fuel=DIESEL'],
    ['API-11', 'POST', '/plans', {}],
    ['API-12', 'GET', '/plans/PL-2211'],
    ['API-13', 'POST', '/plans/PL-2211/edits', {}],
    ['API-14', 'GET', '/plans/PL-2211/limits?stop=S-01&fuel=P95'],
    ['API-15', 'POST', '/plans/PL-2211/stops/S-01/decision', {}],
    ['API-16', 'POST', '/plans/PL-2211/decision', {}],
    ['API-17', 'GET', '/decisions'],
    ['API-18', 'GET', '/decisions/unknown'],
    ['API-19', 'GET', '/forecasts/totals?level=warehouse&fuel=P95'],
    ['API-P1', 'GET', '/reference'],
    ['API-P2', 'GET', `/plans?day=${DAY}`],
    ['API-P3', 'GET', '/trips?day=2026-11-01'],
  ];

  it('covers every endpoint of the table', () => {
    const covered = new Set(requests.map((r) => r[0]));
    const all = Object.keys(ENDPOINT_ACCESS).filter(
      (e) => !['API-01', 'API-02', 'API-P4'].includes(e),
    );
    expect([...covered].sort()).toEqual(all.sort());
  });

  for (const role of ['manager', 'dispatcher', 'admin'] as Role[])
    it(`allows and refuses exactly what the ${role} may do`, async () => {
      expect((await login(LOGINS[role])).status).toBe(200);
      for (const [endpoint, method, path, body] of requests) {
        const r = await call(method, path, body);
        const refused = r.status === 403 && errorCode(r) === 'ERR-AUTH-04';
        expect({ endpoint, method, refused }).toEqual({
          endpoint,
          method,
          refused: !canCall(endpoint, role),
        });
      }
    });

  it('answers 401 without a session and lets public endpoints through', async () => {
    const r = await call('GET', '/network');
    expect([r.status, errorCode(r)]).toEqual([401, 'ERR-AUTH-05']);
    expect((await call('GET', '/health')).body).toEqual({ status: 'ok' });
  });

  it('refuses a write without the security header (ERR-AUTH-06) and sends a correlation ID', async () => {
    const r = await call(
      'POST',
      '/auth/login',
      { login: 'sara.m', password: 'venzini-demo' },
      false,
    );
    expect([r.status, errorCode(r)]).toEqual([403, 'ERR-AUTH-06']);
    expect(r.headers.get('X-Correlation-Id')).toBeTruthy();
  });
});

describe('login (UC-01, FR-01, NFR-21)', () => {
  it('opens the home page of each role', async () => {
    for (const [role, home] of [
      ['manager', '/network'],
      ['dispatcher', '/resources'],
      ['admin', '/admin'],
    ] as const) {
      const r = await login(LOGINS[role]);
      expect(r.body.home).toBe(home);
      const me = MeResponse.parse((await call('GET', '/me')).body);
      expect(me.user.role).toBe(role);
    }
  });

  it('gives the same message for an unknown login and a wrong password', async () => {
    expect(errorCode(await login('nobody'))).toBe('ERR-AUTH-01');
    expect(errorCode(await login('sara.m', 'wrong-password'))).toBe('ERR-AUTH-01');
  });

  it('refuses a deactivated account and shows the minutes left on a locked one', async () => {
    expect(errorCode(await login('omar.b'))).toBe('ERR-AUTH-02');
    const locked = await login('rania.m');
    expect(errorCode(locked)).toBe('ERR-AUTH-03');
    expect(locked.body.error.message).toBe('Too many attempts. Try again in 12 minutes.');
  });

  it('locks an account after 5 failed attempts', async () => {
    for (let i = 0; i < 4; i++)
      expect(errorCode(await login('karim.b', 'bad-password'))).toBe('ERR-AUTH-01');
    expect(errorCode(await login('karim.b', 'bad-password'))).toBe('ERR-AUTH-03');
    expect(errorCode(await login('karim.b'))).toBe('ERR-AUTH-03');
  });

  it('ends the session on logout', async () => {
    await login('sara.m');
    expect((await call('POST', '/auth/logout')).status).toBe(204);
    expect((await call('GET', '/me')).status).toBe(401);
  });
});

describe('network, forecasts and totals (UC-03, UC-04)', () => {
  it('shows 20 stations with alerts and the station without data', async () => {
    await login('sara.m');
    const n = Network.parse((await call('GET', '/network')).body);
    expect(n.stations).toHaveLength(20);
    expect(n.kpis).toMatchObject({
      high_risk_stations: 3,
      tankers_available: 5,
      tankers_total: 6,
      plan_status: null,
    });
    expect(n.data_unavailable.map((d) => d.station_id)).toEqual(['ST017']);
  });

  it('gives the dispatcher warehouse totals only (D-17)', async () => {
    await login('karim.b');
    expect(errorCode(await call('GET', '/forecasts/totals?level=network&fuel=P95'))).toBe(
      'ERR-AUTH-04',
    );
    const r = await call('GET', '/forecasts/totals?level=warehouse&fuel=P95&warehouse=WH-RIV');
    expect(r.status).toBe(200);
    expect(r.body.groups.map((g: { warehouse_id: string }) => g.warehouse_id)).toEqual(['WH-RIV']);
  });
});

describe('resources and trips (UC-02, UC-10)', () => {
  it('saves a new version, warns about a tanker still on a trip, and shows who saved', async () => {
    await login('karim.b');
    const res = Resources.parse((await call('GET', `/resources/${DAY}`)).body);
    expect(res.tankers.find((t) => t.tanker_id === 'T-06')!.open_trip).toEqual({
      route_id: 'R-11',
      delivery_day: '2026-11-01',
    });
    const save = await call('PUT', `/resources/${DAY}`, {
      tankers: [{ tanker_id: 'T-06', available: true }],
      drivers: [],
      stock: [],
    });
    expect(save.body).toMatchObject({ resource_version_id: 'RV-0193', version_no: 4 });
    expect(save.body.warnings[0]).toMatchObject({
      code: 'WARN-RES-01',
      tanker_id: 'T-06',
      route_id: 'R-11',
    });
    expect((await call('GET', `/resources/${DAY}`)).body.updated_by.full_name).toBe('Karim B.');
  });

  it('refuses a locked day, a negative stock and an unchanged save', async () => {
    await login('karim.b');
    const locked = await call('PUT', '/resources/2026-11-01', {
      tankers: [{ tanker_id: 'T-01', available: false }],
      drivers: [],
      stock: [],
    });
    expect(locked.body.error.message).toBe(
      'The plan for 01 Nov 2026 is already decided. This data can no longer be changed.',
    );
    const negative = await call('PUT', `/resources/${DAY}`, {
      tankers: [],
      drivers: [],
      stock: [{ warehouse_id: 'WH-RIV', fuel_type_id: 'P95', stock_l: -5 }],
    });
    expect([errorCode(negative), negative.body.error.field]).toEqual([
      'ERR-VAL-02',
      'stock[0].stock_l',
    ]);
    expect(
      errorCode(await call('PUT', `/resources/${DAY}`, { tankers: [], drivers: [], stock: [] })),
    ).toBe('ERR-VAL-02');
    expect((await call('GET', '/resources/2026-11-02')).status).toBe(404);
  });

  it('records departure then return, with the gap; cancels only planned trips (FR-79, FR-84)', async () => {
    await login('karim.b');
    const dep = await call('PATCH', '/trips/R-09', { actual_departure: '2026-11-01T04:10:00Z' });
    expect(Trip.parse(dep.body).trip_status).toBe('departed');
    const bad = await call('PATCH', '/trips/R-09', { actual_return: '2026-11-01T03:00:00Z' });
    expect([errorCode(bad), bad.body.error.field]).toEqual(['ERR-VAL-02', 'actual_return']);
    const ret = await call('PATCH', '/trips/R-09', { actual_return: '2026-11-01T12:10:00Z' });
    expect(ret.body).toMatchObject({ trip_status: 'returned', time_gap_min: 20 });
    expect(
      errorCode(await call('PATCH', '/trips/R-11', { cancel: true, reason: 'Breakdown' })),
    ).toBe('ERR-VAL-04');
    expect(
      (await call('PATCH', '/trips/R-12', { cancel: true, reason: 'Tanker breakdown' })).body
        .trip_status,
    ).toBe('cancelled');
    const future = await call('PATCH', '/trips/R-12', { actual_departure: '2026-11-05T05:00:00Z' });
    expect(errorCode(future)).toBe('ERR-VAL-04');
  });
});

describe('planner and approvals with the scripted outcomes (UC-05 to UC-07, SDD 7.2)', () => {
  async function generate() {
    await login('sara.m');
    expect((await call('GET', `/plans?day=${DAY}`)).status).toBe(404);
    const r = await call('POST', '/plans', { delivery_day: DAY });
    expect(r.status).toBe(201);
    return PlanView.parse(r.body);
  }
  const stopOf = (v: PlanView, station: string) =>
    v.routes.flatMap((r) => r.stops).find((s) => s.station_id === station)!;
  const routeOf = (v: PlanView, tanker: string, trip = 1) =>
    v.routes.find((r) => r.tanker_id === tanker && r.trip_no === trip)!;

  it('generates the optimal plan PL-2211 and refuses a day without resources', async () => {
    const plan = await generate();
    expect([plan.plan.plan_id, plan.routes.length, plan.comparison]).toEqual(['PL-2211', 6, null]);
    expect(errorCode(await call('POST', '/plans', { delivery_day: '2026-11-02' }))).toBe(
      'ERR-PLAN-02',
    );
  });

  it('move ST012 to T-02 → overload blocks approval; Reset restores the optimal plan', async () => {
    const plan = await generate();
    const moved = PlanView.parse(
      (
        await call('POST', `/plans/${plan.plan.plan_id}/edits`, {
          kind: 'move',
          expected_version: 1,
          stop_id: stopOf(plan, 'ST012').stop_id,
          to_route_id: routeOf(plan, 'T-02').route_id,
          position: 2,
        })
      ).body,
    );
    expect([moved.plan.kind, moved.approval_blocked]).toEqual(['edited', true]);
    expect(moved.risks.find((r) => r.type === 'RISK-01')!.reason).toMatch(
      /^Tanker T-02 is overloaded/,
    );
    const blocked = await call(
      'POST',
      `/plans/${moved.plan.plan_id}/stops/${stopOf(moved, 'ST008').stop_id}/decision`,
      { decision: 'approve', expected_version: moved.plan.version },
    );
    expect(errorCode(blocked)).toBe('ERR-PLAN-04');
    expect(
      errorCode(
        await call('POST', `/plans/${moved.plan.plan_id}/decision`, {
          decision: 'approve_all',
          expected_version: moved.plan.version,
        }),
      ),
    ).toBe('ERR-PLAN-04');
    const reset = PlanView.parse(
      (
        await call('POST', `/plans/${moved.plan.plan_id}/edits`, {
          kind: 'reset',
          expected_version: moved.plan.version,
        })
      ).body,
    );
    expect([reset.plan.plan_id, reset.risks, reset.approval_blocked]).toEqual([
      'PL-2211',
      [],
      false,
    ]);
  });

  it('reorder on T-03 → RISK-04 medium; reorder on T-01 → no risk; stale version → ERR-API-03', async () => {
    const plan = await generate();
    const t03 = await call('POST', `/plans/PL-2211/edits`, {
      kind: 'reorder',
      expected_version: 1,
      stop_id: stopOf(plan, 'ST003').stop_id,
      position: 3,
    });
    expect(PlanView.parse(t03.body).risks.map((r) => `${r.type}:${r.severity}`)).toEqual([
      'RISK-04:medium',
    ]);
    expect(
      errorCode(
        await call('POST', `/plans/${t03.body.plan.plan_id}/edits`, {
          kind: 'reset',
          expected_version: 1,
        }),
      ),
    ).toBe('ERR-API-03');
    const reset = await call('POST', `/plans/${t03.body.plan.plan_id}/edits`, {
      kind: 'reset',
      expected_version: 2,
    });
    const t01 = await call('POST', `/plans/PL-2211/edits`, {
      kind: 'reorder',
      expected_version: reset.body.plan.version,
      stop_id: stopOf(plan, 'ST014').stop_id,
      position: 1,
    });
    expect([t01.body.plan.kind, t01.body.risks]).toEqual(['edited', []]);
  });

  it('refuses a move to another warehouse (WARN-EDIT-01) and a quantity above the limit (ERR-VAL-05a)', async () => {
    const plan = await generate();
    const other = await call('POST', '/plans/PL-2211/edits', {
      kind: 'move',
      expected_version: 1,
      stop_id: stopOf(plan, 'ST012').stop_id,
      to_route_id: routeOf(plan, 'T-03').route_id,
      position: 1,
    });
    expect([other.status, errorCode(other)]).toEqual([422, 'WARN-EDIT-01']);
    const stop = stopOf(plan, 'ST014');
    const limits = (await call('GET', `/plans/PL-2211/limits?stop=${stop.stop_id}&fuel=P95`)).body;
    expect(limits.binding_limit).toBe('tanker');
    const above = await call('POST', '/plans/PL-2211/edits', {
      kind: 'quantity',
      expected_version: 1,
      stop_id: stop.stop_id,
      fuel_type_id: 'P95',
      litres: limits.max_l + 1,
    });
    expect([errorCode(above), above.body.error.field]).toEqual(['ERR-VAL-05a', 'litres']);
    const ok = await call('POST', '/plans/PL-2211/edits', {
      kind: 'quantity',
      expected_version: 1,
      stop_id: stop.stop_id,
      fuel_type_id: 'P95',
      litres: limits.max_l,
    });
    expect(ok.status).toBe(200);
    expect(
      stopOf(PlanView.parse(ok.body), 'ST014').quantities.find((q) => q.fuel_type_id === 'P95')!
        .final_l,
    ).toBe(limits.max_l);
  });

  it('asks to confirm before a quantity edit replaces route edits (FR-59)', async () => {
    const plan = await generate();
    const r = await call('POST', '/plans/PL-2211/edits', {
      kind: 'reorder',
      expected_version: 1,
      stop_id: stopOf(plan, 'ST014').stop_id,
      position: 1,
    });
    const q = {
      kind: 'quantity',
      expected_version: 2,
      stop_id: stopOf(plan, 'ST012').stop_id,
      fuel_type_id: 'P95',
      litres: 100,
    };
    const ask = await call('POST', `/plans/${r.body.plan.plan_id}/edits`, q);
    expect([errorCode(ask), ask.body.error.field]).toEqual([
      'ERR-VAL-01',
      'confirm_replace_route_edits',
    ]);
    expect(
      (
        await call('POST', `/plans/${r.body.plan.plan_id}/edits`, {
          ...q,
          confirm_replace_route_edits: true,
        })
      ).status,
    ).toBe(200);
  });

  it('reject ST014 → re-plan serves ST019 and keeps unchanged approvals (FR-82, D-23)', async () => {
    const plan = await generate();
    const st009 = stopOf(plan, 'ST009');
    const approved = StopDecisionResponse.parse(
      (
        await call('POST', `/plans/PL-2211/stops/${st009.stop_id}/decision`, {
          decision: 'approve',
          expected_version: 1,
        })
      ).body,
    );
    expect(approved.plan.status).toBe('partly_decided');
    const rej = StopDecisionResponse.parse(
      (
        await call('POST', `/plans/PL-2211/stops/${stopOf(plan, 'ST014').stop_id}/decision`, {
          decision: 'reject',
          expected_version: approved.plan.version,
          note: 'Station closed for works.',
        })
      ).body,
    );
    expect(rej.replan).toMatchObject({
      previous_plan_id: 'PL-2211',
      not_dispatched: { station_id: 'ST014', risk_level: 'high' },
      newly_served: ['ST019'],
    });
    const now = PlanView.parse((await call('GET', `/plans?day=${DAY}`)).body);
    expect(stopOf(now, 'ST009').decision_status).toBe('approved');
    expect(rej.replan!.kept_approved).toEqual([stopOf(now, 'ST009').stop_id]);
  });

  it('approve all → plan decided, one log entry per action plus one, resources locked, trips to record (FR-80, BR-30)', async () => {
    const plan = await generate();
    const before = DecisionList.parse((await call('GET', '/decisions?page_size=200')).body).total;
    const r = PlanDecisionResponse.parse(
      (
        await call('POST', '/plans/PL-2211/decision', {
          decision: 'approve_all',
          expected_version: 1,
        })
      ).body,
    );
    expect([r.plan.status, r.decided_actions, r.log_entry_ids.length, r.resources_locked]).toEqual([
      'decided',
      17,
      18,
      true,
    ]);
    const history = DecisionList.parse((await call('GET', '/decisions?page_size=200')).body);
    expect(history.total).toBe(before + 18);
    expect(history.items[0]!.manager.full_name).toBe('Sara M.');
    expect(
      errorCode(
        await call('POST', '/plans/PL-2211/edits', {
          kind: 'reset',
          expected_version: r.plan.version,
        }),
      ),
    ).toBe('ERR-VAL-04');
    expect((await call('GET', `/trips?day=${DAY}`)).body.total).toBe(plan.routes.length);
    await login('karim.b');
    expect(
      errorCode(
        await call('PUT', `/resources/${DAY}`, {
          tankers: [{ tanker_id: 'T-01', available: false }],
          drivers: [],
          stock: [],
        }),
      ),
    ).toBe('ERR-VAL-04');
  });
});

describe('history and administration (UC-08, UC-09, UC-11)', () => {
  it('lists 30 past decisions newest first for every role, with filters', async () => {
    for (const who of ['sara.m', 'karim.b', 'nadia.a']) {
      await login(who);
      const list = DecisionList.parse((await call('GET', '/decisions')).body);
      expect(list.total).toBe(30);
    }
    const modified = DecisionList.parse((await call('GET', '/decisions?type=modified')).body);
    expect(modified.items.every((i) => i.plan_label === 'modified')).toBe(true);
    expect(errorCode(await call('GET', '/decisions?from=2026-11-02&to=2026-11-01'))).toBe(
      'ERR-VAL-02',
    );
  });

  it('creates a user who can then log in; refuses a duplicate login and self-deactivation', async () => {
    const admin = await login('nadia.a');
    const created = await call('POST', '/users', {
      full_name: 'Mehdi R.',
      login: 'mehdi.r',
      password: 'init-Passw0rd',
      role: 'dispatcher',
    });
    expect(created.status).toBe(201);
    expect(
      errorCode(
        await call('POST', '/users', {
          full_name: 'X',
          login: 'MEHDI.R',
          password: 'init-Passw0rd',
          role: 'admin',
        }),
      ),
    ).toBe('ERR-VAL-03');
    expect(
      errorCode(await call('PATCH', `/users/${admin.body.user.id}`, { status: 'inactive' })),
    ).toBe('ERR-VAL-07');
    expect((await login('mehdi.r', 'init-Passw0rd')).body.home).toBe('/resources');
  });

  it('lets the manager add a station, which then appears on the map without data (FR-06)', async () => {
    await login('sara.m');
    const station = {
      station_id: 'ST021',
      name: 'Lac 2 Centre',
      latitude: 36.8421,
      longitude: 10.2731,
      region: 'Tunis North',
      window_open: '06:00',
      window_close: '18:00',
      tanks: [
        { fuel_type_id: 'P95', capacity_l: 30000, safety_stock_l: 6000, current_level_l: 14200 },
      ],
    };
    expect((await call('POST', '/stations', station)).status).toBe(201);
    expect(errorCode(await call('POST', '/stations', station))).toBe('ERR-VAL-03');
    const bad = await call('POST', '/stations', {
      ...station,
      station_id: 'ST022',
      tanks: [{ ...station.tanks[0], safety_stock_l: 40000 }],
    });
    expect(bad.body.error.field).toBe('tanks[0].safety_stock_l');
    const n = Network.parse((await call('GET', '/network')).body);
    expect(n.data_unavailable.map((d) => d.station_id)).toContain('ST021');
  });
});
