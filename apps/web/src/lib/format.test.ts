import { describe, expect, it } from 'vitest';
import {
  formatCostDiff,
  formatDay,
  formatDayLong,
  formatDayShort,
  formatGap,
  formatHours,
  formatInstant,
  formatLitres,
  formatSignedPct,
  formatTime,
  formatUsd,
  tomorrow,
} from './format';

describe('formats (NFR-31)', () => {
  it('writes litres with thousands separators, dollars with 2 decimals', () => {
    expect(formatLitres(34000)).toBe('34,000 L');
    expect(formatUsd(412.35)).toBe('$412.35');
  });

  it('writes dates as DD MMM YYYY and times in 24 h Tunis time', () => {
    expect(formatDay('2026-11-05')).toBe('05 Nov 2026');
    expect(formatDayLong('2026-11-03')).toBe('Tue 03 Nov 2026');
    expect(formatTime('2026-11-03T13:30:00Z')).toBe('14:30');
  });

  it('writes hours to stockout, or "More than 7 days"', () => {
    expect(formatHours(14)).toBe('14 h');
    expect(formatHours(null)).toBe('More than 7 days');
  });

  it('writes an instant as time and date in Tunis', () => {
    expect(formatInstant('2026-11-02T07:00:00Z')).toBe('08:00, 02 Nov 2026');
  });

  it('gives tomorrow in Tunis', () => {
    expect(tomorrow(new Date('2026-11-02T23:30:00Z'))).toBe('2026-11-04');
  });

  it('writes signed shares, trip gaps and short axis dates', () => {
    expect([formatSignedPct(8), formatSignedPct(-0.7), formatSignedPct(0)]).toEqual([
      '+8%',
      '−0.7%',
      '+0%',
    ]);
    expect(formatGap(45, 9.4)).toBe('+45 min (+9.4%)'); // FR-84 example
    expect(formatGap(-10, -2.6)).toBe('−10 min (−2.6%)');
    expect(formatDayShort('2026-11-03')).toBe('03 Nov');
  });

  it('formats the cost difference of a decision', () => {
    expect(formatCostDiff(8.6, 2.4)).toBe('+$8.60 (+2.4%)');
    expect(formatCostDiff(-3, -1)).toBe('−$3.00 (−1%)');
    expect(formatCostDiff(0, 0)).toBe('$0.00');
    expect(formatCostDiff(null, null)).toBe('–');
  });
});
