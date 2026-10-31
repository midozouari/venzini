// API-04 users and API-05 stations (SDD 5.6.3, UC-09, UC-11).
import {
  CreateStationRequest,
  CreateUserRequest,
  PageQuery,
  StationQuery,
  UpdateStationRequest,
  UpdateUserRequest,
  type Station,
  type User,
} from '@venzini/contracts';
import { http } from 'msw';
import { nowIso } from '../clock';
import { fixtures } from '../fixtures';
import { api, fail, json, readBody, readQuery, route } from '../http';
import { store, type UserRecord } from '../store';

const toUser = (u: UserRecord): User => ({
  id: u.id,
  full_name: u.full_name,
  login: u.login,
  role: u.role,
  status: u.status,
  created_at: u.created_at,
});

const page = <T>(items: T[], p: { page: number; page_size: number }) => ({
  items: items.slice((p.page - 1) * p.page_size, p.page * p.page_size),
  page: p.page,
  page_size: p.page_size,
  total: items.length,
});

const knownFuels = new Set(fixtures.reference.fuel_types.map((f) => f.fuel_type_id));

function unknownFuel(tanks: { fuel_type_id: string }[]) {
  const i = tanks.findIndex((t) => !knownFuels.has(t.fuel_type_id));
  return i < 0
    ? null
    : fail(
        'ERR-VAL-02',
        { field: 'Fuel type ID', rule: 'must be a known fuel type' },
        { field: `tanks[${i}].fuel_type_id` },
      );
}

export const adminHandlers = [
  http.get(
    api('/users'),
    route('API-04', ({ request }) => {
      const q = readQuery(request, PageQuery);
      if ('error' in q) return q.error;
      const users = [...store.state.users]
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map(toUser);
      return json(page(users, q.data));
    }),
  ),

  http.post(
    api('/users'),
    route('API-04', async ({ request }) => {
      const body = await readBody(request, CreateUserRequest);
      if ('error' in body) return body.error;
      const d = body.data;
      if (store.state.users.some((u) => u.login.toLowerCase() === d.login.toLowerCase()))
        return fail('ERR-VAL-03', { item: 'login' }, { field: 'login' });
      const user: UserRecord = {
        id: crypto.randomUUID(),
        full_name: d.full_name,
        login: d.login,
        role: d.role,
        status: 'active',
        created_at: nowIso(),
        password: d.password,
        locked_until: null,
        failures: [],
      };
      store.state.users.push(user);
      return json(toUser(user), 201);
    }),
  ),

  http.patch<{ id: string }>(
    api('/users/:id'),
    route('API-04', async ({ request, params, user: me }) => {
      const user = store.state.users.find((u) => u.id === params.id);
      if (!user) return fail('ERR-API-01');
      const body = await readBody(request, UpdateUserRequest);
      if ('error' in body) return body.error;
      const d = body.data;
      if (user.id === me!.id && d.status === 'inactive')
        return fail('ERR-VAL-07', {}, { field: 'status' });
      const revoke =
        (d.status === 'inactive' && user.status === 'active') ||
        (d.role !== undefined && d.role !== user.role);
      Object.assign(user, {
        ...(d.full_name !== undefined ? { full_name: d.full_name } : {}),
        ...(d.role !== undefined ? { role: d.role } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        ...(d.password !== undefined ? { password: d.password } : {}),
      });
      // Deactivation and role change end the user's session at once (SDD 6.1.2).
      if (revoke && store.state.sessionUserId === user.id) store.state.sessionUserId = null;
      return json(toUser(user));
    }),
  ),

  http.get(
    api('/stations'),
    route('API-05', ({ request }) => {
      const q = readQuery(request, StationQuery.extend(PageQuery.shape));
      if ('error' in q) return q.error;
      const list = store.state.stations.filter((s) => !q.data.status || s.status === q.data.status);
      return json(page(list, q.data));
    }),
  ),

  http.post(
    api('/stations'),
    route('API-05', async ({ request }) => {
      const body = await readBody(request, CreateStationRequest);
      if ('error' in body) return body.error;
      const d = body.data;
      if (store.state.stations.some((s) => s.station_id === d.station_id))
        return fail('ERR-VAL-03', { item: 'station ID' }, { field: 'station_id' });
      const bad = unknownFuel(d.tanks);
      if (bad) return bad;
      // No distances exist for a new station in the MVP, so it has no serving warehouse yet (TBL-06).
      const station: Station = { ...d, serving_warehouse_id: null, status: 'active' };
      store.state.stations.push(station);
      return json(station, 201);
    }),
  ),

  http.patch<{ id: string }>(
    api('/stations/:id'),
    route('API-05', async ({ request, params }) => {
      const station = store.state.stations.find((s) => s.station_id === params.id);
      if (!station) return fail('ERR-API-01');
      const body = await readBody(request, UpdateStationRequest);
      if ('error' in body) return body.error;
      const d = body.data;
      if (d.tanks) {
        const bad = unknownFuel(d.tanks);
        if (bad) return bad;
      }
      const open = d.window_open ?? station.window_open;
      const close = d.window_close ?? station.window_close;
      if (open >= close)
        return fail(
          'ERR-VAL-02',
          { field: 'Window close', rule: 'must be after the opening time' },
          { field: 'window_close' },
        );
      Object.assign(station, d);
      return json(station);
    }),
  ),
];
