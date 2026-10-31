import { describe, expect, it } from 'vitest';
import { isoToTunis, tunisToIso } from './time';

describe('Tunis time (SDD 6.5)', () => {
  it('turns a Tunis wall-clock time into a UTC instant and back', () => {
    expect(tunisToIso('2026-11-01', '06:10')).toBe('2026-11-01T05:10:00Z');
    expect(tunisToIso('2026-11-02', '00:30')).toBe('2026-11-01T23:30:00Z');
    expect(isoToTunis('2026-11-01T23:30:00Z')).toEqual({ day: '2026-11-02', time: '00:30' });
  });
});
