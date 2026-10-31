import { describe, expect, it } from 'vitest';
import { API_BASE_PATH } from './index';

describe('contracts', () => {
  it('uses the /api/v1 base path (SDD 5.6.1)', () => {
    expect(API_BASE_PATH).toBe('/api/v1');
  });
});
