// API-17, API-18 · Decision history, read-only for all roles (SDD 5.6.5, FR-73, NFR-14).
// There is no handler that changes or deletes an entry.
import { DecisionQuery, type DecisionListItem } from '@venzini/contracts';
import { http } from 'msw';
import { api, fail, json, readQuery, route } from '../http';
import { store } from '../store';

const TUNIS_OFFSET_MS = 60 * 60_000;
const localDate = (iso: string) =>
  new Date(Date.parse(iso) + TUNIS_OFFSET_MS).toISOString().slice(0, 10);

export const decisionHandlers = [
  http.get(
    api('/decisions'),
    route('API-17', ({ request }) => {
      const parsed = readQuery(request, DecisionQuery);
      if ('error' in parsed) return parsed.error;
      const q = parsed.data;
      const text = q.q?.trim().toLowerCase();
      const entries = store.state.decisions
        .filter((e) => !q.from || localDate(e.decided_at) >= q.from)
        .filter((e) => !q.to || localDate(e.decided_at) <= q.to)
        .filter((e) => {
          if (!q.type) return true;
          if (q.type === 'approved' || q.type === 'rejected') return e.decision === q.type;
          return e.plan_label === (q.type === 'modified' ? 'modified' : 'not dispatched');
        })
        .filter((e) => !q.station || e.station_id === q.station)
        .filter((e) => !q.user || e.manager.id === q.user)
        .filter(
          (e) =>
            !text ||
            [
              e.station_id ?? '',
              e.manager.full_name,
              String(e.original_recommendation['station_name'] ?? ''),
            ].some((v) => v.toLowerCase().includes(text)),
        )
        .sort((a, b) => b.decided_at.localeCompare(a.decided_at)); // newest first (FR-73)

      const items: DecisionListItem[] = entries
        .slice((q.page - 1) * q.page_size, q.page * q.page_size)
        .map((e) => ({
          entry_id: e.entry_id,
          decided_at: e.decided_at,
          manager: e.manager,
          scope: e.scope,
          decision: e.decision,
          station_id: e.station_id,
          plan_label: e.plan_label,
          cost_diff_usd: e.cost_diff_usd,
          cost_diff_pct: e.cost_diff_pct,
          risk_count: e.risk_count,
          max_severity: e.max_severity,
        }));
      return json({ items, page: q.page, page_size: q.page_size, total: entries.length });
    }),
  ),

  http.get<{ id: string }>(
    api('/decisions/:id'),
    route('API-18', ({ params }) => {
      const entry = store.state.decisions.find((e) => e.entry_id === params.id);
      return entry ? json(entry) : fail('ERR-API-01');
    }),
  ),
];
