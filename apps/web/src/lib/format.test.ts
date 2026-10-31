import { describe, expect, it } from 'vitest';
import {
  formatDay,
  formatDayLong,
  formatHours,
  formatInstant,
  formatLitres,
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
});
