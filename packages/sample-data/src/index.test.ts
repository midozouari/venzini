import { describe, expect, it } from 'vitest';
import { SAMPLE_DATA_SEED } from './index';
import { Rng } from './prng';

describe('sample-data', () => {
  it('uses seed 42 (SDD 7.2)', () => {
    expect(SAMPLE_DATA_SEED).toBe(42);
  });

  it('gives the same random numbers for the same seed', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(
      Array.from({ length: 5 }, () => b.next()),
    );
  });
});
