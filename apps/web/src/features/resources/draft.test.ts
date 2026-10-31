import type { Resources } from '@venzini/contracts';
import { describe, expect, it } from 'vitest';
import { changesOf, draftOf, requestOf, stockError, stockKey } from './draft';

const resources: Resources = {
  delivery_day: '2026-11-03',
  resource_version_id: 'RV-0192',
  version_no: 3,
  locked: false,
  updated_by: { id: 'u1', full_name: 'Karim B.' },
  updated_at: '2026-11-01T16:40:00Z',
  tankers: [
    {
      tanker_id: 'T-01',
      capacity_l: 36000,
      compartments: [12000, 12000, 12000],
      home_warehouse_id: 'WH-RIV',
      available: true,
      open_trip: null,
    },
    {
      tanker_id: 'T-06',
      capacity_l: 30000,
      compartments: [10000, 10000, 10000],
      home_warehouse_id: 'WH-SUD',
      available: false,
      open_trip: { route_id: 'R-11', delivery_day: '2026-11-01' },
    },
  ],
  drivers: [
    { driver_id: 'D-04', full_name: 'Ali H.', home_warehouse_id: 'WH-RIV', available: true },
  ],
  stock: [{ warehouse_id: 'WH-SUD', fuel_type_id: 'P95', stock_l: 17700 }],
};
const names = { warehouse: () => 'Mornag Depot', fuel: () => 'Petrol 95' };

describe('resources draft (UC-02)', () => {
  it('lists each change, with the open-trip warning (WARN-RES-01)', () => {
    const d = draftOf(resources);
    expect(changesOf(resources, d, names)).toEqual([]);
    d.tankers['T-06'] = true;
    d.stock[stockKey('WH-SUD', 'P95')] = '25000';
    expect(changesOf(resources, d, names)).toEqual([
      {
        label: 'T-06',
        from: 'not available',
        to: 'available',
        openTrip: 'Tanker T-06 has not returned from trip R-11. Check before marking it available.',
      },
      { label: 'Mornag Depot · Petrol 95', from: '17,700 L', to: '25,000 L', openTrip: undefined },
    ]);
    expect(requestOf(resources, d).stock[0]!.stock_l).toBe(25000);
  });

  it('checks typed stock with the SRS wording', () => {
    expect(stockError('25000')).toBeNull();
    expect(stockError('')).toBe('Stock is required.');
    expect(stockError('-5')).toBe('Stock: must be a whole number, 0 or more.');
    expect(stockError('12.5')).toBe('Stock: must be a whole number, 0 or more.');
  });
});
