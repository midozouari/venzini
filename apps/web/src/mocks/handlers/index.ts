import type { RequestHandler } from 'msw';

// One MSW handler per endpoint (API-01 to API-19, API-P1 to API-P3) is added in Step 1 (SDD 7.1).
export const handlers: RequestHandler[] = [];
