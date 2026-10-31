import { describe, expect, it } from 'vitest';
import { linear, niceTicks } from './scale';

describe('chart scales', () => {
  it('gives round ticks from 0 that cover the maximum', () => {
    expect(niceTicks(8400)).toEqual([0, 2000, 4000, 6000, 8000, 10000]);
    expect(niceTicks(61_400)).toEqual([0, 20000, 40000, 60000, 80000]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });

  it('maps a domain onto a range', () => {
    const y = linear(0, 100, 200, 0);
    expect([y(0), y(50), y(100)]).toEqual([200, 100, 0]);
  });
});
