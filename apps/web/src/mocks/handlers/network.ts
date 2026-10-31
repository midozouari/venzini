// API-09 network, API-10 forecasts, API-19 totals, API-P1 reference, API-P4 health (SDD 5.6.4).
import { ForecastQuery, NetworkQuery, TotalsQuery, type Network } from '@venzini/contracts';
import { http } from 'msw';
import { fixtures } from '../fixtures';
import { api, fail, json, readQuery, route } from '../http';
import { store } from '../store';

export const networkHandlers = [
  http.get(
    api('/network'),
    route('API-09', ({ request }) => {
      const q = readQuery(request, NetworkQuery);
      if ('error' in q) return q.error;
      const day = q.data.day ?? fixtures.demo.default_delivery_day;
      const base = fixtures.network;
      const stations: Network['stations'] = [];
      const unavailable: Network['data_unavailable'] = [...base.data_unavailable];

      // Station records can change in the session (UI-08): names, positions, status, new stations.
      for (const s of store.state.stations.filter((x) => x.status === 'active')) {
        const known = base.stations.find((x) => x.station_id === s.station_id);
        if (known) {
          stations.push({ ...known, name: s.name, latitude: s.latitude, longitude: s.longitude });
          continue;
        }
        stations.push({
          station_id: s.station_id,
          name: s.name,
          latitude: s.latitude,
          longitude: s.longitude,
          serving_warehouse_id: s.serving_warehouse_id,
          risk_level: null,
          data_available: false,
          tanks: s.tanks.map((t) => ({
            ...t,
            level_pct: null,
            risk_level: null,
            hours_to_stockout: null,
          })),
        });
        unavailable.push({
          station_id: s.station_id,
          code: 'ERR-DATA-01',
          reason: 'No forecast yet',
        });
      }
      const active = new Set(stations.map((s) => s.station_id));
      const resources = store.state.resources[day];

      const network: Network = {
        ...base,
        delivery_day: day,
        kpis: {
          high_risk_stations: stations.filter((s) => s.risk_level === 'high').length,
          tankers_available: resources?.tankers.filter((t) => t.available).length ?? 0,
          tankers_total: resources?.tankers.length ?? base.kpis.tankers_total,
          warehouse_stock: resources?.stock ?? [],
          plan_status: store.state.plans.get(day)?.current.view.plan.status ?? null,
        },
        stations,
        alerts: base.alerts.filter((a) => active.has(a.station_id)),
        data_unavailable: unavailable.filter((u) => active.has(u.station_id)),
      };
      return json(network);
    }),
  ),

  http.get(
    api('/forecasts/totals'),
    route('API-19', ({ request, user }) => {
      const q = readQuery(request, TotalsQuery);
      if ('error' in q) return q.error;
      // D-17: a dispatcher reads per-warehouse totals only, never station-level values.
      if (q.data.level === 'network' && user!.role !== 'manager') return fail('ERR-AUTH-04');
      const totals = fixtures.totals[q.data.level][q.data.fuel];
      if (!totals) return fail('ERR-API-01');
      const groups = q.data.warehouse
        ? totals.groups.filter((g) => g.warehouse_id === q.data.warehouse)
        : totals.groups;
      if (groups.length === 0) return fail('ERR-API-01');
      return json({ ...totals, groups });
    }),
  ),

  http.get(
    api('/forecasts'),
    route('API-10', ({ request }) => {
      const q = readQuery(request, ForecastQuery);
      if ('error' in q) return q.error;
      const { station, fuel, ref_date } = q.data;
      if (ref_date && ref_date !== fixtures.demo.reference_date) return fail('ERR-API-01');
      const forecast = fixtures.forecasts.find(
        (f) => f.station_id === station && f.fuel_type_id === fuel,
      );
      return forecast ? json(forecast) : fail('ERR-API-01');
    }),
  ),

  http.get(
    api('/reference'),
    route('API-P1', () => json(fixtures.reference)),
  ),

  http.get(
    api('/health'),
    route('API-P4', () => json({ status: 'ok' as const })),
  ),
];
