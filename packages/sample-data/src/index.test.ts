import { describe, expect, it } from 'vitest';
import { SAMPLE_DATA_SEED } from './index';

describe('sample-data', () => {
  it('uses seed 42 (SDD 7.2)', () => {
    expect(SAMPLE_DATA_SEED).toBe(42);
  });
});
