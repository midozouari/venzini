import { describe, expect, it } from 'vitest';
import {
  API_BASE_PATH,
  canCall,
  CreateStationRequest,
  EditRequest,
  fillTemplate,
  formatMessage,
  increaseSeverity,
  isUncertain,
  latenessSeverity,
  riskLevelFromHours,
  roundHalfEven,
  SaveResourcesRequest,
} from './index';

describe('contracts', () => {
  it('uses the /api/v1 base path (SDD 5.6.1)', () => {
    expect(API_BASE_PATH).toBe('/api/v1');
  });
});

describe('SRS rules (rules.ts)', () => {
  it('classifies 23/24/72/73 h as high/medium/medium/low (BR-26, AC-06)', () => {
    expect([23, 24, 72, 73].map(riskLevelFromHours)).toEqual(['high', 'medium', 'medium', 'low']);
    expect(riskLevelFromHours(null)).toBe('low');
  });

  it('flags 69% as uncertain and 70% as not (BR-27, AC-05)', () => {
    expect([isUncertain(69), isUncertain(70)]).toEqual([true, false]);
  });

  it('grades lateness 60/61/180/181 min and increases 9.9/10/25/25.1% (D-18, FR-63)', () => {
    expect([60, 61, 180, 181].map(latenessSeverity)).toEqual(['low', 'medium', 'medium', 'high']);
    expect([9.9, 10, 25, 25.1].map(increaseSeverity)).toEqual(['low', 'medium', 'medium', 'high']);
  });

  it('rounds money half to even (ALG-05)', () => {
    expect([roundHalfEven(0.125, 2), roundHalfEven(0.135, 2), roundHalfEven(66.2112, 2)]).toEqual([
      0.12, 0.14, 66.21,
    ]);
  });
});

describe('messages and templates', () => {
  it('fills error messages (SRS 14.2)', () => {
    expect(formatMessage('ERR-VAL-05a', { tanker: 'T-01', max: '8,000' })).toBe(
      'This quantity exceeds the space left on tanker T-01. Enter 8,000 L or less.',
    );
  });

  it('refuses to invent a missing template value (ALG-08)', () => {
    expect(() => fillTemplate('TPL-EDIT-04', { station: 'ST014' })).toThrow();
  });
});

describe('access (SDD 6.1.1)', () => {
  it('lets only managers decide and only dispatchers save resources', () => {
    expect(['manager', 'dispatcher', 'admin'].map((r) => canCall('API-15', r as never))).toEqual([
      true,
      false,
      false,
    ]);
    expect(['manager', 'dispatcher', 'admin'].map((r) => canCall('API-07', r as never))).toEqual([
      false,
      true,
      false,
    ]);
    expect(canCall('API-17', 'admin')).toBe(true);
    expect(canCall('API-03', null)).toBe(false);
  });
});

describe('request schemas', () => {
  it('chooses the edit schema by kind and rejects unknown fields (API-13)', () => {
    expect(EditRequest.safeParse({ kind: 'reset', expected_version: 4 }).success).toBe(true);
    expect(
      EditRequest.safeParse({ kind: 'reorder', expected_version: 4, stop_id: 'S-01' }).success,
    ).toBe(false);
    expect(EditRequest.safeParse({ kind: 'reset', expected_version: 4, extra: 1 }).success).toBe(
      false,
    );
  });

  it('names the field when a safety stock is above capacity (FR-06)', () => {
    const r = CreateStationRequest.safeParse({
      station_id: 'ST021',
      name: 'Test',
      latitude: 36.8,
      longitude: 10.2,
      region: 'Tunis North',
      window_open: '06:00',
      window_close: '18:00',
      tanks: [
        { fuel_type_id: 'P95', capacity_l: 1000, safety_stock_l: 2000, current_level_l: 500 },
      ],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['tanks', 0, 'safety_stock_l']);
  });

  it('refuses negative stock (FR-09)', () => {
    expect(
      SaveResourcesRequest.safeParse({
        tankers: [],
        drivers: [],
        stock: [{ warehouse_id: 'WH-RIV', fuel_type_id: 'P95', stock_l: -1 }],
      }).success,
    ).toBe(false);
  });
});
