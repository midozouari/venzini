// API-06, API-07 resources; API-08, API-P3 trips (SDD 5.6.3, SEQ-07, SEQ-08, SM-03).
import {
  DayQuery,
  formatMessage,
  LocalDate,
  round1,
  SaveResourcesRequest,
  UpdateTripRequest,
  type Resources,
  type SaveResourcesResponse,
  type Trip,
} from '@venzini/contracts';
import { http } from 'msw';
import { nowIso, nowMs } from '../clock';
import { fixtures } from '../fixtures';
import { api, fail, json, readBody, readQuery, route } from '../http';
import { clone, store } from '../store';
import { displayDay } from './util';

/** A departed trip that has not returned blocks nothing but raises WARN-RES-01 (FR-07). */
function openTrip(tankerId: string, day: string): Trip | undefined {
  return store.state.trips.find(
    (t) => t.tanker_id === tankerId && t.trip_status === 'departed' && t.delivery_day !== day,
  );
}

function withOpenTrips(r: Resources): Resources {
  return {
    ...clone(r),
    tankers: r.tankers.map((t) => {
      const trip = openTrip(t.tanker_id, r.delivery_day);
      return {
        ...t,
        open_trip: trip ? { route_id: trip.route_id, delivery_day: trip.delivery_day } : null,
      };
    }),
  };
}

/** Master data used for the first save of a day without resources. */
function emptyDay(day: string): Resources {
  const base = fixtures.resources[fixtures.demo.default_delivery_day]!;
  return {
    ...clone(base),
    delivery_day: day,
    resource_version_id: '',
    version_no: 0,
    locked: false,
    tankers: base.tankers.map((t) => ({ ...t, available: false })),
    drivers: base.drivers.map((d) => ({ ...d, available: false })),
    stock: base.stock.map((s) => ({ ...s, stock_l: 0 })),
  };
}

export const resourceHandlers = [
  http.get<{ day: string }>(
    api('/resources/:day'),
    route('API-06', ({ params }) => {
      if (!LocalDate.safeParse(params.day).success)
        return fail(
          'ERR-VAL-02',
          { field: 'Day', rule: 'must be a date (YYYY-MM-DD)' },
          { field: 'day' },
        );
      const r = store.state.resources[params.day];
      return r ? json(withOpenTrips(r)) : fail('ERR-API-01'); // UI: "No resources uploaded for this day" (FR-13)
    }),
  ),

  http.put<{ day: string }>(
    api('/resources/:day'),
    route('API-07', async ({ request, params, user }) => {
      const day = params.day;
      if (!LocalDate.safeParse(day).success)
        return fail(
          'ERR-VAL-02',
          { field: 'Day', rule: 'must be a date (YYYY-MM-DD)' },
          { field: 'day' },
        );
      const body = await readBody(request, SaveResourcesRequest);
      if ('error' in body) return body.error;
      const current = store.state.resources[day];
      if (current?.locked) return fail('ERR-VAL-04', { day: displayDay(day) }); // BR-30
      const base = current ?? emptyDay(day);
      const next = clone(base);

      for (const [i, t] of body.data.tankers.entries()) {
        const row = next.tankers.find((x) => x.tanker_id === t.tanker_id);
        if (!row)
          return fail(
            'ERR-VAL-02',
            { field: 'Tanker ID', rule: 'must be an active tanker' },
            { field: `tankers[${i}].tanker_id` },
          );
        row.available = t.available;
      }
      for (const [i, d] of body.data.drivers.entries()) {
        const row = next.drivers.find((x) => x.driver_id === d.driver_id);
        if (!row)
          return fail(
            'ERR-VAL-02',
            { field: 'Driver ID', rule: 'must be an active driver' },
            { field: `drivers[${i}].driver_id` },
          );
        row.available = d.available;
      }
      for (const [i, s] of body.data.stock.entries()) {
        const row = next.stock.find(
          (x) => x.warehouse_id === s.warehouse_id && x.fuel_type_id === s.fuel_type_id,
        );
        if (!row)
          return fail(
            'ERR-VAL-02',
            { field: 'Warehouse ID', rule: 'must be an active warehouse and fuel type' },
            { field: `stock[${i}].warehouse_id` },
          );
        row.stock_l = s.stock_l;
      }
      const changed =
        JSON.stringify([next.tankers, next.drivers, next.stock]) !==
        JSON.stringify([base.tankers, base.drivers, base.stock]);
      if (current && !changed)
        return fail('ERR-VAL-02', {
          field: 'Resources',
          rule: 'change at least one value before saving',
        });

      next.resource_version_id = store.nextResourceVersionId();
      next.version_no = base.version_no + 1;
      next.updated_by = { id: user!.id, full_name: user!.full_name };
      next.updated_at = nowIso();
      next.tankers = next.tankers.map((t) => ({ ...t, open_trip: null }));
      store.state.resources[day] = next;

      const warnings = next.tankers
        .filter((t) => t.available)
        .flatMap((t) => {
          const trip = openTrip(t.tanker_id, day);
          return trip
            ? [
                {
                  code: 'WARN-RES-01' as const,
                  tanker_id: t.tanker_id,
                  route_id: trip.route_id,
                  message: formatMessage('WARN-RES-01', {
                    tanker: t.tanker_id,
                    trip: trip.route_id,
                  }),
                },
              ]
            : [];
        });
      const response: SaveResourcesResponse = {
        resource_version_id: next.resource_version_id,
        version_no: next.version_no,
        warnings,
      };
      return json(response);
    }),
  ),

  http.get(
    api('/trips'),
    route('API-P3', ({ request }) => {
      const q = readQuery(request, DayQuery);
      if ('error' in q) return q.error;
      const items = store.state.trips.filter((t) => t.delivery_day === q.data.day);
      return json({ items, page: 1, page_size: Math.max(1, items.length), total: items.length });
    }),
  ),

  http.patch<{ routeId: string }>(
    api('/trips/:routeId'),
    route('API-08', async ({ request, params }) => {
      const trip = store.state.trips.find((t) => t.route_id === params.routeId);
      if (!trip) return fail('ERR-API-01');
      const body = await readBody(request, UpdateTripRequest);
      if ('error' in body) return body.error;
      const day = displayDay(trip.delivery_day);
      const d = body.data;

      if ('cancel' in d) {
        // SM-03: only a planned trip can be cancelled.
        if (trip.trip_status !== 'planned') return fail('ERR-VAL-04', { day });
        Object.assign(trip, { trip_status: 'cancelled', cancel_reason: d.reason });
        return json(trip);
      }
      if (trip.trip_status === 'returned' || trip.trip_status === 'cancelled')
        return fail('ERR-VAL-04', { day });
      const departure = d.actual_departure ?? trip.actual_departure;
      const ret = d.actual_return ?? null;
      if (!departure)
        return fail('ERR-VAL-01', { field: 'Actual departure' }, { field: 'actual_departure' });
      if (Date.parse(departure) > nowMs())
        return fail(
          'ERR-VAL-02',
          { field: 'Actual departure', rule: "can't be in the future" },
          { field: 'actual_departure' },
        );
      if (ret && Date.parse(ret) <= Date.parse(departure))
        return fail(
          'ERR-VAL-02',
          { field: 'Actual return', rule: 'must be after the departure' },
          { field: 'actual_return' },
        );
      if (ret && Date.parse(ret) > nowMs())
        return fail(
          'ERR-VAL-02',
          { field: 'Actual return', rule: "can't be in the future" },
          { field: 'actual_return' },
        );

      trip.actual_departure = departure;
      trip.trip_status = 'departed';
      if (ret) {
        // FR-84: gap = actual duration − estimated duration.
        const est = (Date.parse(trip.est_return) - Date.parse(trip.est_departure)) / 60_000;
        const actual = (Date.parse(ret) - Date.parse(departure)) / 60_000;
        trip.actual_return = ret;
        trip.trip_status = 'returned';
        trip.time_gap_min = Math.round(actual - est);
        trip.time_gap_pct = round1(((actual - est) / est) * 100);
      }
      return json(trip);
    }),
  ),
];
