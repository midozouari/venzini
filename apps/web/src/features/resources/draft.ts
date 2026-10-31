// The dispatcher's unsaved edits of a day's resources (UC-02), and the list of changes shown in
// the confirmation before saving. Only availability and stock can change (SDD API-07).
import { formatMessage, type Resources, type SaveResourcesRequest } from '@venzini/contracts';
import { formatLitres } from '@/lib/format';

export interface Draft {
  tankers: Record<string, boolean>;
  drivers: Record<string, boolean>;
  /** Stock as typed, per "warehouseId|fuelId". */
  stock: Record<string, string>;
}

export const stockKey = (warehouseId: string, fuelId: string) => `${warehouseId}|${fuelId}`;

export function draftOf(r: Resources): Draft {
  return {
    tankers: Object.fromEntries(r.tankers.map((t) => [t.tanker_id, t.available])),
    drivers: Object.fromEntries(r.drivers.map((d) => [d.driver_id, d.available])),
    stock: Object.fromEntries(
      r.stock.map((s) => [stockKey(s.warehouse_id, s.fuel_type_id), String(s.stock_l)]),
    ),
  };
}

/** Field error of a typed stock value, in the SRS 14.2 wording; null when valid. */
export function stockError(value: string): string | null {
  if (value.trim() === '') return formatMessage('ERR-VAL-01', { field: 'Stock' });
  if (!/^\d+$/.test(value.trim()))
    return formatMessage('ERR-VAL-02', {
      field: 'Stock',
      rule: 'must be a whole number, 0 or more.',
    });
  return null;
}

export interface Change {
  label: string;
  from: string;
  to: string;
  /** A tanker made available while still on a trip (WARN-RES-01). */
  openTrip?: string;
}

const availability = (v: boolean) => (v ? 'available' : 'not available');

export function changesOf(
  r: Resources,
  d: Draft,
  names: { warehouse: (id: string) => string; fuel: (id: string) => string },
): Change[] {
  const out: Change[] = [];
  for (const t of r.tankers)
    if (d.tankers[t.tanker_id] !== t.available)
      out.push({
        label: t.tanker_id,
        from: availability(t.available),
        to: availability(!t.available),
        openTrip:
          !t.available && t.open_trip
            ? formatMessage('WARN-RES-01', { tanker: t.tanker_id, trip: t.open_trip.route_id })
            : undefined,
      });
  for (const dr of r.drivers)
    if (d.drivers[dr.driver_id] !== dr.available)
      out.push({
        label: dr.full_name,
        from: availability(dr.available),
        to: availability(!dr.available),
      });
  for (const s of r.stock) {
    const typed = d.stock[stockKey(s.warehouse_id, s.fuel_type_id)] ?? '';
    if (stockError(typed) === null && Number(typed) !== s.stock_l)
      out.push({
        label: `${names.warehouse(s.warehouse_id)} · ${names.fuel(s.fuel_type_id)}`,
        from: formatLitres(s.stock_l),
        to: formatLitres(Number(typed)),
      });
  }
  return out;
}

/** The full API-07 request: every row, with the draft values (the API saves a full version). */
export function requestOf(r: Resources, d: Draft): SaveResourcesRequest {
  return {
    tankers: r.tankers.map((t) => ({
      tanker_id: t.tanker_id,
      available: d.tankers[t.tanker_id] ?? t.available,
    })),
    drivers: r.drivers.map((x) => ({
      driver_id: x.driver_id,
      available: d.drivers[x.driver_id] ?? x.available,
    })),
    stock: r.stock.map((s) => ({
      warehouse_id: s.warehouse_id,
      fuel_type_id: s.fuel_type_id,
      stock_l: Number(d.stock[stockKey(s.warehouse_id, s.fuel_type_id)]),
    })),
  };
}
