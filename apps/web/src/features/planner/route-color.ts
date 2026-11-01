import type { Route } from '@venzini/contracts';

/** The CSS class of a route's color token (route-1 … route-8, SDD 5.12.4). Kept apart from the
 * map so lists and chips do not load the map code. */
export const routeClass = (route: Pick<Route, 'color'>) => `vz-r${route.color.slice(6)}`;
