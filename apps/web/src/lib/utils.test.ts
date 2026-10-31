import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('keeps a text color next to a custom text size', () => {
    expect(cn('text-panel', 'text-body')).toBe('text-panel text-body');
    expect(cn('text-caption', 'text-body')).toBe('text-body');
  });
});
