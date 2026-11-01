import { describe, expect, it } from 'vitest';
import {
  apiQuery,
  compareSnapshots,
  hasFilters,
  rangeError,
  readFilters,
  writeFilters,
} from './history';

const fuelName = (id: string) => ({ DIESEL: 'Diesel', P95: 'Petrol 95' })[id] ?? id;

describe('history filters', () => {
  it('reads the address and drops unknown values', () => {
    const f = readFilters(new URLSearchParams('q=ST015&type=bogus&from=2026-10-20&to=x&page=-3'));
    expect(f).toEqual({ q: 'ST015', type: '', from: '2026-10-20', to: '', page: 1 });
  });

  it('writes only what is set, and round-trips', () => {
    const empty = readFilters(new URLSearchParams());
    expect(writeFilters(empty).toString()).toBe('');
    expect(hasFilters(empty)).toBe(false);
    const f = { q: ' Sara ', type: 'modified' as const, from: '', to: '2026-10-31', page: 2 };
    const text = writeFilters(f).toString();
    expect(text).toBe('q=Sara&type=modified&to=2026-10-31&page=2');
    expect(readFilters(new URLSearchParams(text))).toEqual({ ...f, q: 'Sara' });
  });

  it('builds the API-17 query with the page size', () => {
    const f = readFilters(new URLSearchParams('type=rejected'));
    expect(apiQuery(f)).toBe('type=rejected&page=1&page_size=20');
  });

  it('refuses a range that ends before it starts (ERR-VAL-02)', () => {
    const f = readFilters(new URLSearchParams('from=2026-10-30&to=2026-10-20'));
    expect(rangeError(f)).toBe('To: must be on or after the start date');
    expect(rangeError({ ...f, to: '2026-10-30' })).toBeNull();
  });
});

describe('snapshot comparison', () => {
  const action = {
    plan_id: 'PL-1',
    station_id: 'ST015',
    station_name: 'Mornag Plain',
    tanker_id: 'T-05',
    est_arrival: '2026-10-30T09:30:00Z',
    quantities: [{ fuel_type_id: 'DIESEL', litres: 3600 }],
  };

  it('marks what the manager changed in an action', () => {
    const rows = compareSnapshots(
      action,
      { ...action, tanker_id: 'T-06', quantities: [{ fuel_type_id: 'P95', litres: 2000 }] },
      fuelName,
    );
    expect(rows).toEqual([
      { label: 'Tanker', original: 'T-05', final: 'T-06', changed: true },
      {
        label: 'Estimated arrival',
        original: '10:30, 30 Oct 2026',
        final: '10:30, 30 Oct 2026',
        changed: false,
      },
      { label: 'Diesel', original: '3,600 L', final: '–', changed: true },
      { label: 'Petrol 95', original: '–', final: '2,000 L', changed: true },
    ]);
  });

  it('reads whole-plan snapshots', () => {
    const plan = { plan_id: 'PL-2', routes: 6, stops: 14, total_litres: 143800 };
    expect(compareSnapshots(plan, plan, fuelName)?.map((r) => r.final)).toEqual([
      '6',
      '14',
      '143,800 L',
    ]);
  });

  it('returns null for an unknown shape', () => {
    expect(compareSnapshots({ a: 1 }, { a: 1 }, fuelName)).toBeNull();
  });
});
