// Developer controls of the MVP mock API (SDD 7.1 "Errors on demand"): scenario sets and forced
// error responses, used by the hidden developer toolbar. MVP builds only; nothing here reaches v1.
import { canCall, type EndpointId } from '@venzini/contracts';
import { http, type HttpResponseResolver, type PathParams } from 'msw';
import { fixtures } from './fixtures';
import { displayDay } from './handlers/util';
import { api, fail } from './http';
import { store } from './store';

const DEMO_DAY = fixtures.demo.default_delivery_day;

/**
 * Scenario sets the mock can show by changing data only (SRS 16.1). SC-02 and SC-04 to SC-08 need
 * real routing and risk calculations, so they come with v1.
 */
export const SCENARIOS = [
  {
    id: 'normal',
    label: 'Normal day',
    tag: 'SC-01',
    description: 'The sample data as delivered: enough tankers, drivers and stock.',
  },
  {
    id: 'no-drivers',
    label: 'Critical resource missing',
    tag: 'SC-03',
    description: 'No driver is available on 03 Nov 2026, so no plan can be made (ERR-PLAN-01).',
  },
  {
    id: 'no-resources',
    label: 'No resources uploaded',
    tag: 'FR-13',
    description: 'The dispatcher has not uploaded the resources of 03 Nov 2026 yet.',
  },
  {
    id: 'no-decisions',
    label: 'No decisions yet',
    tag: 'UI-07',
    description: 'The decision history is empty.',
  },
] as const;

export type ScenarioId = (typeof SCENARIOS)[number]['id'];

export const FORCED_ERRORS = [
  { code: 'ERR-PLAN-01', where: 'Generate plan' },
  { code: 'ERR-VAL-04', where: 'Plan edits, decisions and resource saves' },
  { code: 'ERR-SYS-01', where: 'Plan edits' },
] as const;

export type ForcedError = (typeof FORCED_ERRORS)[number]['code'];

export const dev = {
  scenario: 'normal' as ScenarioId,
  forced: new Set<ForcedError>(),
};

function applyScenario(id: ScenarioId): void {
  const s = store.state;
  if (id === 'no-drivers') {
    const day = s.resources[DEMO_DAY];
    if (day) day.drivers = day.drivers.map((d) => ({ ...d, available: false }));
  }
  if (id === 'no-resources') delete s.resources[DEMO_DAY];
  if (id === 'no-decisions') s.decisions = [];
}

/** Fresh demo data in the chosen scenario. The session and the forced errors are kept. */
export function loadScenario(id: ScenarioId = dev.scenario): void {
  store.reset({ keepSession: true });
  dev.scenario = id;
  applyScenario(id);
}

export function setForced(code: ForcedError, on: boolean): void {
  if (on) dev.forced.add(code);
  else dev.forced.delete(code);
}

/** Signs in as a demo account straight away (the toolbar's demo flows start as `sara.m`). */
export function signInAs(login: string): void {
  const user = store.state.users.find((u) => u.login === login);
  if (user) store.state.sessionUserId = user.id;
}

const dayOfPlan = (planId: string) => {
  for (const [day, dp] of store.state.plans)
    if (dp.current.view.plan.plan_id === planId) return day;
  return DEMO_DAY;
};

/**
 * Answers with the forced error when it is switched on, after the same session and role checks as
 * the real endpoint; otherwise returns nothing, so the real handler answers.
 */
function forced<P extends PathParams>(
  endpoint: EndpointId,
  answer: (ctx: {
    request: Request;
    params: P;
  }) => Promise<Response | undefined> | Response | undefined,
): HttpResponseResolver<P> {
  return async ({ request, params }) => {
    if (dev.forced.size === 0) return undefined;
    const user = store.currentUser();
    if (!user || !canCall(endpoint, user.role)) return undefined;
    return answer({ request, params });
  };
}

const valDecided = (day: string) =>
  dev.forced.has('ERR-VAL-04') ? fail('ERR-VAL-04', { day: displayDay(day) }) : undefined;

export const devHandlers = [
  http.post(
    api('/plans'),
    forced('API-11', async ({ request }) => {
      const body = (await request
        .clone()
        .json()
        .catch(() => ({}))) as { delivery_day?: string };
      const day = body.delivery_day ?? DEMO_DAY;
      if (dev.forced.has('ERR-PLAN-01'))
        return fail('ERR-PLAN-01', { missing: 'no drivers', day: displayDay(day) });
      return undefined;
    }),
  ),
  http.post<{ id: string }>(
    api('/plans/:id/edits'),
    forced('API-13', ({ params }) => {
      if (dev.forced.has('ERR-SYS-01')) return fail('ERR-SYS-01');
      return valDecided(dayOfPlan(params.id));
    }),
  ),
  http.post<{ id: string; stopId: string }>(
    api('/plans/:id/stops/:stopId/decision'),
    forced('API-15', ({ params }) => valDecided(dayOfPlan(params.id))),
  ),
  http.post<{ id: string }>(
    api('/plans/:id/decision'),
    forced('API-16', ({ params }) => valDecided(dayOfPlan(params.id))),
  ),
  http.put<{ day: string }>(
    api('/resources/:day'),
    forced('API-07', ({ params }) => valDecided(params.day)),
  ),
];
