// Screens, addresses and the roles allowed on each (SDD 5.12.3, SRS 4.3).
import type { Page, Role } from '@venzini/contracts';
import {
  Building2,
  ChartLine,
  ClipboardList,
  History,
  ListChecks,
  Map,
  Route,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

export interface ScreenDef {
  path: string;
  title: string;
  roles: readonly Role[];
  /** Shows the delivery-day picker in the top bar. */
  day?: boolean;
  /** Step of the MVP that builds the screen (placeholder until then). */
  step?: string;
  /** Router path when it differs from `path`, so a list and its detail share one page. */
  routePath?: string;
  /** Served by the route of another screen (its `routePath`). */
  servedBy?: string;
}

const ALL: Role[] = ['manager', 'dispatcher', 'admin'];

export const SCREENS: ScreenDef[] = [
  { path: '/network', title: 'Network overview', roles: ['manager'], day: true },
  { path: '/forecast', title: 'Station forecast', roles: ['manager'] },
  { path: '/forecast/totals', title: 'Forecast totals', roles: ['manager'] },
  {
    path: '/resources',
    title: 'Resources',
    roles: ['dispatcher', 'manager'],
    day: true,
  },
  {
    path: '/resources/trips',
    title: 'Trips',
    roles: ['dispatcher', 'manager'],
    day: true,
  },
  {
    path: '/resources/warehouse-forecast',
    title: 'Warehouse forecast',
    roles: ['dispatcher'],
  },
  { path: '/planner', title: 'Delivery planner', roles: ['manager'], day: true },
  { path: '/approvals', title: 'Review and approve', roles: ['manager'], day: true },
  { path: '/history', title: 'Decision history', roles: ALL, routePath: '/history/:entryId?' },
  { path: '/history/:entryId', title: 'Decision history', roles: ALL, servedBy: '/history' },
  { path: '/admin/users', title: 'Administration', roles: ['admin'] },
  { path: '/admin/stations', title: 'Administration', roles: ['admin', 'manager'] },
];

/** Menu entry of each page key of GET /me (API-03). */
export const MENU: Record<Page, { label: string; path: string; icon: LucideIcon }> = {
  network: { label: 'Network', path: '/network', icon: Map },
  forecast: { label: 'Forecasts', path: '/forecast', icon: ChartLine },
  resources: { label: 'Resources', path: '/resources', icon: Truck },
  trips: { label: 'Trips', path: '/resources/trips', icon: Route },
  'warehouse-forecast': {
    label: 'Warehouse forecast',
    path: '/resources/warehouse-forecast',
    icon: Warehouse,
  },
  planner: { label: 'Delivery plan', path: '/planner', icon: ClipboardList },
  approvals: { label: 'Approvals', path: '/approvals', icon: ListChecks },
  history: { label: 'Decision history', path: '/history', icon: History },
  users: { label: 'Users', path: '/admin/users', icon: Users },
  stations: { label: 'Stations', path: '/admin/stations', icon: Building2 },
};

/** The screen matching an address, if any. */
export function screenFor(pathname: string): ScreenDef | undefined {
  return SCREENS.find((s) => {
    const pattern = new RegExp(`^${s.path.replace(/:[^/]+/g, '[^/]+')}/?$`);
    return pattern.test(pathname);
  });
}

/** May this role open this address? Used after login to return to the requested page (FR-01). */
export function canOpen(pathname: string, role: Role): boolean {
  if (pathname === '/admin') return role === 'admin' || role === 'manager';
  const screen = screenFor(pathname);
  return !!screen && screen.roles.includes(role);
}
