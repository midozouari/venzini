// Role-based access (SDD 6.1.1, SRS 4.3). The same table drives the mock API, GET /me and the menus.
import type { Role } from './common';

export type Access = 'public' | readonly Role[];

const ALL: readonly Role[] = ['manager', 'dispatcher', 'admin'];

/** Who may call each endpoint. Anything not listed is refused (default deny). */
export const ENDPOINT_ACCESS = {
  'API-01': 'public', // POST /auth/login
  'API-02': ALL, // POST /auth/logout
  'API-03': ALL, // GET /me
  'API-04': ['admin'], // users
  'API-05': ['manager', 'admin'], // stations (D-15)
  'API-06': ['manager', 'dispatcher'], // GET resources (manager read-only)
  'API-07': ['dispatcher'], // PUT resources
  'API-08': ['dispatcher'], // PATCH trips
  'API-09': ['manager'], // network
  'API-10': ['manager'], // forecasts
  'API-11': ['manager'], // POST plans
  'API-12': ['manager'], // GET plan
  'API-13': ['manager'], // edits
  'API-14': ['manager'], // limits
  'API-15': ['manager'], // decide one action
  'API-16': ['manager'], // decide whole plan
  'API-17': ALL, // decision history
  'API-18': ALL, // one decision
  'API-19': ['manager', 'dispatcher'], // totals (dispatcher: warehouse level only, D-17)
  'API-P1': ALL, // reference
  'API-P2': ['manager'], // GET /plans?day=
  'API-P3': ['manager', 'dispatcher'], // GET /trips?day=
  'API-P4': 'public', // health
} as const satisfies Record<string, Access>;

export type EndpointId = keyof typeof ENDPOINT_ACCESS;

export function canCall(endpoint: EndpointId, role: Role | null): boolean {
  const access: Access = ENDPOINT_ACCESS[endpoint];
  if (access === 'public') return true;
  return role !== null && access.includes(role);
}

/** Menu pages per role (API-03 `pages`, SDD 5.12.3, SRS 13 navigation). */
export const ROLE_PAGES = {
  manager: ['network', 'forecast', 'resources', 'planner', 'approvals', 'stations', 'history'],
  dispatcher: ['resources', 'trips', 'warehouse-forecast', 'history'],
  admin: ['users', 'stations', 'history'],
} as const satisfies Record<Role, readonly string[]>;

/** Controls each role may use (API-03 `can`). UI hiding is not a security control. */
export const ROLE_CAN = {
  manager: {
    edit_plan: true,
    decide: true,
    save_resources: false,
    record_trips: false,
    manage_users: false,
    manage_stations: true,
  },
  dispatcher: {
    edit_plan: false,
    decide: false,
    save_resources: true,
    record_trips: true,
    manage_users: false,
    manage_stations: false,
  },
  admin: {
    edit_plan: false,
    decide: false,
    save_resources: false,
    record_trips: false,
    manage_users: true,
    manage_stations: true,
  },
} as const satisfies Record<Role, Record<string, boolean>>;

/** Home page of each role (FR-01). */
export const ROLE_HOME = {
  manager: '/network',
  dispatcher: '/resources',
  admin: '/admin',
} as const satisfies Record<Role, string>;
