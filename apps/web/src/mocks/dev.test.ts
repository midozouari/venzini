// @vitest-environment node
// Developer toolbar controls (SDD 7.1): scenario sets and forced error responses.
import { DecisionList, ErrorBody } from '@venzini/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { dev, loadScenario, setForced, signInAs } from './dev';
import { server } from './node';
import { store } from './store';

const BASE = 'http://localhost/api/v1';
const DAY = '2026-11-03';

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(method !== 'GET' ? { 'X-Requested-With': 'venzini' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
const error = (r: { body: unknown }) => ErrorBody.parse(r.body).error;
const generate = () => call('POST', '/plans', { delivery_day: DAY });

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  dev.forced.clear();
  loadScenario('normal');
  store.state.sessionUserId = null;
});

describe('scenario sets', () => {
  it('SC-03: no drivers on the demo day, so no plan can be made (ERR-PLAN-01)', async () => {
    signInAs('sara.m');
    loadScenario('no-drivers');
    expect(store.currentUser()?.login).toBe('sara.m'); // the session is kept
    const r = await generate();
    expect([r.status, error(r).message]).toEqual([
      422,
      'No plan can be made: no drivers for 03 Nov 2026.',
    ]);
  });

  it('no resources uploaded, and an empty history', async () => {
    signInAs('sara.m');
    loadScenario('no-resources');
    expect(error(await call('GET', `/resources/${DAY}`)).code).toBe('ERR-API-01');
    loadScenario('no-decisions');
    expect(DecisionList.parse((await call('GET', '/decisions')).body).total).toBe(0);
    loadScenario('normal');
    expect(DecisionList.parse((await call('GET', '/decisions')).body).total).toBe(30);
  });
});

describe('forced errors', () => {
  it('answer only while switched on, and only after the session and role checks', async () => {
    setForced('ERR-PLAN-01', true);
    expect(error(await generate()).code).toBe('ERR-AUTH-05'); // no session: the real check wins
    signInAs('karim.b');
    expect(error(await generate()).code).toBe('ERR-AUTH-04'); // dispatcher may not plan
    signInAs('sara.m');
    expect(error(await generate()).code).toBe('ERR-PLAN-01');
    setForced('ERR-PLAN-01', false);
    expect((await generate()).status).toBe(201);
  });

  it('ERR-SYS-01 and ERR-VAL-04 on plan edits, ERR-VAL-04 on decisions and resource saves', async () => {
    signInAs('sara.m');
    const plan = (await generate()).body;
    const edit = () =>
      call('POST', `/plans/${plan.plan.plan_id}/edits`, {
        kind: 'reset',
        expected_version: plan.plan.version,
      });
    setForced('ERR-SYS-01', true);
    expect([(await edit()).status, error(await edit()).code]).toEqual([500, 'ERR-SYS-01']);
    setForced('ERR-SYS-01', false);
    setForced('ERR-VAL-04', true);
    expect(error(await edit()).message).toBe(
      'The plan for 03 Nov 2026 is already decided. This data can no longer be changed.',
    );
    const stop = plan.routes[0].stops[0].stop_id;
    expect(
      error(
        await call('POST', `/plans/${plan.plan.plan_id}/stops/${stop}/decision`, {
          decision: 'approve',
          expected_version: plan.plan.version,
        }),
      ).code,
    ).toBe('ERR-VAL-04');
    signInAs('karim.b');
    expect(
      error(await call('PUT', `/resources/${DAY}`, { tankers: [], drivers: [], stock: [] })).code,
    ).toBe('ERR-VAL-04');
  });

  it('are kept when the demo data is reset', () => {
    setForced('ERR-SYS-01', true);
    loadScenario('normal');
    expect(dev.forced.has('ERR-SYS-01')).toBe(true);
  });
});
