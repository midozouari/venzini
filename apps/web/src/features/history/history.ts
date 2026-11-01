// Decision history view logic (UI-07): filters kept in the address, and the side-by-side reading of
// a log entry's frozen snapshots (FR-72). Values are only read and formatted, never computed.
import { formatMessage } from '@venzini/contracts';
import { z } from 'zod';
import { formatInstant, formatLitres, formatNumber } from '@/lib/format';

export const PAGE_SIZE = 20;

export const ACTION_FILTERS = [
  { value: '', label: 'All decisions' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'modified', label: 'Modified' },
  { value: 'not_dispatched', label: 'Not dispatched' },
] as const;

export type ActionFilter = (typeof ACTION_FILTERS)[number]['value'];

export interface HistoryFilters {
  q: string;
  type: ActionFilter;
  from: string;
  to: string;
  page: number;
}

const isAction = (v: string): v is ActionFilter => ACTION_FILTERS.some((a) => a.value === v);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** The filters of the address (`/history?q=ST015&type=modified&page=2`); unknown values are dropped. */
export function readFilters(params: URLSearchParams): HistoryFilters {
  const type = params.get('type') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Number(params.get('page'));
  return {
    q: (params.get('q') ?? '').slice(0, 80),
    type: isAction(type) ? type : '',
    from: isDate(from) ? from : '',
    to: isDate(to) ? to : '',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** The address form of the filters: only what is set, so a plain list stays `/history`. */
export function writeFilters(f: HistoryFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.q.trim()) params.set('q', f.q.trim());
  if (f.type) params.set('type', f.type);
  if (f.from) params.set('from', f.from);
  if (f.to) params.set('to', f.to);
  if (f.page > 1) params.set('page', String(f.page));
  return params;
}

/** The API-17 query of the filters. */
export function apiQuery(f: HistoryFilters): string {
  const params = writeFilters(f);
  params.set('page', String(f.page));
  params.set('page_size', String(PAGE_SIZE));
  return params.toString();
}

export const hasFilters = (f: HistoryFilters) => !!(f.q.trim() || f.type || f.from || f.to);

/** UI-07 validation: the range must not end before it starts (ERR-VAL-02 wording). */
export function rangeError(f: HistoryFilters): string | null {
  return f.from && f.to && f.to < f.from
    ? formatMessage('ERR-VAL-02', { field: 'To', rule: 'must be on or after the start date' })
    : null;
}

// Snapshots are frozen copies (TBL-24): one action, or the whole plan.
const ActionSnapshot = z.object({
  station_id: z.string(),
  station_name: z.string(),
  tanker_id: z.string(),
  est_arrival: z.string(),
  quantities: z.array(z.object({ fuel_type_id: z.string(), litres: z.number() })),
});
const PlanSnapshot = z.object({
  routes: z.number(),
  stops: z.number(),
  total_litres: z.number(),
});

export interface CompareRow {
  label: string;
  original: string;
  final: string;
  changed: boolean;
}

/**
 * Original recommendation and final version, line by line. A fuel missing on one side shows "–".
 * Returns null when the snapshots have an unknown shape.
 */
export function compareSnapshots(
  original: Record<string, unknown>,
  final: Record<string, unknown>,
  fuelName: (id: string) => string,
): CompareRow[] | null {
  const row = (label: string, a: string, b: string): CompareRow => ({
    label,
    original: a,
    final: b,
    changed: a !== b,
  });

  const oa = ActionSnapshot.safeParse(original);
  const fa = ActionSnapshot.safeParse(final);
  if (oa.success && fa.success) {
    const o = oa.data;
    const f = fa.data;
    const fuels = [...new Set([...o.quantities, ...f.quantities].map((q) => q.fuel_type_id))];
    const litres = (s: typeof o, fuel: string) => {
      const q = s.quantities.find((x) => x.fuel_type_id === fuel);
      return q ? formatLitres(q.litres) : '–';
    };
    return [
      row('Tanker', o.tanker_id, f.tanker_id),
      row('Estimated arrival', formatInstant(o.est_arrival), formatInstant(f.est_arrival)),
      ...fuels.map((fuel) => row(fuelName(fuel), litres(o, fuel), litres(f, fuel))),
    ];
  }

  const op = PlanSnapshot.safeParse(original);
  const fp = PlanSnapshot.safeParse(final);
  if (op.success && fp.success) {
    const o = op.data;
    const f = fp.data;
    return [
      row('Routes', formatNumber(o.routes), formatNumber(f.routes)),
      row('Stops', formatNumber(o.stops), formatNumber(f.stops)),
      row('Total litres', formatLitres(o.total_litres), formatLitres(f.total_litres)),
    ];
  }
  return null;
}

/** The station name frozen in an action snapshot, if any. */
export function snapshotStationName(snapshot: Record<string, unknown>): string | null {
  const parsed = ActionSnapshot.safeParse(snapshot);
  return parsed.success ? parsed.data.station_name : null;
}
