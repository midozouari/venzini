import { ROLE_PAGES } from '@venzini/contracts';
import { describe, expect, it } from 'vitest';
import { canOpen, MENU, screenFor } from './routes';

describe('screens and roles (SDD 5.12.3)', () => {
  it('opens each screen to the allowed roles only', () => {
    expect(canOpen('/network', 'manager')).toBe(true);
    expect(canOpen('/network', 'dispatcher')).toBe(false);
    expect(canOpen('/resources/trips', 'manager')).toBe(true);
    expect(canOpen('/resources/warehouse-forecast', 'manager')).toBe(false);
    expect(canOpen('/admin/users', 'manager')).toBe(false);
    expect(canOpen('/admin/stations', 'manager')).toBe(true);
    expect(canOpen('/history/abc', 'dispatcher')).toBe(true);
    expect(canOpen('/nowhere', 'admin')).toBe(false);
  });

  it('gives every menu page of every role a screen that role may open', () => {
    for (const [role, pages] of Object.entries(ROLE_PAGES))
      for (const page of pages) {
        const path = MENU[page].path;
        expect(screenFor(path), path).toBeDefined();
        expect(canOpen(path, role as 'manager'), `${role} ${path}`).toBe(true);
      }
  });
});
